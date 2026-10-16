// 阶段 1 · 数据层 commands（检查点 1.2 / 1.6）。
// - 所有路径均为「相对 dataRoot 的安全路径」，本模块封闭校验，前端组件永不见绝对路径；
// - dataRoot 默认「用户主目录下的 CompassZha」（§3.1；v4.11 去个人化），
//   可被 config.json 顶层 data_root 字段覆盖；
// - 启动引导 bootstrap()：读覆盖 → 缺失则生成 config.json（§3.3，version 4）
//   → 确保基础目录与 .gitignore（必须在任何 git add 之前存在，防止吞入工程目录）；
// - git_auto_commit：本地 add+commit 后，若 git_sync 已启用则自动推送（v4.10 前移；
//   PAT 存系统密钥链、经 git 临时参数注入，不落盘）。git 不可用 / 无变更均静默跳过，
//   不阻断保存；推送失败静默（eprintln），下次提交或手动同步补推。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;

/// 数据根目录默认值（§3.1；config.json 的 data_root 字段可覆盖）。
/// v4.11 去个人化：默认取「当前用户主目录下的 CompassZha」（%USERPROFILE%\CompassZha），
/// 不写死任何开发者本机路径——分发给他人后也能在各用户机器上正常创建数据目录。
fn default_data_root() -> PathBuf {
    match std::env::var_os("USERPROFILE") {
        Some(home) if !home.is_empty() => PathBuf::from(home).join("CompassZha"),
        _ => PathBuf::from("CompassZha"),
    }
}

/// 目录条目（fs_list_dir 返回；目录优先、名称排序）。
#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

/* ---- dataRoot 解析（启动时读入一次，进程内只读） ---- */

fn overrides() -> &'static Mutex<Option<PathBuf>> {
    static CELL: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(None))
}

pub(crate) fn data_root() -> PathBuf {
    overrides()
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(default_data_root)
}

/// 相对路径 → dataRoot 下的绝对路径（封闭校验）。
/// 拒绝：空路径、绝对路径（/ 开头或含盘符）、含 `..` 的上跳。
fn resolve(rel: &str) -> Result<PathBuf, String> {
    let p = rel.trim().replace('\\', "/");
    if p.is_empty() {
        return Err("路径为空".to_string());
    }
    if rel.starts_with('/') || rel.starts_with('\\') || p.contains(':') {
        return Err(format!("禁止绝对路径：{rel}"));
    }
    if p.split('/').any(|seg| seg == "..") {
        return Err(format!("禁止上级目录（..）：{rel}"));
    }
    Ok(data_root().join(p))
}

/* ---- 启动引导 ---- */

pub fn bootstrap() {
    // 1. data_root 覆盖：引导配置永远从默认根读取。
    let default_root = default_data_root();
    if let Ok(text) = fs::read_to_string(default_root.join("config.json")) {
        if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(root) = cfg.get("data_root").and_then(|v| v.as_str()) {
                let root = root.trim();
                if !root.is_empty() {
                    *overrides().lock().unwrap() = Some(PathBuf::from(root));
                }
            }
        }
    }
    let root = data_root();

    // 2. 基础目录（§3.1；已存在则无操作）。v4.4：corpus 为统一大库，不按主题分子目录
    for dir in ["daily", "life", "corpus"] {
        if let Err(e) = fs::create_dir_all(root.join(dir)) {
            eprintln!("[bootstrap] 创建目录 {dir} 失败：{e}");
        }
    }

    // 3. .gitignore 必须先于任何 git add 存在（否则首个自动提交会把工程/缓存目录整个吞入）
    let gitignore = root.join(".gitignore");
    if !gitignore.is_file() {
        const GI: &str = "# CompassZha 数据仓忽略规则（工程 / 归档 / 发布副本与缓存不入数据仓）\n\
                          工程/\n\
                          归档/\n\
                          开源发布/\n\
                          .trae/\n\
                          .index/\n\
                          .backup/\n\
                          node_modules/\n\
                          *.log\n";
        if let Err(e) = fs::write(&gitignore, GI) {
            eprintln!("[bootstrap] .gitignore 写入失败：{e}");
        }
    }

    // 4. config.json 首次启动生成（§3.3，version 4）
    let config_path = root.join("config.json");
    if !config_path.is_file() {
        if let Err(e) = fs::write(&config_path, default_config_json()) {
            eprintln!("[bootstrap] config.json 写入失败：{e}");
        } else {
            println!("[bootstrap] 已生成默认 config.json：{}", config_path.display());
        }
    }
}

/// §3.3 默认 config.json（version 5，v4.4：corpus_topics 为 RAG 标签路由，去 dir 字段）。
/// 敏感信息（DeepSeek key 等）不入本文件（SPEC-012）。
fn default_config_json() -> String {
    let cfg = serde_json::json!({
        "version": 5,
        "data_root": "",
        "corpus_topics": [
            { "id": "career", "name": "职业与方向" },
            { "id": "ai-tools", "name": "AI 与工具观" },
            { "id": "money", "name": "金钱" },
            { "id": "creation-design", "name": "创作与设计" },
            { "id": "industry", "name": "行业判断" },
            { "id": "value-method", "name": "价值判断方法" },
            { "id": "emotion-self", "name": "情绪与自我" },
            { "id": "health", "name": "健康" }
        ],
        "git": { "enabled": false, "remote": "", "branch": "main" },
        "ai": { "provider": "deepseek", "base_url": "https://api.deepseek.com", "model": "deepseek-chat" },
        "ai_companion": { "kind": "solomd", "enabled": false },
        "paths": { "daily": "daily", "life": "life", "corpus": "corpus" }
    });
    serde_json::to_string_pretty(&cfg).unwrap_or_default() + "\n"
}

/* ---- 文件 commands ---- */

#[tauri::command(async)]
pub fn fs_read(rel: String) -> Result<String, String> {
    let p = resolve(&rel)?;
    if !p.is_file() {
        return Err(format!("文件不存在：{rel}"));
    }
    fs::read_to_string(&p).map_err(|e| format!("读取失败 {rel}：{e}"))
}

#[tauri::command(async)]
pub fn fs_write(rel: String, content: String) -> Result<(), String> {
    let p = resolve(&rel)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 {rel}：{e}"))?;
    }
    fs::write(&p, content).map_err(|e| format!("写入失败 {rel}：{e}"))
}

#[tauri::command(async)]
pub fn fs_append(rel: String, content: String) -> Result<(), String> {
    let p = resolve(&rel)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 {rel}：{e}"))?;
    }
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&p)
        .map_err(|e| format!("打开失败 {rel}：{e}"))?;
    f.write_all(content.as_bytes())
        .map_err(|e| format!("追加失败 {rel}：{e}"))
}

#[tauri::command(async)]
pub fn fs_list_dir(rel: String) -> Result<Vec<FileEntry>, String> {
    let p = resolve(&rel)?;
    if !p.is_dir() {
        return Ok(Vec::new()); // 目录不存在 → 空列表（首启 life/ 等场景）
    }
    let mut out: Vec<FileEntry> = Vec::new();
    let entries =
        fs::read_dir(&p).map_err(|e| format!("列目录失败 {rel}：{e}"))?;
    for entry in entries {
        let e = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let ft = e.file_type().map_err(|err| format!("读类型失败：{err}"))?;
        out.push(FileEntry {
            name: e.file_name().to_string_lossy().to_string(),
            is_dir: ft.is_dir(),
            size: if ft.is_dir() { 0 } else { e.metadata().map(|m| m.len()).unwrap_or(0) },
        });
    }
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(out)
}

#[tauri::command(async)]
pub fn fs_mkdir(rel: String) -> Result<(), String> {
    let p = resolve(&rel)?;
    fs::create_dir_all(&p).map_err(|e| format!("创建目录失败 {rel}：{e}"))
}

#[tauri::command(async)]
pub fn fs_delete(rel: String) -> Result<(), String> {
    let p = resolve(&rel)?;
    if p == data_root() {
        return Err("禁止删除数据根目录".to_string());
    }
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| format!("删除目录失败 {rel}：{e}"))
    } else if p.exists() {
        fs::remove_file(&p).map_err(|e| format!("删除文件失败 {rel}：{e}"))
    } else {
        Ok(()) // 不存在 → 幂等成功
    }
}

#[tauri::command(async)]
pub fn fs_exists(rel: String) -> Result<bool, String> {
    let p = resolve(&rel)?;
    Ok(p.exists())
}

/// 重命名/移动（板块内 Markdown 文件重命名用）。
/// 目标已存在则拒绝（防止覆盖丢数据）；父目录自动创建。
#[tauri::command(async)]
pub fn fs_rename(from: String, to: String) -> Result<(), String> {
    let src = resolve(&from)?;
    let dst = resolve(&to)?;
    if !src.exists() {
        return Err(format!("源不存在：{from}"));
    }
    if dst.exists() {
        return Err(format!("目标已存在：{to}"));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 {to}：{e}"))?;
    }
    fs::rename(&src, &dst).map_err(|e| format!("重命名失败 {from} → {to}：{e}"))
}

/* ---- 本地 git 自动提交 + 自动推送（v4.10：enabled 时 commit 后接 push） ---- */

/// 本地全量提交（root 参数化，git_sync 手动同步复用同一逻辑）。
/// 返回 "committed" / "skipped:git-missing" / "skipped:no-change"。
pub(crate) fn commit_all(root: &Path, msg: String) -> Result<String, String> {
    // git 不可用 → 静默跳过（不阻断保存主流程）
    let probe = git(&["--version"]).output();
    let ok = probe.map(|o| o.status.success()).unwrap_or(false);
    if !ok {
        eprintln!("[commit_all] 系统 git 不可用，跳过提交");
        return Ok("skipped:git-missing".to_string());
    }

    // 仓库不存在 → init（纯本地；.gitignore 已由 bootstrap 保证存在）
    if !root.join(".git").exists() {
        run_git(root, &["init"])?;
    }
    run_git(root, &["add", "-A"])?;

    // 无暂存变更 → 跳过（diff --quiet 退出码非 0 = 有差异）
    let changed = match git(&["diff", "--cached", "--quiet"]).current_dir(root).output() {
        Ok(out) => !out.status.success(),
        Err(e) => return Err(format!("git diff 无法启动：{e}")),
    };
    if !changed {
        return Ok("skipped:no-change".to_string());
    }

    let message = if msg.trim().is_empty() {
        "数据更新".to_string()
    } else {
        msg
    };
    // 身份兜底：-c 临时身份，仓库未配置 user.name/email 也能提交（仅本机本地仓）
    run_git(
        root,
        &[
            "-c",
            "user.name=CompassZha",
            "-c",
            "user.email=compass@local",
            "commit",
            "-m",
            message.as_str(),
        ],
    )?;
    Ok("committed".to_string())
}

#[tauri::command(async)]
pub fn git_auto_commit(msg: String) -> Result<String, String> {
    let root = data_root();
    let r = commit_all(&root, msg)?;
    // v4.10：已启用同步且有新提交 → 自动推送；失败静默不阻断保存，下次补推
    if r == "committed" {
        crate::git_sync::push_if_enabled(&root);
    }
    Ok(r)
}

/// 构造 git 子进程命令：Windows 下加 CREATE_NO_WINDOW，
/// 否则 GUI 进程（无控制台）每次 spawn 都会闪黑色控制台窗口（v4.6 用户反馈「黑窗一闪一闪」）。
pub(crate) fn git(args: &[&str]) -> Command {
    let mut c = Command::new("git");
    c.args(args);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000);
    c
}

pub(crate) fn run_git(root: &Path, args: &[&str]) -> Result<(), String> {
    match git(args).current_dir(root).output() {
        Ok(out) => {
            if !out.status.success() {
                let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return Err(format!("git {} 失败：{err}", args.join(" ")));
            }
            Ok(())
        }
        Err(e) => Err(format!("git {} 无法启动：{e}", args.join(" "))),
    }
}
