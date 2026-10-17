// v4.22 · 窗口一体化与生命周期（§2.11）：
// - 关闭语义统一收口：拦截 WindowEvent::CloseRequested，按 config.json 的 close_behavior
//   执行「直接退出 / 最小化到托盘 / 询问前端」三态；
// - 托盘驻留：右下角系统托盘图标，左键唤回主窗口，右键菜单「显示主窗口 / 退出应用」；
// - 退出路径：ALLOW_EXIT 标志绕过 prevent_close（前端「直接退出」与托盘「退出应用」共用）。
// 设计红线：托盘驻留只隐藏窗口、不销毁 WebView —— 对话会话（内存态）因此不丢失。

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window};

use crate::fs_cmds;

/// 允许退出的标志：拦截器见其为 true 则放行 close（由 app_exit / 托盘退出置位）。
static ALLOW_EXIT: AtomicBool = AtomicBool::new(false);

/// 关闭行为默认值（首次关闭询问前端弹窗，§2.11-B）。
pub const BEHAVIOR_ASK: &str = "ask";
pub const BEHAVIOR_EXIT: &str = "exit";
pub const BEHAVIOR_TRAY: &str = "tray";

/* ---- config.json：close_behavior 读写（合并写回，保留其他字段） ---- */

fn config_path() -> PathBuf {
    fs_cmds::data_root().join("config.json")
}

/// 读取关闭行为偏好；缺省或非法值一律回落 `ask`。
pub fn close_behavior() -> String {
    let text = std::fs::read_to_string(config_path()).unwrap_or_default();
    let v: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
    match v.get("close_behavior").and_then(|x| x.as_str()) {
        Some(BEHAVIOR_EXIT) => BEHAVIOR_EXIT.to_string(),
        Some(BEHAVIOR_TRAY) => BEHAVIOR_TRAY.to_string(),
        _ => BEHAVIOR_ASK.to_string(),
    }
}

/// 写入关闭行为偏好（仅接受 ask/exit/tray，防任意值注入）。
#[tauri::command(async)]
pub fn close_behavior_set(behavior: String) -> Result<(), String> {
    let value = behavior.trim();
    if ![BEHAVIOR_ASK, BEHAVIOR_EXIT, BEHAVIOR_TRAY].contains(&value) {
        return Err(format!("非法关闭行为：{behavior}"));
    }
    let path = config_path();
    let text = std::fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
    let mut cfg: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({}));
    cfg["close_behavior"] = serde_json::Value::String(value.to_string());
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

/// 读取关闭行为偏好（前端启动时同步设置页与关闭弹窗状态）。
#[tauri::command(async)]
pub fn close_behavior_get() -> String {
    close_behavior()
}

/* ---- 窗口动作 ---- */

/// 退出应用（绕过 close 拦截；前端「直接退出」与托盘「退出应用」共用）。
#[tauri::command(async)]
pub fn app_exit(app: AppHandle) {
    ALLOW_EXIT.store(true, Ordering::SeqCst);
    app.exit(0);
}

/// 隐藏主窗口到系统托盘（进程继续运行，会话不丢）。
#[tauri::command(async)]
pub fn hide_to_tray(window: Window) {
    let _ = window.hide();
}

/// 显示主窗口并聚焦（托盘左键 / 右键「显示主窗口」）。
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// 关闭意图统一分发（lib.rs 的 WindowEvent::CloseRequested 调用）。
pub fn on_close_requested(window: &Window, api: &tauri::CloseRequestApi) {
    if ALLOW_EXIT.load(Ordering::SeqCst) {
        return; // 已决定退出 → 放行
    }
    api.prevent_close();
    match close_behavior().as_str() {
        BEHAVIOR_EXIT => {
            ALLOW_EXIT.store(true, Ordering::SeqCst);
            window.app_handle().exit(0);
        }
        BEHAVIOR_TRAY => {
            let _ = window.hide();
        }
        // 首次（或未记忆）→ 交给前端弹「关闭方式」Modal
        _ => {
            let _ = window.emit("close-requested", ());
        }
    }
}

/* ---- 系统托盘 ---- */

/// 建立托盘图标：左键唤回主窗口；右键菜单「显示主窗口 / 退出应用」。
/// 图标复用窗口默认图标（tauri.conf bundle.icon），免额外资源解码依赖。
pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)
        .map_err(|e| format!("托盘菜单项创建失败：{e}"))?;
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)
        .map_err(|e| format!("托盘菜单项创建失败：{e}"))?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])
        .map_err(|e| format!("托盘菜单创建失败：{e}"))?;

    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("CompassZha · 人生仪表盘")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "quit" => {
                ALLOW_EXIT.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app).map_err(|e| format!("托盘创建失败：{e}"))?;
    Ok(())
}
