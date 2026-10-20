// 阶段 1 · 主工程：数据层 commands 已接入（fs_cmds），不再是纯 UI 壳。
// v4.10：git_sync 接入 GitHub 私密仓同步（设置页配置 + PAT 入系统密钥链）。
// v4.12：语料检索（corpus_search）、AI 对话（ai_chat）、索引卡管理（config_topics）。
// v4.17：外观偏好（appearance）。
// v4.22：窗口生命周期（win_cmds）——关闭三段式 + 系统托盘驻留 + 打开数据目录。
// v4.26：语料导入（corpus_import）——epub/pdf → md 落 corpus/imported/。
// v4.31：单实例约束（single-instance）——同一时刻仅一个进程/窗口。
use tauri::Manager;

mod ai_chat;
mod appearance;
mod config_prefs;
mod config_topics;
mod corpus_import;
mod corpus_search;
mod fs_cmds;
mod git_sync;
mod win_cmds;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // v4.31 §2.17：单实例约束——必须最先注册。重复启动时不新建进程/窗口，
        // 而是唤回并聚焦已有主窗口（若在托盘中则重新显示）。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // v4.26：官方文件对话框插件（语料转化的文件选择）
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            fs_cmds::bootstrap();
            // v4.22：托盘常驻（图标即窗口默认图标；左键唤回、右键菜单）
            if let Err(e) = win_cmds::setup_tray(app.handle()) {
                eprintln!("[setup] 托盘创建失败（不影响主流程）：{e}");
            }
            Ok(())
        })
        // v4.22：关闭语义收口——按 close_behavior 执行 退出/托盘驻留/询问前端
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                win_cmds::on_close_requested(window, api);
            }
        })
        .invoke_handler(tauri::generate_handler![
            fs_cmds::fs_read,
            fs_cmds::fs_write,
            fs_cmds::fs_append,
            fs_cmds::fs_list_dir,
            fs_cmds::fs_mkdir,
            fs_cmds::fs_delete,
            fs_cmds::fs_exists,
            fs_cmds::fs_rename,
            fs_cmds::fs_reveal,
            fs_cmds::export_data_zip,
            fs_cmds::reveal_path,
            fs_cmds::git_auto_commit,
            git_sync::git_sync_get_config,
            git_sync::git_sync_set_config,
            git_sync::git_sync_now,
            git_sync::git_sync_on_start,
            git_sync::git_sync_tick,
            git_sync::git_ssh_generate_key,
            git_sync::git_test_connection,
            corpus_search::corpus_search,
            ai_chat::ai_get_config,
            ai_chat::ai_set_config,
            ai_chat::ai_ask,
            ai_chat::data_analyze_ask,
            ai_chat::open_corpus_folder,
            config_topics::config_get_topics,
            config_topics::config_set_topics,
            appearance::appearance_get,
            appearance::appearance_set,
            config_prefs::calendar_get_config,
            config_prefs::calendar_set_config,
            config_prefs::calendar_set_px_per_hour,
            config_prefs::ui_get_config,
            config_prefs::ui_set_detail_section,
            config_prefs::ui_set_calendar_daily,
            config_prefs::ui_set_calendar_view_mode,
            config_prefs::ui_set_chat_guide_seen,
            config_prefs::briefing_get_config,
            config_prefs::briefing_set_config,
            config_prefs::briefing_set_last_shown,
            config_prefs::metrics_get_config,
            config_prefs::metrics_set_pinned,
            config_prefs::trackers_get_config,
            config_prefs::trackers_set_config,
            config_prefs::dashboard_get_config,
            config_prefs::dashboard_set_config,
            fs_cmds::open_url_https,
            fs_cmds::open_data_root,
            win_cmds::close_behavior_get,
            win_cmds::close_behavior_set,
            win_cmds::app_exit,
            win_cmds::hide_to_tray,
            corpus_import::import_corpus_file,
            corpus_search::corpus_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
