// 阶段 1 · 主工程：数据层 commands 已接入（fs_cmds），不再是纯 UI 壳。
// v4.10：git_sync 接入 GitHub 私密仓同步（设置页配置 + PAT 入系统密钥链）。
// v4.12：语料检索（corpus_search）、AI 对话（ai_chat）、索引卡管理（config_topics）。
mod ai_chat;
mod config_topics;
mod corpus_search;
mod fs_cmds;
mod git_sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            fs_cmds::bootstrap();
            Ok(())
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
            fs_cmds::open_url_https,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
