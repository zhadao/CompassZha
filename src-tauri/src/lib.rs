// 阶段 1 · 主工程：数据层 commands 已接入（fs_cmds），不再是纯 UI 壳。
// v4.10：git_sync 接入 GitHub 私密仓同步（设置页配置 + PAT 入系统密钥链）。
// v4.12：语料检索（corpus_search）、AI 对话（ai_chat）、索引卡管理（config_topics）。
// v4.17：外观偏好（appearance）。
// v4.22：窗口生命周期（win_cmds）——关闭三段式 + 系统托盘驻留 + 打开数据目录。
// v4.26：语料导入（corpus_import）——epub/pdf → md 落 corpus/imported/。
mod ai_chat;
mod appearance;
mod config_topics;
mod corpus_import;
mod corpus_search;
mod fs_cmds;
mod git_sync;
mod win_cmds;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            fs_cmds::open_url_https,
            fs_cmds::open_data_root,
            win_cmds::close_behavior_get,
            win_cmds::close_behavior_set,
            win_cmds::app_exit,
            win_cmds::hide_to_tray,
            corpus_import::import_corpus_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
