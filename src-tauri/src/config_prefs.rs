// 阶段 1（A-3 / A-4 / A-5 / A-6 / A-7）：config.json 的 calendar（日历时段 / 缩放档位 / 刻度）与 ui（详情栏按分区记忆 / 日程列显隐）读写命令。
// - 两个结构均带 serde 默认值：老 config.json 缺这些键时仍能正常加载（不报错）；
// - 合并写回保留其他顶层字段；写回时把顶层 version 补到 6（SPEC-003 老配置升级）；
// - 均为非敏感偏好；一律异步命令（SPEC-107）。

use crate::fs_cmds;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A-5：日历缩放的上下限 = 1 小时占多少像素（像绘图软件一样缩放视图，不改时间格粒度）。
/// 实测锚点：默认 175（1 小时）、58（3 小时）、525（20 分钟）；
/// 下限 17 特意更粗，保证用户在设置里自定的任意时段（乃至 24 小时）都能一屏放完。
/// v4.39：档位表只服务前端 Ctrl+滚轮跳档，后端只负责把值夹进区间（顶部 −/+ 按钮走 5% 连续值）。
const PX_PER_HOUR_MIN: u32 = 17;
const PX_PER_HOUR_MAX: u32 = 525;

/// A-6：刻度规则（config.json calendar.ticks；缺省每 1 小时一横线、无指定时刻）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CalendarTicks {
    /// 每 N 小时一条横线；0 = 取消该方式（取值 ∈ {0,1,2,3,4,6}）
    pub every_hours: u32,
    /// 指定时刻刻度 HH:mm 列表；空 = 取消该方式
    pub times: Vec<String>,
}

impl Default for CalendarTicks {
    fn default() -> Self {
        Self {
            every_hours: 1,
            times: Vec::new(),
        }
    }
}

/// 日历偏好（config.json calendar 对象；缺省 06:00–24:00 / 1 小时 175px / 每 1 小时一横线）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CalendarConfig {
    pub slot_min: String,
    pub slot_max: String,
    /// A-5：缩放档位 = 1 小时占多少像素
    pub px_per_hour: u32,
    /// A-6：刻度规则
    pub ticks: CalendarTicks,
}

impl Default for CalendarConfig {
    fn default() -> Self {
        Self {
            slot_min: "06:00".to_string(),
            slot_max: "24:00".to_string(),
            px_per_hour: 175,
            ticks: CalendarTicks::default(),
        }
    }
}

/// 界面偏好（config.json ui 对象；A-3 详情栏按分区记忆 / A-7 日程预览列显隐）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UiConfig {
    pub detail_by_section: BTreeMap<String, bool>,
    /// A-7：日历左侧「日程预览列」是否显示
    pub calendar_daily_visible: bool,
    /// D-4b：日历视图模式 `timeline`（时间轴）/ `todo`（待办卡片）
    pub calendar_view_mode: String,
    /// D-8②：隆中对首开引导是否已看过（看过即不再弹）
    pub chat_guide_seen: bool,
}

impl Default for UiConfig {
    /// A-3 缺省：今日 / 日历 / 人生板块 = 展开；番茄钟 / 隆中对 / 设置 = 收起。
    /// R-1c（v4.42）：`dashboard` 退出可显隐集合——键仍写进缺省表（false）以兼容老 config，但不再被读取。
    /// A-7 缺省：日程预览列显示。D-4b 缺省：时间轴视图。D-8② 缺省：未看过引导。
    fn default() -> Self {
        let mut detail_by_section = BTreeMap::new();
        for s in ["today", "calendar", "life"] {
            detail_by_section.insert(s.to_string(), true);
        }
        for s in ["dashboard", "pomodoro", "chat", "settings"] {
            detail_by_section.insert(s.to_string(), false);
        }
        Self {
            detail_by_section,
            calendar_daily_visible: true,
            calendar_view_mode: "timeline".to_string(),
            chat_guide_seen: false,
        }
    }
}

/// D-4b：日历视图模式归一（仅 `todo` 例外，其余一律 `timeline`）。
fn norm_calendar_view_mode(s: &str) -> String {
    if s.trim() == "todo" {
        "todo".to_string()
    } else {
        "timeline".to_string()
    }
}

/// A-3：允许记忆详情栏的分区（与前端 DETAIL_SECTIONS 一致：今日 / 日历 / 人生板块）。
/// R-1c（v4.42）：`dashboard` 移出——仪表盘右栏已无内容、不再有详情栏可记忆。
const DETAIL_SECTIONS: [&str; 3] = ["today", "calendar", "life"];

/// D-1（v4.40 / E-1 v4.41）：可折叠的指标字段（与前端 MetricsForm 的字段表一致）。
/// v4.41：`sleep_quality` 由「不参与」改为参与（7 → 8 项）；`focus_minutes`（番茄钟写入）仍不参与。
const METRIC_FIELDS: [&str; 8] = [
    "sleep_hours",
    "sleep_quality",
    "sleep_bedtime",
    "sleep_wake",
    "weight_kg",
    "spend_total",
    "mood",
    "steps",
];

fn default_pinned() -> Vec<String> {
    METRIC_FIELDS.iter().map(|s| s.to_string()).collect()
}

/// D-1（v4.40）：指标表单「常显」集合（config.json metrics.pinned；缺省 = 7 项全部常显）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MetricsConfig {
    #[serde(default = "default_pinned")]
    pub pinned: Vec<String>,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            pinned: default_pinned(),
        }
    }
}

/// D-1：归一化 pinned——剔除未知字段、按字段表顺序排列（空数组 = 全部收进「更多指标」，不回落默认）。
fn norm_pinned(v: Vec<String>) -> Vec<String> {
    METRIC_FIELDS
        .iter()
        .filter(|k| v.iter().any(|x| x.trim() == **k))
        .map(|s| (*s).to_string())
        .collect()
}

/// 解析 HH:mm（允许 24:00）；非法则回退默认值。
fn norm_time(s: &str, fallback: &str) -> String {
    let t = s.trim();
    if t == "24:00" {
        return t.to_string();
    }
    let b = t.as_bytes();
    let ok = b.len() == 5
        && b[2] == b':'
        && b[0].is_ascii_digit()
        && b[1].is_ascii_digit()
        && b[3].is_ascii_digit()
        && b[4].is_ascii_digit()
        && (b[0] - b'0') * 10 + (b[1] - b'0') <= 23
        && (b[3] - b'0') * 10 + (b[4] - b'0') <= 59;
    if ok {
        t.to_string()
    } else {
        fallback.to_string()
    }
}

/// A-5 v4.39：把任意值夹到 [17, 525]（**不再吸附档位**，故可存 183 / 197 这类中间值）。
fn norm_px_per_hour(n: u32) -> u32 {
    n.clamp(PX_PER_HOUR_MIN, PX_PER_HOUR_MAX)
}

/// A-6：刻度间隔小时数只允许 {1,2,3,4,6}，其余（含 0）一律按 0 = 取消处理。
fn norm_every_hours(h: u32) -> u32 {
    match h {
        1 | 2 | 3 | 4 | 6 => h,
        _ => 0,
    }
}

/// A-6：归一刻度时刻列表（复用 norm_time 校验 → 剔除非法、去重、按时间升序）。
fn norm_times(v: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in v {
        let t = norm_time(&raw, "");
        if t.is_empty() {
            continue;
        }
        if !out.contains(&t) {
            out.push(t);
        }
    }
    out.sort();
    out
}

fn read_config() -> Result<serde_json::Value, String> {
    let text = std::fs::read_to_string(fs_cmds::data_root().join("config.json"))
        .map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    if v.is_object() {
        Ok(v)
    } else {
        Err("config.json 顶层不是对象，已忽略（前端回退默认值）".to_string())
    }
}

fn write_config(cfg: &serde_json::Value) -> Result<(), String> {
    let path = fs_cmds::data_root().join("config.json");
    let out = serde_json::to_string_pretty(cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

/// 读取日历偏好（缺键 / 非法字段由 serde 默认值与 norm_* 兜底）。
#[tauri::command(async)]
pub fn calendar_get_config() -> Result<CalendarConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("calendar")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let parsed: CalendarConfig = serde_json::from_value(raw).unwrap_or_default();
    Ok(CalendarConfig {
        slot_min: norm_time(&parsed.slot_min, "06:00"),
        slot_max: norm_time(&parsed.slot_max, "24:00"),
        px_per_hour: norm_px_per_hour(parsed.px_per_hour),
        ticks: CalendarTicks {
            every_hours: norm_every_hours(parsed.ticks.every_hours),
            times: norm_times(parsed.ticks.times),
        },
    })
}

/// 保存日历偏好（设置页一次性提交时段 + 缩放档位 + 刻度规则；合并写回；version 补 6）。
#[tauri::command(async)]
pub fn calendar_set_config(
    slot_min: String,
    slot_max: String,
    px_per_hour: u32,
    ticks: CalendarTicks,
) -> Result<(), String> {
    let value = CalendarConfig {
        slot_min: norm_time(&slot_min, "06:00"),
        slot_max: norm_time(&slot_max, "24:00"),
        px_per_hour: norm_px_per_hour(px_per_hour),
        ticks: CalendarTicks {
            every_hours: norm_every_hours(ticks.every_hours),
            times: norm_times(ticks.times),
        },
    };
    let mut cfg = read_config()?;
    cfg["calendar"] = serde_json::to_value(value).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// A-5：仅更新缩放档位（日历页 ± / Ctrl+滚轮快速保存；保留 slot_min / slot_max / ticks 现配置）。
#[tauri::command(async)]
pub fn calendar_set_px_per_hour(px_per_hour: u32) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg
        .get("calendar")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let mut cal: CalendarConfig = serde_json::from_value(raw).unwrap_or_default();
    cal.px_per_hour = norm_px_per_hour(px_per_hour);
    cfg["calendar"] = serde_json::to_value(cal).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// 读取界面偏好（缺键由 serde 默认值兜底）。
#[tauri::command(async)]
pub fn ui_get_config() -> Result<UiConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("ui")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let mut ui: UiConfig = serde_json::from_value(raw).unwrap_or_default();
    ui.calendar_view_mode = norm_calendar_view_mode(&ui.calendar_view_mode);
    Ok(ui)
}

/// 写入某分区详情栏显隐（合并写回，保留其他分区；version 补 6）。
#[tauri::command(async)]
pub fn ui_set_detail_section(section: String, visible: bool) -> Result<(), String> {
    if !DETAIL_SECTIONS.contains(&section.as_str()) {
        return Err(format!("不支持记忆详情栏的分区：{section}"));
    }
    let mut cfg = read_config()?;
    let raw = cfg.get("ui").cloned().unwrap_or_else(|| serde_json::json!({}));
    let mut ui: UiConfig = serde_json::from_value(raw).unwrap_or_default();
    ui.detail_by_section.insert(section, visible);
    cfg["ui"] = serde_json::to_value(ui).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// A-7：写入日历「日程预览列」显隐（合并写回，保留其他 ui 字段；version 补 6）。
#[tauri::command(async)]
pub fn ui_set_calendar_daily(visible: bool) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg.get("ui").cloned().unwrap_or_else(|| serde_json::json!({}));
    let mut ui: UiConfig = serde_json::from_value(raw).unwrap_or_default();
    ui.calendar_daily_visible = visible;
    cfg["ui"] = serde_json::to_value(ui).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// D-4b：写入日历视图模式 `timeline` / `todo`（合并写回，保留其他 ui 字段；version 补 6）。
#[tauri::command(async)]
pub fn ui_set_calendar_view_mode(mode: String) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg.get("ui").cloned().unwrap_or_else(|| serde_json::json!({}));
    let mut ui: UiConfig = serde_json::from_value(raw).unwrap_or_default();
    ui.calendar_view_mode = norm_calendar_view_mode(&mode);
    cfg["ui"] = serde_json::to_value(ui).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// D-8②：标记隆中对首开引导已看过（合并写回，保留其他 ui 字段；version 补 6）。
#[tauri::command(async)]
pub fn ui_set_chat_guide_seen(seen: bool) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg.get("ui").cloned().unwrap_or_else(|| serde_json::json!({}));
    let mut ui: UiConfig = serde_json::from_value(raw).unwrap_or_default();
    ui.chat_guide_seen = seen;
    cfg["ui"] = serde_json::to_value(ui).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// E-2：每周罗盘简报设置（config.json briefing 对象）。
/// 缺省 `enabled:false`（P-5：不主动打扰），用户开启后按 `weekday` + `time` 触发。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BriefingConfig {
    /// 是否启用每周简报
    pub enabled: bool,
    /// 周日 = 0 … 周六 = 6（与 JS `Date.getDay()` 一致）
    pub weekday: u32,
    /// 触发时刻 HH:mm
    pub time: String,
    /// 上次弹出时刻（ISO 本地时间 `YYYY-MM-DDTHH:mm`；未弹出过 = null）
    pub last_shown: Option<String>,
}

impl Default for BriefingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            weekday: 0,
            time: "20:00".to_string(),
            last_shown: None,
        }
    }
}

/// E-2：周几归一（只接受 0–6，其余回落周日）。
fn norm_weekday(n: u32) -> u32 {
    if n <= 6 {
        n
    } else {
        0
    }
}

/// E-2：`last_shown` 归一（去空白；空串 = 未弹出过）。
fn norm_last_shown(s: Option<String>) -> Option<String> {
    match s {
        Some(v) if !v.trim().is_empty() => Some(v.trim().to_string()),
        _ => None,
    }
}

/// E-2：读取每周简报设置（缺键 / 非法字段回落默认值）。
#[tauri::command(async)]
pub fn briefing_get_config() -> Result<BriefingConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("briefing")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let parsed: BriefingConfig = serde_json::from_value(raw).unwrap_or_default();
    Ok(BriefingConfig {
        enabled: parsed.enabled,
        weekday: norm_weekday(parsed.weekday),
        time: norm_time(&parsed.time, "20:00"),
        last_shown: norm_last_shown(parsed.last_shown),
    })
}

/// E-2：保存每周简报设置（合并写回，保留其他顶层字段；version 补 6）。
/// `last_shown` 由简报弹出时单独写，本命令不改它（避免设置页误清补发状态）。
#[tauri::command(async)]
pub fn briefing_set_config(enabled: bool, weekday: u32, time: String) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg
        .get("briefing")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let mut b: BriefingConfig = serde_json::from_value(raw).unwrap_or_default();
    b.enabled = enabled;
    b.weekday = norm_weekday(weekday);
    b.time = norm_time(&time, "20:00");
    cfg["briefing"] = serde_json::to_value(b).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// E-2：记录上次简报弹出时刻（用于启动补发判定；空串 = 清空）。
#[tauri::command(async)]
pub fn briefing_set_last_shown(last_shown: Option<String>) -> Result<(), String> {
    let mut cfg = read_config()?;
    let raw = cfg
        .get("briefing")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let mut b: BriefingConfig = serde_json::from_value(raw).unwrap_or_default();
    b.last_shown = norm_last_shown(last_shown);
    cfg["briefing"] = serde_json::to_value(b).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/// D-1（v4.40）：读取指标「常显」偏好（缺键由 serde 默认值兜底 = 7 项全部常显）。
#[tauri::command(async)]
pub fn metrics_get_config() -> Result<MetricsConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("metrics")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let parsed: MetricsConfig = serde_json::from_value(raw).unwrap_or_default();
    Ok(MetricsConfig {
        pinned: norm_pinned(parsed.pinned),
    })
}

/// D-1（v4.40）：写入指标「常显」集合（合并写回，保留其他顶层字段；version 补 6）。
#[tauri::command(async)]
pub fn metrics_set_pinned(pinned: Vec<String>) -> Result<(), String> {
    let value = MetricsConfig {
        pinned: norm_pinned(pinned),
    };
    let mut cfg = read_config()?;
    cfg["metrics"] = serde_json::to_value(value).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/* ---- E-1（v4.41）数据追踪项：config.json trackers 数组 ---- */

/// 内置追踪项键（含番茄钟写入的 `focus_minutes`）：内置项默认以代码常量表为准。
const BUILTIN_TRACKER_KEYS: [&str; 9] = [
    "sleep_hours",
    "sleep_quality",
    "sleep_bedtime",
    "sleep_wake",
    "weight_kg",
    "spend_total",
    "mood",
    "focus_minutes",
    "steps",
];

/// E-1：一个追踪项。自定义项落 `.key = x_<slug>`；内置项仅在「隐藏内置项」时以
/// `builtin = true` 的条目承载（只记 key / hidden，其余运行期由前端常量表补全）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TrackerDef {
    pub key: String,
    pub name: String,
    pub unit: String,
    pub kind: String,
    pub direction: String,
    pub max: Option<u32>,
    pub step: Option<String>,
    pub decimals: Option<u32>,
    pub builtin: bool,
    pub hidden: bool,
}

impl Default for TrackerDef {
    fn default() -> Self {
        Self {
            key: String::new(),
            name: String::new(),
            unit: String::new(),
            kind: "number".to_string(),
            direction: "up".to_string(),
            max: None,
            step: None,
            decimals: None,
            builtin: false,
            hidden: false,
        }
    }
}

/// E-1：追踪项配置（缺省空数组 = 只有内置项）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TrackersConfig {
    pub trackers: Vec<TrackerDef>,
}

impl Default for TrackersConfig {
    fn default() -> Self {
        Self {
            trackers: Vec::new(),
        }
    }
}

/// E-1：自定义键规则 `^x_[a-z][a-z0-9_]{0,23}$`（长度含前缀 3..26）。
fn valid_custom_key(k: &str) -> bool {
    let b = k.as_bytes();
    if b.len() < 3 || b.len() > 26 {
        return false;
    }
    if b[0] != b'x' || b[1] != b'_' {
        return false;
    }
    let first = b[2];
    if !first.is_ascii_lowercase() {
        return false;
    }
    b[2..]
        .iter()
        .all(|&c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_')
}

fn norm_kind(k: &str) -> String {
    match k {
        "level" | "bool" | "time" => k.to_string(),
        _ => "number".to_string(),
    }
}

fn norm_direction(d: &str) -> String {
    if d == "down" {
        "down".to_string()
    } else {
        "up".to_string()
    }
}

/// E-1：归一化追踪项——剔除非法键、去重；自定义项保留全字段（level 夹 2..10），
/// 内置项只保留 key / hidden（其余以代码常量表为准）。
fn norm_trackers(list: Vec<TrackerDef>) -> Vec<TrackerDef> {
    let mut out: Vec<TrackerDef> = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    for t in list {
        let key = t.key.trim().to_string();
        if key.is_empty() || seen.iter().any(|k| k == &key) {
            continue;
        }
        if t.builtin {
            if !BUILTIN_TRACKER_KEYS.contains(&key.as_str()) {
                continue;
            }
            seen.push(key.clone());
            out.push(TrackerDef {
                key,
                hidden: t.hidden,
                builtin: true,
                ..Default::default()
            });
            continue;
        }
        if !valid_custom_key(&key) {
            continue;
        }
        let kind = norm_kind(&t.kind);
        let max = if kind == "level" {
            Some(t.max.unwrap_or(5).clamp(2, 10))
        } else {
            None
        };
        seen.push(key.clone());
        out.push(TrackerDef {
            key,
            name: t.name.trim().to_string(),
            unit: t.unit.trim().to_string(),
            kind,
            direction: norm_direction(&t.direction),
            max,
            step: t.step.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            decimals: t.decimals,
            builtin: false,
            hidden: t.hidden,
        });
    }
    out
}

/// E-1：读取追踪项配置（缺键 = 只有内置项；非法项由 norm_trackers 剔除）。
#[tauri::command(async)]
pub fn trackers_get_config() -> Result<TrackersConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("trackers")
        .cloned()
        .unwrap_or_else(|| serde_json::json!([]));
    let parsed: Vec<TrackerDef> = serde_json::from_value(raw).unwrap_or_default();
    Ok(TrackersConfig {
        trackers: norm_trackers(parsed),
    })
}

/// E-1：写入追踪项配置（整组替换；合并写回保留其他顶层字段；version 补 6）。
#[tauri::command(async)]
pub fn trackers_set_config(trackers: Vec<TrackerDef>) -> Result<(), String> {
    let value = TrackersConfig {
        trackers: norm_trackers(trackers),
    };
    let mut cfg = read_config()?;
    cfg["trackers"] = serde_json::to_value(value).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}

/* ---- D-5（v4.41）/ R-1b / R-1d（v4.42）仪表盘：config.json dashboard 对象 ---- */

/// R-1b：视图模式归一（`heatmap` 之外一律 `data`）。
fn norm_view_mode(s: &str) -> String {
    if s.trim() == "heatmap" {
        "heatmap".to_string()
    } else {
        "data".to_string()
    }
}

/// D-5：仪表盘编排（追踪项顺序 / 显隐）；R-1b 增视图模式、R-1d 增热力图顺序。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DashboardConfig {
    /// 追踪项 key 顺序（空 = 前端出默认序）；数据屏的指标卡与趋势曲线共用此序
    pub order: Vec<String>,
    /// 隐藏的追踪项 key（数据保留，仅不呈现）
    pub hidden: Vec<String>,
    /// R-1b：`data`（当日指标卡 + 趋势曲线）/ `heatmap`（板块投入热力图）
    pub view_mode: String,
    /// R-1d：热力图屏的板块顺序（板块 id 列表；未列出的板块按 life 目录序排在其后）
    pub heatmap_order: Vec<String>,
}

impl Default for DashboardConfig {
    fn default() -> Self {
        Self {
            order: Vec::new(),
            hidden: Vec::new(),
            view_mode: "data".to_string(),
            heatmap_order: Vec::new(),
        }
    }
}

/// D-5：编排键归一——去空白 / 去重，且只保留「内置键 / 合法自定义键」。
/// R-1d：伪键 `heatmaps` 已退场（老 config 里的该键在此被自然丢弃）。
fn norm_dashboard_keys(v: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in v {
        let k = raw.trim().to_string();
        if k.is_empty() || out.contains(&k) {
            continue;
        }
        if BUILTIN_TRACKER_KEYS.contains(&k.as_str()) || valid_custom_key(&k) {
            out.push(k);
        }
    }
    out
}

/// R-1d：热力图板块 id 列表归一——去空白 / 去重（板块是否存在由前端按实际 life 目录判定）。
fn norm_heatmap_order(v: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in v {
        let k = raw.trim().to_string();
        if k.is_empty() || out.contains(&k) {
            continue;
        }
        out.push(k);
    }
    out
}

/// D-5：读取仪表盘编排（缺键 = 默认序 / 全显 / 数据屏 / 热力图按目录序）。
#[tauri::command(async)]
pub fn dashboard_get_config() -> Result<DashboardConfig, String> {
    let cfg = read_config()?;
    let raw = cfg
        .get("dashboard")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    let parsed: DashboardConfig = serde_json::from_value(raw).unwrap_or_default();
    Ok(DashboardConfig {
        order: norm_dashboard_keys(parsed.order),
        hidden: norm_dashboard_keys(parsed.hidden),
        view_mode: norm_view_mode(&parsed.view_mode),
        heatmap_order: norm_heatmap_order(parsed.heatmap_order),
    })
}

/// D-5：写入仪表盘编排（合并写回保留其他顶层字段；version 补 6）。
#[tauri::command(async)]
pub fn dashboard_set_config(
    order: Vec<String>,
    hidden: Vec<String>,
    view_mode: String,
    heatmap_order: Vec<String>,
) -> Result<(), String> {
    let value = DashboardConfig {
        order: norm_dashboard_keys(order),
        hidden: norm_dashboard_keys(hidden),
        view_mode: norm_view_mode(&view_mode),
        heatmap_order: norm_heatmap_order(heatmap_order),
    };
    let mut cfg = read_config()?;
    cfg["dashboard"] = serde_json::to_value(value).map_err(|e| format!("序列化失败：{e}"))?;
    cfg["version"] = serde_json::json!(6);
    write_config(&cfg)
}
