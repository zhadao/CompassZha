// 外观偏好（v4.17 · UI/美术大改）：config.json appearance 对象的读写命令。
// - accent（blue/red/yellow/green 主题色）、mode（light/dark 明暗）、splash（开屏动画开关）；
// - 均为非敏感偏好；合并写回保留其他字段；异步命令（性能红线 v4.5）。

use crate::fs_cmds;

/// 读取外观偏好（缺失或非法字段回默认 blue/light/true）。
#[tauri::command(async)]
pub fn appearance_get() -> Result<serde_json::Value, String> {
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json"))
        .map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    let app = cfg.get("appearance").cloned().unwrap_or_else(default_value);
    Ok(normalize(app))
}

/// 保存外观偏好（整组替换，字段校验后合并写回）。
#[tauri::command(async)]
pub fn appearance_set(appearance: serde_json::Value) -> Result<(), String> {
    let normalized = normalize(appearance);
    let path = fs_cmds::data_root().join("config.json");
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let mut cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    cfg["appearance"] = normalized;
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

/// 默认外观（与前端 DEFAULT_APPEARANCE 一致）。
fn default_value() -> serde_json::Value {
    serde_json::json!({ "accent": "blue", "mode": "light", "splash": true })
}

/// 校验并规范化外观对象：非法/缺失字段回默认值。
fn normalize(v: serde_json::Value) -> serde_json::Value {
    let accent = v
        .get("accent")
        .and_then(|x| x.as_str())
        .filter(|s| matches!(*s, "blue" | "red" | "yellow" | "green"))
        .unwrap_or("blue");
    let mode = v
        .get("mode")
        .and_then(|x| x.as_str())
        .filter(|s| matches!(*s, "light" | "dark"))
        .unwrap_or("light");
    let splash = v.get("splash").and_then(|x| x.as_bool()).unwrap_or(true);
    serde_json::json!({ "accent": accent, "mode": mode, "splash": splash })
}
