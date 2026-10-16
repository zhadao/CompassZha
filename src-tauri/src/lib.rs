// 应用装配：接入数据层 commands（fs_cmds）。
mod fs_cmds;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
