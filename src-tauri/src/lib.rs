// 阶段 1 · 主工程：数据层 commands 已接入（fs_cmds），不再是纯 UI 壳。
// v4.10：git_sync 接入 GitHub 私密仓同步（设置页配置 + PAT 入系统密钥链）。
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
