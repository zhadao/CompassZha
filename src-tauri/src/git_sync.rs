// 数据同步（v4.10 前移执行，v4.27 扩为三时机 + GitHub/Gitee 双平台，v4.29 认证方式交还 git）：
// - config.json 只存非敏感字段
//   （platform / auth / remote / branch / on_start / enabled / interval_min / last_sync）；
// - 认证方式（auth，v4.29）：
//     `auto`（默认）——软件不注入任何凭据，认证全部交给本机 git：
//         https 地址 → 系统凭据管理器（首次登录一次后长期免输入）；
//         SSH 地址 → 本机 ~/.ssh 密钥（首次连接经 StrictHostKeyChecking=accept-new 记录主机密钥）；
//     `token`（v4.27 行为，保留）——令牌只存 Windows 凭据管理器（keyring，SPEC-012），
//         推送/拉取时经 `git -c http.extraheader=...` 一次性注入 Basic 头（不落盘、不进 .git/config），
//         仅此模式设 GIT_TERMINAL_PROMPT=0（认证失败立即返回，不挂在凭据输入提示上）；
//        Basic 用户名：github = `x-access-token`；gitee = `<仓库地址第一段(用户名)>`；
// - 仓库地址支持两种合法形式：`https://主机/owner/repo.git` 与 SSH 形式 `git@主机:owner/repo.git`；
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
/// 认证方式默认值（v4.29）：auto = 交给本机 git（凭据管理器 / SSH 密钥），token = 注入 Basic 头
const DEFAULT_AUTH: &str = "auto";
/// auto 模式下 SSH 地址的 ssh 命令：首次连接自动记录主机密钥，之后不符则拒绝
const SSH_CMD: &str = "ssh -o StrictHostKeyChecking=accept-new";
/// 定时同步可选档位（分钟）；0 = 关闭
const INTERVALS: [u32; 5] = [0, 5, 15, 30, 60];

/// 设置页同步配置（git_sync_get_config 返回；字段与前端 GitSyncConfig 接口一一对应）
#[derive(Serialize)]
pub struct GitSyncConfig {
    pub platform: String,
    /// 认证方式：auto（交给本机 git，默认）/ token（注入 Basic 头）
    pub auth: String,
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
    auth: String,
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
        auth: normalize_auth(&str_or("auth", DEFAULT_AUTH)),
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

fn normalize_auth(a: &str) -> String {
    match a.trim().to_ascii_lowercase().as_str() {
        "token" => "token".to_string(),
        _ => DEFAULT_AUTH.to_string(),
    }
}

fn normalize_interval(n: u64) -> u32 {
    let n = n as u32;
    if INTERVALS.contains(&n) { n } else { 0 }
}

/// 仓库地址是否合法：`https://…` 或 SSH 形式（`git@主机:…` / `ssh://…`）
fn is_valid_remote(remote: &str) -> bool {
    let r = remote.trim();
    r.starts_with("https://") || r.starts_with("ssh://") || r.starts_with("git@")
}

/// 是否为 SSH 形式的远端地址（auto 模式下需附主机密钥策略）
fn is_ssh_remote(remote: &str) -> bool {
    let r = remote.trim();
    r.starts_with("ssh://") || r.starts_with("git@")
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

/// 过滤令牌后再回显 git 错误（令牌绝不进入 UI / 日志；auto 模式下无令牌可过滤）
fn safe_err(err: &str, cfg: &SyncCfg, token: &str) -> String {
    if cfg.auth != "token" || token.is_empty() {
        return err.to_string();
    }
    let mut s = err.replace(token, "<已隐藏>");
    if let Ok(auth) = auth_arg(&cfg.platform, &cfg.remote, token) {
        s = s.replace(&auth, "<已隐藏>");
    }
    s
}

/// 网络操作附加参数（v4.29）：
/// - auto：不注入任何凭据——https 交给系统凭据管理器；SSH 地址附主机密钥策略；
/// - token：`-c http.extraheader=…` 一次性注入 Basic 头（不落盘、不进 .git/config）。
fn net_args(cfg: &SyncCfg, token: &str) -> Result<Vec<String>, String> {
    if cfg.auth == "token" {
        return Ok(vec!["-c".to_string(), auth_arg(&cfg.platform, &cfg.remote, token)?]);
    }
    if is_ssh_remote(&cfg.remote) {
        return Ok(vec!["-c".to_string(), format!("core.sshCommand={SSH_CMD}")]);
    }
    Ok(Vec::new())
}

/// 本地 git 操作（commit / reset / update-ref 等，无网络）：禁用终端凭据提示即可
fn git_out(root: &Path, args: &[&str]) -> Result<Output, String> {
    fs_cmds::git(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("git 无法启动：{e}"))
}

/// 网络 git 操作（push / fetch）：按认证方式注入参数；
/// 仅 token 模式设 GIT_TERMINAL_PROMPT=0（auto 模式保留凭据管理器弹窗机会，stdin 为空不会挂起）。
fn git_net(root: &Path, cfg: &SyncCfg, token: &str, args: &[&str]) -> Result<Output, String> {
    let mut full = net_args(cfg, token)?;
    full.extend(args.iter().map(|s| s.to_string()));
    let refs: Vec<&str> = full.iter().map(|s| s.as_str()).collect();
    let mut c = fs_cmds::git(&refs);
    c.current_dir(root);
    if cfg.auth == "token" {
        c.env("GIT_TERMINAL_PROMPT", "0");
    }
    c.output().map_err(|e| format!("git 无法启动：{e}"))
}

/// 推送 origin/<branch>
fn push(root: &Path, cfg: &SyncCfg, token: &str) -> Result<(), String> {
    let out = git_net(root, cfg, token, &["push", "origin", &cfg.branch])?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("推送失败：{}", safe_err(&err, cfg, token)));
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
    let fetched = git_net(root, cfg, token, &["fetch", "origin", &cfg.branch])?;
    if !fetched.status.success() {
        let err = String::from_utf8_lossy(&fetched.stderr).trim().to_string();
        return Err(format!(
            "远端仓库已有内容，自动对齐失败（fetch 失败）：{}\n请检查网络，以及仓库访问权限（SSH 密钥 / 凭据管理器凭据是否可用）。",
            safe_err(&err, cfg, token)
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

/// 取本次同步所需令牌（v4.29）：token 模式必须已保存；auto 模式不读凭据管理器，返回空串。
fn token_for(cfg: &SyncCfg) -> Result<String, String> {
    if cfg.auth == "token" {
        require_token(cfg)
    } else {
        Ok(String::new())
    }
}

/// SSH 密钥生成结果（v4.40 C-2：`git_ssh_generate_key` 返回；前端「复制公钥」直接用 public_key）
#[derive(Serialize)]
pub struct SshKeyResult {
    /// true = 本次新生成；false = 本机已有密钥，直接复用（绝不覆盖）
    pub created: bool,
    /// 公钥全文（`ssh-ed25519 …` 一行）
    pub public_key: String,
}

/// `~/.ssh` 目录（Windows 优先 USERPROFILE，兼容 HOME）
fn ssh_dir() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "无法定位用户主目录（USERPROFILE / HOME 均未设置）".to_string())?;
    Ok(std::path::PathBuf::from(home).join(".ssh"))
}

/// 调 ssh-keygen 生成 ed25519 密钥对（无口令：本机私钥，简化用户操作；加 CREATE_NO_WINDOW 免黑窗）
fn ssh_keygen(path: &Path) -> Result<Output, String> {
    let mut c = std::process::Command::new("ssh-keygen");
    c.args(["-t", "ed25519", "-N", "", "-C", "CompassZha data sync", "-f"])
        .arg(path);
    fs_cmds::no_window(&mut c);
    c.output()
        .map_err(|e| format!("无法启动 ssh-keygen（本机需安装 OpenSSH 客户端）：{e}"))
}

/* ---- Tauri commands（全部 async：阻塞体由运行时放线程池，v4.5 红线） ---- */

#[tauri::command(async)]
pub fn git_sync_get_config() -> Result<GitSyncConfig, String> {
    let root = fs_cmds::data_root();
    let c = read_sync_cfg(&root);
    let g = read_git_cfg(&root);
    Ok(GitSyncConfig {
        platform: c.platform,
        auth: c.auth,
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
/// v4.29：新增 auth（auto 默认 / token）；地址校验放宽为 https 或 SSH 形式。
#[tauri::command(async)]
pub fn git_sync_set_config(
    enabled: bool,
    platform: String,
    auth: String,
    on_start: bool,
    interval_min: u32,
    remote: String,
    branch: String,
    token: Option<String>,
) -> Result<(), String> {
    let root = fs_cmds::data_root();
    let platform = normalize_platform(&platform);
    let auth = normalize_auth(&auth);
    let remote = remote.trim().to_string();
    let branch = {
        let b = branch.trim();
        if b.is_empty() { DEFAULT_BRANCH.to_string() } else { b.to_string() }
    };
    let interval_min = normalize_interval(interval_min as u64);

    if !remote.is_empty() {
        if !is_valid_remote(&remote) {
            return Err(
                "仓库地址应形如 https://主机/用户名/仓库名.git，或 SSH 形式 git@主机:用户名/仓库名.git"
                    .into(),
            );
        }
        // 仅「私人令牌 + Gitee」组合仍要求 https 且能从地址解析出用户名（Basic 认证需要）
        if platform == "gitee" && auth == "token" {
            if !remote.starts_with("https://") {
                return Err("使用私人令牌认证时，Gitee 仓库地址必须是 https:// 形式".into());
            }
            if gitee_owner(&remote).is_none() {
                return Err(
                    "Gitee 仓库地址应形如 https://gitee.com/你的用户名/仓库名.git（第一段必须是你的 Gitee 用户名；组织仓库暂不支持）"
                        .into(),
                );
            }
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
    g["auth"] = serde_json::json!(auth);
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
    let token = token_for(&cfg)?;
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
    let token = match token_for(&cfg) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[git_sync] 已开启启动同步但未保存令牌，跳过：{e}");
            return Ok("skipped".to_string());
        }
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
    let token = match token_for(&cfg) {
        Ok(t) => t,
        Err(_) => return Ok("skipped".to_string()),
    };
    sync_commit_push(&root, "定时同步", &cfg, &token).map_err(|e| {
        eprintln!("[git_sync] 定时同步失败：{e}");
        e
    })
}

/// 生成 SSH 密钥（v4.40 C-2）：仅当 `~/.ssh/id_ed25519` 不存在时生成，**绝不覆盖**已有密钥。
/// 返回 { created, public_key }：created=false 表示本机已有密钥、已直接复用。
#[tauri::command(async)]
pub fn git_ssh_generate_key() -> Result<SshKeyResult, String> {
    let dir = ssh_dir()?;
    let key = dir.join("id_ed25519");
    let pubkey = dir.join("id_ed25519.pub");
    let mut created = false;
    if !key.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建 ~/.ssh 目录失败：{e}"))?;
        let out = ssh_keygen(&key)?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(format!("生成 SSH 密钥失败：{err}"));
        }
        created = true;
    }
    let text = std::fs::read_to_string(&pubkey)
        .map_err(|e| format!("公钥文件不可用（{}）：{e}", pubkey.to_string_lossy()))?;
    Ok(SshKeyResult {
        created,
        public_key: text.trim().to_string(),
    })
}

/// 测试同步连通性（v4.40 C-2）：按已保存配置对远端做一次 `git ls-remote`（**只读**，不动本地数据、不提交）。
/// 成功返回可读结论；失败回显 git 原始报错（令牌已过滤）。
#[tauri::command(async)]
pub fn git_test_connection() -> Result<String, String> {
    let root = fs_cmds::data_root();
    let cfg = read_sync_cfg(&root);
    if cfg.remote.is_empty() {
        return Err("尚未配置仓库地址——请先填写仓库地址并保存配置".into());
    }
    if !is_valid_remote(&cfg.remote) {
        return Err(
            "仓库地址应形如 https://主机/用户名/仓库名.git，或 SSH 形式 git@主机:用户名/仓库名.git"
                .into(),
        );
    }
    if cfg.auth == "token" && is_ssh_remote(&cfg.remote) {
        return Err("私人令牌只适用于 https:// 形式的仓库地址；SSH 地址请把认证方式改为「自动」".into());
    }
    let token = token_for(&cfg)?;
    let out = git_net(&root, &cfg, &token, &["ls-remote", cfg.remote.as_str()])?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("连接失败：{}", safe_err(&err, &cfg, &token)));
    }
    Ok(match cfg.auth.as_str() {
        "token" => "测试通过：远端可达，令牌权限有效".to_string(),
        _ if is_ssh_remote(&cfg.remote) => {
            "测试通过：远端可达，SSH 公钥已被接受".to_string()
        }
        _ => "测试通过：远端可达，系统凭据可用".to_string(),
    })
}

/// git_auto_commit 提交成功后调用（crate 内）：enabled（每次保存后同步）且配置齐全则静默推送。
/// 任何失败只 eprintln，绝不阻断保存主流程——漏推的提交由下次提交或手动同步补上。
pub(crate) fn push_if_enabled(root: &Path) {
    let cfg = read_sync_cfg(root);
    if !cfg.enabled || cfg.remote.is_empty() {
        return;
    }
    let token = match token_for(&cfg) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[git_sync] 已启用同步但未保存令牌，跳过推送：{e}");
            return;
        }
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
