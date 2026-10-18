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
// v4.15 双 API：数据分析专用 key（缺省回落主 key——只有一个 API 时两个对话共用）
const KEYRING_ACCOUNT_DATA: &str = "deepseek_api_key_data";
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

/// 设置页 AI 配置（ai_get_config 返回）。data_* 为**解析后的有效值**（含回落，前端直接显示）。
#[derive(Serialize)]
pub struct AiConfig {
    pub base_url: String,
    pub model: String,
    pub key_saved: bool,
    pub data_base_url: String,
    pub data_model: String,
    pub data_key_saved: bool,
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

// v4.15：数据分析专用 keyring entry（account deepseek_api_key_data）
fn data_key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT_DATA)
        .map_err(|e| format!("打开系统凭据管理器失败：{e}"))
}

fn key_saved() -> bool {
    key_entry().ok().and_then(|e| e.get_password().ok()).is_some()
}

fn data_key_saved() -> bool {
    data_key_entry().ok().and_then(|e| e.get_password().ok()).is_some()
}

fn read_key() -> Result<String, String> {
    key_entry()?
        .get_password()
        .map_err(|_| "尚未配置 AI API Key——请到设置页「AI 配置」填写".to_string())
}

/// 数据分析用 key：优先专用 key，缺省回落主 key（v4.15 双 API：只有一个 API 时共用）。
fn read_data_key() -> Result<String, String> {
    if let Some(k) = data_key_entry().ok().and_then(|e| e.get_password().ok()) {
        return Ok(k);
    }
    read_key()
}

/// 数据分析有效端点（v4.15）：data 专用 base_url/model → 回落主配置。
fn data_ai_endpoint() -> (String, String) {
    let a = read_ai_cfg();
    let base = cfg_str(&a, "base_url", DEFAULT_BASE_URL);
    let model = cfg_str(&a, "model", DEFAULT_MODEL);
    (cfg_str(&a, "data_base_url", &base), cfg_str(&a, "data_model", &model))
}

/* ---- DeepSeek HTTP（OpenAI 兼容 chat/completions） ---- */

/// 构造 HTTP 客户端。`direct=true` 时禁用系统代理（忽略 HTTP_PROXY/HTTPS_PROXY 等环境变量）。
fn client(timeout: Duration, direct: bool) -> Result<reqwest::blocking::Client, String> {
    let mut b = reqwest::blocking::Client::builder().timeout(timeout);
    if direct {
        b = b.no_proxy();
    }
    b.build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{e}"))
}

/// 展开错误原因链：reqwest 的 Display 只有「error sending request for url …」，
/// 真正的根因（connection refused / timeout / dns 失败等）挂在 cause 链上。
fn err_chain(e: &dyn std::error::Error) -> String {
    let mut s = e.to_string();
    let mut cur = e.source();
    while let Some(c) = cur {
        s.push_str(" → ");
        s.push_str(&c.to_string());
        cur = c.source();
    }
    s
}

/// 发送请求（v0.2.8 兼容性修复）：**先直连**（忽略系统代理环境变量），失败后再用系统代理重试一次。
/// 缘由：不少用户电脑里残留着已失效的代理设置（例如指向 127.0.0.1:17890 的已关闭端口），
/// reqwest 默认读这些环境变量并把请求交给不存在的代理，导致任何提问都必然失败。
/// 直连优先可保证这类机器正常工作；只有直连不通（如确需代理上网的环境）才回落到系统代理。
fn send(
    url: &str,
    key: &str,
    body: &serde_json::Value,
) -> Result<reqwest::blocking::Response, String> {
    let direct = client(Duration::from_secs(180), true)?
        .post(url)
        .bearer_auth(key)
        .json(body)
        .send();
    match direct {
        Ok(r) => Ok(r),
        Err(e1) => {
            let e1 = err_chain(&e1);
            eprintln!("[ai_chat] 直连失败，改用系统代理重试：{e1}");
            match client(Duration::from_secs(180), false)?
                .post(url)
                .bearer_auth(key)
                .json(body)
                .send()
            {
                Ok(r) => Ok(r),
                Err(e2) => Err(format!(
                    "直连失败（{e1}）；经系统代理重试也失败（{}）",
                    err_chain(&e2)
                )),
            }
        }
    }
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
    let resp = send(&url, key, &body)
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
    // data_* 返回原始配置（空=未配置，回落共用主 API）——若返回解析后有效值，
    // 未配置时保存会把回落值固化进 data_base_url，语义被污染。
    let raw_str = |k: &str| {
        a.get(k)
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .unwrap_or_default()
    };
    Ok(AiConfig {
        base_url: cfg_str(&a, "base_url", DEFAULT_BASE_URL),
        model: cfg_str(&a, "model", DEFAULT_MODEL),
        key_saved: key_saved(),
        data_base_url: raw_str("data_base_url"),
        data_model: raw_str("data_model"),
        data_key_saved: data_key_saved(),
        corpus_dir: fs_cmds::data_root().join("corpus").to_string_lossy().to_string(),
        data_root: fs_cmds::data_root().to_string_lossy().to_string(),
    })
}

/// 保存 AI 配置。key 三态：Some(非空)=写入 / Some("")=清除 / None=不动。
/// v4.15 双 API：data_base_url/data_model 为 Some(空串)=清除回落共用主 API、Some(值)=写入、None=不动；
/// data_key 三态同主 key（独立 keyring account deepseek_api_key_data）。
#[tauri::command(async)]
pub fn ai_set_config(
    base_url: String,
    model: String,
    key: Option<String>,
    data_base_url: Option<String>,
    data_model: Option<String>,
    data_key: Option<String>,
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
    match data_key.as_deref().map(str::trim) {
        Some(k) if !k.is_empty() => data_key_entry()?
            .set_password(k)
            .map_err(|e| format!("数据分析 API Key 写入系统凭据管理器失败：{e}"))?,
        Some(_) => {
            if data_key_saved() {
                data_key_entry()?
                    .delete_credential()
                    .map_err(|e| format!("清除数据分析 API Key 失败：{e}"))?;
            }
        }
        None => {}
    }
    let mut a = read_ai_cfg();
    a["base_url"] = serde_json::json!(base_url);
    a["model"] = serde_json::json!(model);
    if let Some(db) = data_base_url {
        a["data_base_url"] = serde_json::json!(db.trim());
    }
    if let Some(dm) = data_model {
        a["data_model"] = serde_json::json!(dm.trim());
    }
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
    // v4.14：索引卡 keywords 是真实检索筛词——选中卡的 keywords 并入检索词参与打分
    let keywords = merge_card_keywords(keywords, &topics);
    let hits = corpus_search(keywords, topics.clone(), Some(12))?;

    // ③ 拼 prompt 生成（统一口径：有/无材料共用一份 system；材料段按命中决定是否拼入）
    let has_material = !hits.is_empty();
    let system = "你是「语料对话」助手，回答用户的问题。规则：\
         1) 若下方提供了语料材料，只使用与问题直接相关的部分作答，引用处在句末标注 [来源: 文件名]；\
         与问题无关的材料直接忽略，不得描述、总结或评价语料库本身；\
         2) 若材料不足以支撑回答，或没有提供材料，先用固定一句开头：「以下回答未得到语料库的充分支撑，属 AI 自身观点。」\
         随后直接基于你自己的知识回答问题本身；\
         3) 严禁输出：语料库结构说明、检索方法与工具建议、许可/版权/署名规则、说话人归属规则——\
         一切与问题本身无关的元信息；\
         4) 全程用中文，直接输出答案正文。";
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

    // 引用过滤：只保留回答中实际标注了 [来源: 文件名] 的条目，与「引用出处」列表对齐；
    // 一条都没引用到（模型改写文件名等情况）时回退保留前 3 条，避免列表为空。
    let cited: Vec<CorpusHit> = hits
        .iter()
        .filter(|h| answer.contains(&h.title))
        .cloned()
        .collect();
    let citations = if cited.is_empty() {
        hits.iter().take(3).cloned().collect()
    } else {
        cited
    };
    Ok(AiAnswer { answer, citations })
}

/// 数据分析主入口（v4.15）：前端组装数据表 → 单次调用 DeepSeek 分析（无检索、无引用）。
/// system 含固定限制：与数据无关的问题只回「该工作区只能回答数据相关的问题。」
#[tauri::command(async)]
pub fn data_analyze_ask(messages: Vec<ChatMsg>, data_text: String) -> Result<String, String> {
    let key = read_data_key()?;
    let (base_url, model) = data_ai_endpoint();

    let system = format!(
        "你是「数据分析」助手。下方表格是用户的每日量化记录\
         （列：日期 | 睡眠时长(小时) | 睡眠质量(1-5) | 入睡时间 | 起床时间 | 体重(kg) | 当日支出(元) | 心情(1-5) | 专注时长(分钟) | 运动步数；\
         空值表示当天未记录）。规则：\
         1) 只回答与这份数据相关的统计、分析、趋势、规律与建议问题；\
         2) 若问题与数据无关，只回复这一句：「该工作区只能回答数据相关的问题。」不作任何其他回答；\
         3) 回答基于数据给具体结论与可行建议，需要时引用具体日期；记录不足时明确说明，不凭空编造数字；\
         4) 全程用中文，直接输出答案正文。\n\n【每日量化记录】\n{data_text}"
    );

    // system + 全部历史（多轮；数据表随每次请求携带最新录入）
    let mut msgs: Vec<serde_json::Value> = vec![serde_json::json!({"role": "system", "content": system})];
    for m in &messages {
        if m.role == "user" || m.role == "assistant" {
            msgs.push(serde_json::json!({"role": m.role, "content": m.content}));
        }
    }
    chat(&base_url, &model, &key, &serde_json::Value::Array(msgs), 0.7)
}

/// 把选中索引卡的 keywords 并入检索关键词（去重；卡 id 未命中或卡无关键词时原样返回）。
/// v4.14：卡 = AI 的检索筛选器——扩词选卡后，选中卡的预定义关键词补充进检索词。
fn merge_card_keywords(keywords: Vec<String>, topics: &Option<Vec<String>>) -> Vec<String> {
    let Some(topics) = topics else { return keywords };
    if topics.is_empty() {
        return keywords;
    }
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json")).unwrap_or_default();
    let cfg = serde_json::from_str::<serde_json::Value>(&text).unwrap_or_default();
    let mut out = keywords;
    for card in cfg
        .get("corpus_topics")
        .and_then(|v| v.as_array())
        .into_iter()
        .flatten()
    {
        let id = card.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if !topics.iter().any(|t| t == id) {
            continue;
        }
        for k in card.get("keywords").and_then(|v| v.as_array()).into_iter().flatten() {
            if let Some(k) = k.as_str() {
                let k = k.trim();
                if !k.is_empty() && !out.iter().any(|x| x == k) {
                    out.push(k.to_string());
                }
            }
        }
    }
    out
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
