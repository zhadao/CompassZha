// GitHub 私密仓同步（v4.10 前移执行，检查点 5.1/5.2）：
// - config.json 只存非敏感字段（enabled / remote / branch / last_sync）；
// - PAT 只存 Windows 凭据管理器（keyring，SPEC-012），绝不写入任何文件或仓库；
// - 推送时经 `git -c http.extraheader=...` 一次性注入（不落盘、不进 .git/config）；
// - 本软件 MIT 开源：不内置任何默认凭据或仓库地址，全部由用户在设置页输入。

use serde::Serialize;
use std::path::Path;

use crate::fs_cmds;

/// keyring 条目（service/account 固定；对应凭据管理器内一条 Generic 凭据）
const KEYRING_SERVICE: &str = "CompassZha";
const KEYRING_ACCOUNT: &str = "github_pat";

/// 设置页同步配置（git_sync_get_config 返回；字段与前端 GitSyncConfig 接口一一对应）
#[derive(Serialize)]
pub struct GitSyncConfig {
    pub enabled: bool,
    pub remote: String,
    pub branch: String,
    pub token_saved: bool,
    pub last_sync: Option<u64>,
    pub data_root: String,
}

/* ---- config.json 的 git 对象读写（合并写回，保留其他字段） ---- */

fn read_git_cfg(root: &Path) -> serde_json::Value {
    let text = std::fs::read_to_string(root.join("config.json")).unwrap_or_default();
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .and_then(|v| v.get("git").cloned())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_git_cfg(root: &Path, git: &serde_json::Value) -> Result<(), String> {
    let path = root.join("config.json");
    let text =
        std::fs::read_to_string(&path).map_err(|e| format!("读取 config.json 失败：{e}"))?;
    let mut cfg: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("解析 config.json 失败：{e}"))?;
    cfg["git"] = git.clone();
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| format!("序列化失败：{e}"))? + "\n";
    std::fs::write(&path, out).map_err(|e| format!("写入 config.json 失败：{e}"))
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/* ---- PAT 密钥链（SPEC-012：只入系统凭据管理器） ---- */

fn token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("打开系统凭据管理器失败：{e}"))
}

fn read_token() -> Result<String, String> {
    token_entry()?
        .get_password()
        .map_err(|e| format!("读取访问令牌失败：{e}"))
}

fn token_saved() -> bool {
    token_entry().ok().and_then(|e| e.get_password().ok()).is_some()
}

/* ---- 推送（extraheader 一次性注入 PAT，绝不落盘） ---- */

/// 手写 base64（只为编码一条短 ASCII 串，避免为此引入依赖）
fn b64(s: &str) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let b = s.as_bytes();
    let mut out = String::with_capacity(b.len().div_ceil(3) * 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16
            | (c.get(1).copied().unwrap_or(0) as u32) << 8
            | (c.get(2).copied().unwrap_or(0) as u32);
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    out
}

/// 推送 origin/<branch>。错误信息双保险过滤令牌（PAT 绝不进入 UI/日志）。
fn push(root: &Path, branch: &str, token: &str) -> Result<(), String> {
    let secret = b64(&format!("x-access-token:{token}"));
    let auth = format!("http.extraheader=AUTHORIZATION: basic {secret}");
    let out = fs_cmds::git(&["-c", &auth, "push", "origin", branch])
        .current_dir(root)
        .output()
        .map_err(|e| format!("git push 无法启动：{e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let safe = err.replace(&secret, "<已隐藏>").replace(token, "<已隐藏>");
        return Err(format!("推送失败：{safe}"));
    }
    Ok(())
}

/* ---- Tauri commands（全部 async：阻塞体由运行时放线程池，v4.5 红线） ---- */

#[tauri::command(async)]
pub fn git_sync_get_config() -> Result<GitSyncConfig, String> {
    let root = fs_cmds::data_root();
    let g = read_git_cfg(&root);
    Ok(GitSyncConfig {
        enabled: g.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false),
        remote: g.get("remote").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        branch: g.get("branch").and_then(|v| v.as_str()).unwrap_or("main").to_string(),
        token_saved: token_saved(),
        last_sync: g.get("last_sync").and_then(|v| v.as_u64()),
        data_root: root.to_string_lossy().to_string(),
    })
}

/// 保存同步设置。PAT 语义：Some(非空)=写入密钥链 / Some("")=清除 / None=保持不动。
#[tauri::command(async)]
pub fn git_sync_set_config(
    enabled: bool,
    remote: String,
    branch: String,
    token: Option<String>,
) -> Result<(), String> {
    let root = fs_cmds::data_root();
    let remote = remote.trim().to_string();
    let branch = {
        let b = branch.trim();
        if b.is_empty() { "main".to_string() } else { b.to_string() }
    };
    if enabled && !remote.is_empty() && !remote.starts_with("https://") {
        return Err("仓库地址必须以 https:// 开头（当前仅支持 GitHub HTTPS 推送）".into());
    }

    match token.as_deref().map(str::trim) {
        Some(t) if !t.is_empty() => token_entry()?
            .set_password(t)
            .map_err(|e| format!("令牌写入系统凭据管理器失败：{e}"))?,
        Some(_) => {
            // 显式清除（前端仅「清除令牌」按钮会传空串）
            if token_saved() {
                token_entry()?
                    .delete_credential()
                    .map_err(|e| format!("清除令牌失败：{e}"))?;
            }
        }
        None => {}
    }

    let mut g = read_git_cfg(&root);
    g["enabled"] = serde_json::json!(enabled);
    g["remote"] = serde_json::json!(remote);
    g["branch"] = serde_json::json!(branch);
    write_git_cfg(&root, &g)?;

    // 维护 origin 远端（仅纯 URL，绝不携带令牌）
    if !remote.is_empty() {
        let has = fs_cmds::git(&["remote", "get-url", "origin"])
            .current_dir(&root)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if has {
            fs_cmds::run_git(&root, &["remote", "set-url", "origin", remote.as_str()])?;
        } else {
            fs_cmds::run_git(&root, &["remote", "add", "origin", remote.as_str()])?;
        }
    }
    Ok(())
}

/// 立即同步：先把未提交变更落一笔本地提交（复用既有逻辑），再推送，成功后记 last_sync。
#[tauri::command(async)]
pub fn git_sync_now() -> Result<String, String> {
    let root = fs_cmds::data_root();
    let g = read_git_cfg(&root);
    let remote = g.get("remote").and_then(|v| v.as_str()).unwrap_or("");
    let branch =
        g.get("branch").and_then(|v| v.as_str()).unwrap_or("main").to_string();
    if remote.is_empty() {
        return Err("尚未配置仓库地址——请先在设置页填写并保存".into());
    }
    let token = read_token()
        .map_err(|_| "尚未保存 GitHub 访问令牌（PAT）——请先在设置页输入并保存".to_string())?;

    let _ = fs_cmds::commit_all(&root, "手动同步".to_string());
    push(&root, &branch, &token)?;

    let mut g2 = read_git_cfg(&root);
    g2["last_sync"] = serde_json::json!(now_secs());
    write_git_cfg(&root, &g2)?;
    Ok("推送成功".to_string())
}

/// git_auto_commit 提交成功后调用（crate 内）：enabled 且配置齐全则静默推送。
/// 任何失败只 eprintln，绝不阻断保存主流程——漏推的提交由下次提交或手动同步补上。
pub(crate) fn push_if_enabled(root: &Path) {
    let g = read_git_cfg(root);
    let enabled = g.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
    let remote = g.get("remote").and_then(|v| v.as_str()).unwrap_or("");
    let branch = g
        .get("branch")
        .and_then(|v| v.as_str())
        .unwrap_or("main")
        .to_string();
    if !enabled || remote.is_empty() {
        return;
    }
    let Ok(token) = read_token() else {
        eprintln!("[git_sync] 已启用同步但未保存 PAT，跳过推送");
        return;
    };
    match push(root, &branch, &token) {
        Ok(()) => {
            let mut g2 = read_git_cfg(root);
            g2["last_sync"] = serde_json::json!(now_secs());
            if let Err(e) = write_git_cfg(root, &g2) {
                eprintln!("[git_sync] last_sync 更新失败：{e}");
            }
        }
        Err(e) => eprintln!("[git_sync] 自动推送失败（下次提交补推）：{e}"),
    }
}
