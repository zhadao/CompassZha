// 索引卡管理（阶段 4 · v4.12）：config.json corpus_topics 的 GUI 读写命令。
// - 8 张卡 = AI 检索前的标签路由（每卡 id/name/keywords/desc；兼容旧两字段卡）；
// - 弹层内已注明「索引卡是 AI 的路由依据，不建议频繁更改」（前端职责）；
// - 仅读写 corpus_topics 数组，合并写回保留其他字段。

use crate::fs_cmds;

/// 读取全部索引卡（原样透传 JSON；前端按可选字段处理）。
#[tauri::command(async)]
pub fn config_get_topics() -> Result<serde_json::Value, String> {
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json"))
        .map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    Ok(cfg.get("corpus_topics").cloned().unwrap_or_else(|| serde_json::json!([])))
}

/// 保存全部索引卡（整组替换；前端保证每卡含 id/name，keywords/desc 可选）。
/// v0.2.0 修复：前端把 keywords 当「逗号分隔文本」绑定（字符串），而检索侧
/// （ai_chat::merge_card_keywords）要求字符串数组——此处统一规范化，避免保存一次就丢关键词。
#[tauri::command(async)]
pub fn config_set_topics(mut topics: serde_json::Value) -> Result<(), String> {
    let arr = topics
        .as_array()
        .ok_or("索引卡数据格式错误（应为数组）")?;
    if arr.is_empty() {
        return Err("至少保留一张索引卡（AI 检索需要路由依据）".into());
    }
    for (i, t) in arr.iter().enumerate() {
        let id_ok = t.get("id").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let name_ok = t.get("name").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        if !id_ok || !name_ok {
            return Err(format!("第 {} 张索引卡缺少 id 或名称", i + 1));
        }
    }
    if let Some(arr) = topics.as_array_mut() {
        for t in arr.iter_mut() {
            normalize_keywords(t);
        }
    }
    let path = fs_cmds::data_root().join("config.json");
    let text = std::fs::read_to_string(&path).map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let mut cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    cfg["corpus_topics"] = topics;
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

/// 把一张卡的 keywords 规范化为字符串数组：
/// 前端输入框把 keywords 当「逗号分隔文本」绑定（字符串），而检索侧
/// （ai_chat::merge_card_keywords）要求字符串数组——此处统一规范化。
fn normalize_keywords(card: &mut serde_json::Value) {
    let Some(v) = card.get("keywords") else { return };
    let arr: Vec<String> = match v {
        serde_json::Value::Array(a) => a
            .iter()
            .filter_map(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        serde_json::Value::String(s) => s
            .split(|c| c == ',' || c == '，' || c == '、' || c == '/' || c == ';' || c == '；')
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect(),
        _ => Vec::new(),
    };
    card["keywords"] = serde_json::json!(arr);
}
