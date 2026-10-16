// AI 对话（阶段 4 · 检查点 4.4/4.5）：DeepSeek 直连 + 语料引用。
// - API key 只存 Windows 凭据管理器（keyring，SPEC-012），绝不写文件；key 三态语义同 GitHub PAT
//   （Some(非空)=写入 / Some("")=清除 / None=不动）；key 只在 Rust 层使用，错误信息过滤 key；
// - ai_ask 三步（v4.12 §2.7）：①轻量调用扩词+选卡 → ②corpus_search 本地检索（仅 corpus/，
//   日记/量化数据绝不进入）→ ③拼 prompt 调 DeepSeek，返回回答 + 引用列表；
// - 兜底：检索无命中时指令 AI 基于自身智能回答并明确提示「未得到语料库的充分支撑」；
// - 软件开源（MIT）不内置任何 key；每次提问 2 次 API 调用（扩词+生成）。

use serde::Serialize;
use std::time::Duration;

use crate::corpus_search::{corpus_search, CorpusHit};
use crate::fs_cmds;

const KEYRING_SERVICE: &str = "CompassZha";
const KEYRING_ACCOUNT: &str = "deepseek_api_key";
const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
const DEFAULT_MODEL: &str = "deepseek-chat";

/// 对话消息（前端传入；OpenAI 兼容 role：user / assistant）。
#[derive(serde::Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

/// ai_ask 返回（回答 + 引用出处列表）。
#[derive(Serialize)]
pub struct AiAnswer {
    pub answer: String,
    pub citations: Vec<CorpusHit>,
}

/// 设置页 AI 配置（ai_get_config 返回）。
#[derive(Serialize)]
pub struct AiConfig {
    pub base_url: String,
    pub model: String,
    pub key_saved: bool,
    pub corpus_dir: String, // 语料文件夹绝对路径（「资源跳转」按钮与引导文案用）
    pub data_root: String,
}

/* ---- config.json 的 ai 对象读写（合并写回，保留其他字段） ---- */

fn read_ai_cfg() -> serde_json::Value {
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json"))
        .unwrap_or_default();
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|v| v.get("ai").cloned())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_ai_cfg(ai: &serde_json::Value) -> Result<(), String> {
    let path = fs_cmds::data_root().join("config.json");
    let text = std::fs::read_to_string(&path).map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let mut cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    cfg["ai"] = ai.clone();
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

fn cfg_str(v: &serde_json::Value, key: &str, default: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}

/* ---- keyring（SPEC-012） ---- */

fn key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("打开系统凭据管理器失败：{e}"))
}

fn key_saved() -> bool {
    key_entry().ok().and_then(|e| e.get_password().ok()).is_some()
}

fn read_key() -> Result<String, String> {
    key_entry()?
        .get_password()
        .map_err(|_| "尚未配置 DeepSeek API Key——请到设置页「AI 配置」填写".to_string())
}

/* ---- DeepSeek HTTP（OpenAI 兼容 chat/completions） ---- */

fn client(timeout: Duration) -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{e}"))
}

/// 调用 chat/completions；返回首条回答文本。错误信息过滤 key（绝不回显）。
fn chat(
    base_url: &str,
    model: &str,
    key: &str,
    messages: &serde_json::Value,
    temperature: f32,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let body = serde_json::json!({ "model": model, "messages": messages, "temperature": temperature });
    let resp = client(Duration::from_secs(180))?
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .map_err(|e| format!("请求 AI 服务失败（检查网络/代理）：{e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("读取 AI 响应失败：{e}"))?;
    if !status.is_success() {
        let safe = text.replace(key, "<已隐藏>");
        return Err(format!("AI 服务返回错误（HTTP {status}）：{safe}"));
    }
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 AI 响应失败：{e}"))?;
    v.pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "AI 响应中没有回答内容".to_string())
}

/* ---- 索引卡（扩词调用需要卡列表） ---- */

fn topic_cards() -> String {
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json"))
        .unwrap_or_default();
    let cfg = serde_json::from_str::<serde_json::Value>(&text).unwrap_or_default();
    let topics = cfg
        .get("corpus_topics")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    topics
        .iter()
        .filter_map(|t| {
            let id = t.get("id").and_then(|v| v.as_str())?;
            let name = t.get("name").and_then(|v| v.as_str()).unwrap_or("");
            Some(format!("{id}({name})"))
        })
        .collect::<Vec<_>>()
        .join("、")
}

/* ---- Tauri commands（全部 async：阻塞 HTTP 在线程池执行，v4.5 红线） ---- */

#[tauri::command(async)]
pub fn ai_get_config() -> Result<AiConfig, String> {
    let a = read_ai_cfg();
    Ok(AiConfig {
        base_url: cfg_str(&a, "base_url", DEFAULT_BASE_URL),
        model: cfg_str(&a, "model", DEFAULT_MODEL),
        key_saved: key_saved(),
        corpus_dir: fs_cmds::data_root().join("corpus").to_string_lossy().to_string(),
        data_root: fs_cmds::data_root().to_string_lossy().to_string(),
    })
}

/// 保存 AI 配置。key 三态：Some(非空)=写入 / Some("")=清除 / None=不动。
#[tauri::command(async)]
pub fn ai_set_config(
    base_url: String,
    model: String,
    key: Option<String>,
) -> Result<(), String> {
    let base_url = {
        let b = base_url.trim();
        if b.is_empty() { DEFAULT_BASE_URL.to_string() } else { b.to_string() }
    };
    let model = {
        let m = model.trim();
        if m.is_empty() { DEFAULT_MODEL.to_string() } else { m.to_string() }
    };
    match key.as_deref().map(str::trim) {
        Some(k) if !k.is_empty() => key_entry()?
            .set_password(k)
            .map_err(|e| format!("API Key 写入系统凭据管理器失败：{e}"))?,
        Some(_) => {
            if key_saved() {
                key_entry()?
                    .delete_credential()
                    .map_err(|e| format!("清除 API Key 失败：{e}"))?;
            }
        }
        None => {}
    }
    let mut a = read_ai_cfg();
    a["base_url"] = serde_json::json!(base_url);
    a["model"] = serde_json::json!(model);
    write_ai_cfg(&a)
}

/// 语料对话主入口：扩词 → 检索 → 生成（返回回答 + 引用）。
#[tauri::command(async)]
pub fn ai_ask(messages: Vec<ChatMsg>) -> Result<AiAnswer, String> {
    let key = read_key()?;
    let a = read_ai_cfg();
    let base_url = cfg_str(&a, "base_url", DEFAULT_BASE_URL);
    let model = cfg_str(&a, "model", DEFAULT_MODEL);

    let question = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.trim().to_string())
        .filter(|c| !c.is_empty())
        .ok_or_else(|| "请输入问题".to_string())?;

    // ① 扩词 + 选卡（轻量调用；失败则退化用原句与分句做关键词，不阻断对话）
    let (keywords, topics) = match expand_keywords(&base_url, &model, &key, &question) {
        Ok((k, t)) => (k, t),
        Err(e) => {
            eprintln!("[ai_chat] 扩词失败，退化为原句检索：{e}");
            let mut k: Vec<String> = question
                .split(|c: char| "，。？！、；：,.?!;: \n".contains(c))
                .map(|s| s.trim().to_string())
                .filter(|s| s.chars().count() >= 2 && s.chars().count() <= 20)
                .collect();
            k.push(question.clone());
            (k, None)
        }
    };

    // ② 本地检索（仅 corpus/；日记/量化数据绝不进入）
    let hits = corpus_search(keywords.clone(), topics.clone(), Some(12))?;

    // ③ 拼 prompt 生成
    let has_material = !hits.is_empty();
    let system = if has_material {
        "你是「语料对话」助手，回答建立在用户个人语料库之上。用户喂入的语料一律视为可信引用源，不区分观点归属。\
         规则：1) 优先依据下方材料回答，引用处在句末标注 [来源: 文件名]；\
         2) 材料不足以支撑回答时，可基于你自身智能作答，但必须在回答开头明确提示「以下回答未得到语料库的充分支撑，属 AI 自身观点」；\
         3) 全程用中文回答。"
    } else {
        "你是「语料对话」助手。语料库中没有找到与用户问题相关的材料。请基于你自身智能用中文回答，\
         并且必须在回答开头明确提示：「本次回答未得到语料库的充分支撑，属 AI 自身观点。」"
    };
    let user_content = if has_material {
        let mut m = String::from("【语料库检索到的相关材料】\n");
        for (i, h) in hits.iter().enumerate() {
            m.push_str(&format!("\n[{}] 文件: {}\n{}\n", i + 1, h.title, h.snippet));
        }
        m.push_str(&format!("\n【用户问题】\n{question}"));
        m
    } else {
        question.clone()
    };

    // 组装 OpenAI messages：system + 历史（最后一条 user 替换为 材料+问题）
    let mut msgs: Vec<serde_json::Value> = vec![serde_json::json!({"role": "system", "content": system})];
    for m in messages.iter().take(messages.len().saturating_sub(1)) {
        if m.role == "user" || m.role == "assistant" {
            msgs.push(serde_json::json!({"role": m.role, "content": m.content}));
        }
    }
    msgs.push(serde_json::json!({"role": "user", "content": user_content}));

    let answer = chat(&base_url, &model, &key, &serde_json::Value::Array(msgs), 0.7)?;
    Ok(AiAnswer { answer, citations: hits })
}

/// 扩词调用：返回 (关键词, 卡 id)。失败由调用方兜底。
fn expand_keywords(
    base_url: &str,
    model: &str,
    key: &str,
    question: &str,
) -> Result<(Vec<String>, Option<Vec<String>>), String> {
    let cards = topic_cards();
    let system = format!(
        "你是检索查询扩展器。把用户问题扩展成用于中文语料库检索的关键词列表（5~10 个，\
         覆盖同义词、近义说法与相关概念），并从这些主题卡中选出最相关的 0~3 张：{cards}。\
         只输出 JSON，格式 {{\"keywords\": [\"...\"], \"topics\": [\"卡id\"]}}。"
    );
    let msgs = serde_json::json!([
        { "role": "system", "content": system },
        { "role": "user", "content": question },
    ]);
    let out = chat(base_url, model, key, &msgs, 0.0)?;
    let v: serde_json::Value = serde_json::from_str(out.trim()).map_err(|e| format!("扩词结果不是 JSON：{e}"))?;
    let keywords = v
        .get("keywords")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let topics = v
        .get("topics")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|t| !t.is_empty());
    if keywords.is_empty() {
        return Err("扩词结果为空".into());
    }
    Ok((keywords, topics))
}

/// 「资源跳转」：用系统资源管理器打开语料文件夹（不存在则先建）。
#[tauri::command(async)]
pub fn open_corpus_folder() -> Result<(), String> {
    let dir = fs_cmds::data_root().join("corpus");
    std::fs::create_dir_all(&dir).map_err(|e| format!("语料文件夹创建失败：{e}"))?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("explorer")
            .arg(&dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("打开资源管理器失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    Err("仅支持 Windows".into())
}
