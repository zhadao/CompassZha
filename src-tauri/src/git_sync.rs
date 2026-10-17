// 数据同步（v4.10 前移执行，v4.27 扩为三时机 + GitHub/Gitee 双平台）：
// - config.json 只存非敏感字段（platform / remote / branch / on_start / enabled / interval_min / last_sync）；
// - 令牌只存 Windows 凭据管理器（keyring，SPEC-012），绝不写入任何文件或仓库；
// - 推送/拉取时经 `git -c http.extraheader=...` 一次性注入（不落盘、不进 .git/config），
//   且一律设 GIT_TERMINAL_PROMPT=0——认证失败立即返回，不挂在凭据输入提示上；
// - 认证方式：github = `x-access-token:<token>`；gitee = `<仓库地址第一段(用户名)>:<token>`
//   （Gitee 已弃用账号密码，私人令牌替代密码）；
// - 三时机：①打开软件时（on_start，默认开）②每次保存后（enabled，默认关）③定时（interval_min，0=关）；
// - 远端已有历史而本地为全新数据仓时，push 被拒后自动「安全对齐」一次（fetch + reset --soft，
//   只移动 HEAD、不动工作区文件），绝不自动 merge；
// - 本软件 MIT 开源：不内置任何默认凭据或仓库地址，全部由用户在设置页输入。

use serde::Serialize;
use std::path::Path;
use std::process::Output;

use crate::fs_cmds;

/// keyring 条目（service/account 固定；v4.27 起同一账号名同时用于 GitHub PAT 与 Gitee 私人令牌，
/// ——用户按所选平台填入对应平台的令牌，两平台互斥配置）
const KEYRING_SERVICE: &str = "CompassZha";
const KEYRING_ACCOUNT: &str = "github_pat";

const DEFAULT_PLATFORM: &str = "github";
const DEFAULT_BRANCH: &str = "main";
/// 定时同步可选档位（分钟）；0 = 关闭
const INTERVALS: [u32; 5] = [0, 5, 15, 30, 60];

/// 设置页同步配置（git_sync_get_config 返回；字段与前端 GitSyncConfig 接口一一对应）
#[derive(Serialize)]
pub struct GitSyncConfig {
    pub platform: String,
    pub remote: String,
    pub branch: String,
    pub on_start: bool,
    pub enabled: bool,
    pub interval_min: u32,
    pub token_saved: bool,
    pub last_sync: Option<u64>,
    pub data_root: String,
}

/// 归一化后的同步配置（内部流转用）
struct SyncCfg {
    platform: String,
    remote: String,
    branch: String,
    on_start: bool,
    enabled: bool,
    interval_min: u32,
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

/// 读 git 配置并规范化（缺省：github / main / on_start=true / enabled=false / interval=0）
fn read_sync_cfg(root: &Path) -> SyncCfg {
    let g = read_git_cfg(root);
    let str_or = |key: &str, default: &str| -> String {
        let v = g.get(key).and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
        if v.is_empty() { default.to_string() } else { v }
    };
    SyncCfg {
        platform: normalize_platform(&str_or("platform", DEFAULT_PLATFORM)),
        remote: g.get("remote").and_then(|x| x.as_str()).unwrap_or("").trim().to_string(),
        branch: str_or("branch", DEFAULT_BRANCH),
        on_start: g.get("on_start").and_then(|x| x.as_bool()).unwrap_or(true),
        enabled: g.get("enabled").and_then(|x| x.as_bool()).unwrap_or(false),
        interval_min: normalize_interval(g.get("interval_min").and_then(|x| x.as_u64()).unwrap_or(0)),
    }
}

fn normalize_platform(p: &str) -> String {
    match p.trim().to_ascii_lowercase().as_str() {
        "gitee" => "gitee".to_string(),
        _ => DEFAULT_PLATFORM.to_string(),
    }
}

fn normalize_interval(n: u64) -> u32 {
    let n = n as u32;
    if INTERVALS.contains(&n) { n } else { 0 }
}

fn platform_label(platform: &str) -> &'static str {
    if platform == "gitee" { "Gitee 私人令牌" } else { "GitHub 访问令牌（PAT）" }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/* ---- 令牌密钥链（SPEC-012：只入系统凭据管理器） ---- */

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

/* ---- 认证与 git 子进程 ---- */

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

/// 从 https 仓库地址取第一段路径（Gitee 的 Basic 认证用户名）
fn gitee_owner(remote: &str) -> Option<String> {
    let rest = remote.trim().trim_end_matches('/').trim_end_matches(".git");
    let rest = rest.strip_prefix("https://")?;
    let mut seg = rest.split('/');
    let host = seg.next()?;
    if !host.eq_ignore_ascii_case("gitee.com") {
        return None;
    }
    let owner = seg.next().unwrap_or("").trim();
    if owner.is_empty() { None } else { Some(owner.to_string()) }
}

/// 构造 `git -c <...>` 用的认证参数（Basic 一次性注入，绝不落盘）
fn auth_arg(platform: &str, remote: &str, token: &str) -> Result<String, String> {
    let user = if platform == "gitee" {
        gitee_owner(remote).ok_or_else(|| {
            "无法从仓库地址解析出 Gitee 用户名——地址应形如 https://gitee.com/你的用户名/仓库名.git"
                .to_string()
        })?
    } else {
        "x-access-token".to_string()
    };
    Ok(format!(
        "http.extraheader=AUTHORIZATION: basic {}",
        b64(&format!("{user}:{token}"))
    ))
}

/// 过滤令牌后再回显 git 错误（令牌绝不进入 UI / 日志）
fn safe_err(err: &str, auth: &str, token: &str) -> String {
    err.replace(auth, "<已隐藏>").replace(token, "<已隐藏>")
}

/// 在数据根跑 git，并禁用终端凭据提示（认证失败立即返回，不阻塞线程）
fn git_out(root: &Path, args: &[&str]) -> Result<Output, String> {
    fs_cmds::git(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("git 无法启动：{e}"))
}

/// 推送 origin/<branch>
fn push(root: &Path, cfg: &SyncCfg, token: &str) -> Result<(), String> {
    let auth = auth_arg(&cfg.platform, &cfg.remote, token)?;
    let out = git_out(root, &["-c", &auth, "push", "origin", &cfg.branch])?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("推送失败：{}", safe_err(&err, &auth, token)));
    }
    Ok(())
}

/// 推送失败原因是否属于「远端历史与本地不一致」
fn is_reject(err: &str) -> bool {
    let l = err.to_lowercase();
    ["non-fast-forward", "fetch first", "rejected", "已拒绝"]
        .iter()
        .any(|k| l.contains(k))
}

/// 远端已有历史而本地为全新/无关历史时：把远端提交接续为本地基线，再提交本地文件并重推。
/// `reset --soft` 只移动 HEAD，**绝不触碰工作区与文件**；不做 merge。
fn align_and_retry(root: &Path, cfg: &SyncCfg, token: &str) -> Result<(), String> {
    let auth = auth_arg(&cfg.platform, &cfg.remote, token)?;
    let fetched = git_out(root, &["-c", &auth, "fetch", "origin", &cfg.branch])?;
    if !fetched.status.success() {
        let err = String::from_utf8_lossy(&fetched.stderr).trim().to_string();
        return Err(format!(
            "远端仓库已有内容，自动对齐失败（fetch 失败）：{}\n请检查网络，以及令牌是否具备 repo 权限。",
            safe_err(&err, &auth, token)
        ));
    }
    let target = format!("origin/{}", cfg.branch);
    let reset = git_out(root, &["reset", "--soft", &target])?;
    if !reset.status.success() {
        // unborn HEAD（本地尚无任何提交）时 reset 无法定位 HEAD → 直接写入分支引用
        let _ = git_out(root, &["update-ref", &format!("refs/heads/{}", cfg.branch), &target])?;
    }
    fs_cmds::commit_all(root, "对齐远端历史".to_string())?;
    push(root, cfg, token)
}

/// 推送；遭拒（远端历史不一致）时自动安全对齐并重试一次
fn push_with_align(root: &Path, cfg: &SyncCfg, token: &str) -> Result<(), String> {
    match push(root, cfg, token) {
        Ok(()) => Ok(()),
        Err(e) if is_reject(&e) => align_and_retry(root, cfg, token),
        Err(e) => Err(e),
    }
}

/// 记一次上次同步时间
fn touch_last_sync(root: &Path) -> Result<(), String> {
    let mut g = read_git_cfg(root);
    g["last_sync"] = serde_json::json!(now_secs());
    write_git_cfg(root, &g)
}

/// 统一「本地提交 → 推送 → 记 last_sync」（定时/启动/手动同步共用）
fn sync_commit_push(root: &Path, msg: &str, cfg: &SyncCfg, token: &str) -> Result<String, String> {
    let commit = fs_cmds::commit_all(root, msg.to_string())?;
    if commit == "skipped:git-missing" {
        return Err("本机未安装 git（或不在 PATH 中），无法同步".to_string());
    }
    push_with_align(root, cfg, token)?;
    touch_last_sync(root)?;
    Ok(if commit == "committed" {
        "已提交并推送".to_string()
    } else {
        "推送成功（本地无新变更，仅同步已有提交）".to_string()
    })
}

/// 读令牌；缺失时给出与平台对应的提示文案
fn require_token(cfg: &SyncCfg) -> Result<String, String> {
    read_token().map_err(|_| {
        format!(
            "尚未保存{}——请先在设置页输入并保存",
            platform_label(&cfg.platform)
        )
    })
}

/* ---- Tauri commands（全部 async：阻塞体由运行时放线程池，v4.5 红线） ---- */

#[tauri::command(async)]
pub fn git_sync_get_config() -> Result<GitSyncConfig, String> {
    let root = fs_cmds::data_root();
    let c = read_sync_cfg(&root);
    let g = read_git_cfg(&root);
    Ok(GitSyncConfig {
        platform: c.platform,
        remote: c.remote,
        branch: c.branch,
        on_start: c.on_start,
        enabled: c.enabled,
        interval_min: c.interval_min,
        token_saved: token_saved(),
        last_sync: g.get("last_sync").and_then(|v| v.as_u64()),
        data_root: root.to_string_lossy().to_string(),
    })
}

/// 保存同步设置。令牌语义：Some(非空)=写入密钥链 / Some("")=清除 / None=保持不动。
/// v4.27：新增 platform / on_start / interval_min（非法值回落默认，不报错中断保存）。
#[tauri::command(async)]
pub fn git_sync_set_config(
    enabled: bool,
    platform: String,
    on_start: bool,
    interval_min: u32,
    remote: String,
    branch: String,
    token: Option<String>,
) -> Result<(), String> {
    let root = fs_cmds::data_root();
    let platform = normalize_platform(&platform);
    let remote = remote.trim().to_string();
    let branch = {
        let b = branch.trim();
        if b.is_empty() { DEFAULT_BRANCH.to_string() } else { b.to_string() }
    };
    let interval_min = normalize_interval(interval_min as u64);

    if !remote.is_empty() {
        if !remote.starts_with("https://") {
            return Err("仓库地址必须以 https:// 开头".into());
        }
        if platform == "gitee" && gitee_owner(&remote).is_none() {
            return Err(
                "Gitee 仓库地址应形如 https://gitee.com/你的用户名/仓库名.git（第一段必须是你的 Gitee 用户名；组织仓库暂不支持）"
                    .into(),
            );
        }
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
    g["platform"] = serde_json::json!(platform);
    g["enabled"] = serde_json::json!(enabled);
    g["on_start"] = serde_json::json!(on_start);
    g["interval_min"] = serde_json::json!(interval_min);
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

/// 立即同步（手动按钮）：本地提交 + 推送 + 记 last_sync；错误回显给 UI。
#[tauri::command(async)]
pub fn git_sync_now() -> Result<String, String> {
    let root = fs_cmds::data_root();
    let cfg = read_sync_cfg(&root);
    if cfg.remote.is_empty() {
        return Err("尚未配置仓库地址——请先在设置页填写并保存".into());
    }
    let token = require_token(&cfg)?;
    sync_commit_push(&root, "手动同步", &cfg, &token)
}

/// 打开软件时同步（v4.27 默认时机）：未开启或未配置齐全则静默跳过（Ok("skipped")）。
/// 失败只记日志、不弹窗（前端会静默吞掉 Err），漏推送的提交由下次触发或手动同步补上。
#[tauri::command(async)]
pub fn git_sync_on_start() -> Result<String, String> {
    let root = fs_cmds::data_root();
    let cfg = read_sync_cfg(&root);
    if !cfg.on_start || cfg.remote.is_empty() {
        return Ok("skipped".to_string());
    }
    let Ok(token) = read_token() else {
        eprintln!("[git_sync] 已开启启动同步但未保存令牌，跳过");
        return Ok("skipped".to_string());
    };
    sync_commit_push(&root, "启动同步", &cfg, &token).map_err(|e| {
        eprintln!("[git_sync] 启动同步失败：{e}");
        e
    })
}

/// 定时同步（前端按 interval_min 调度；不判开关，由调度方决定）。失败同样只记日志。
#[tauri::command(async)]
pub fn git_sync_tick() -> Result<String, String> {
    let root = fs_cmds::data_root();
    let cfg = read_sync_cfg(&root);
    if cfg.remote.is_empty() {
        return Ok("skipped".to_string());
    }
    let Ok(token) = read_token() else {
        return Ok("skipped".to_string());
    };
    sync_commit_push(&root, "定时同步", &cfg, &token).map_err(|e| {
        eprintln!("[git_sync] 定时同步失败：{e}");
        e
    })
}

/// git_auto_commit 提交成功后调用（crate 内）：enabled（每次保存后同步）且配置齐全则静默推送。
/// 任何失败只 eprintln，绝不阻断保存主流程——漏推的提交由下次提交或手动同步补上。
pub(crate) fn push_if_enabled(root: &Path) {
    let cfg = read_sync_cfg(root);
    if !cfg.enabled || cfg.remote.is_empty() {
        return;
    }
    let Ok(token) = read_token() else {
        eprintln!("[git_sync] 已启用同步但未保存令牌，跳过推送");
        return;
    };
    match push_with_align(root, &cfg, &token) {
        Ok(()) => {
            if let Err(e) = touch_last_sync(root) {
                eprintln!("[git_sync] last_sync 更新失败：{e}");
            }
        }
        Err(e) => eprintln!("[git_sync] 自动推送失败（下次提交补推）：{e}"),
    }
}
