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

/// 数据根目录默认值（§3.3 v4.22 运行形态）：
/// 1) 可执行文件同级存在 `portable.txt`（便携版标记）→ `<exe 同级>/data`（绿色软件）；
/// 2) 否则 `%APPDATA%\CompassZha`（平台标准路径）；
/// 3) 若 (2) 不存在而历史默认根 `%USERPROFILE%\CompassZha` 存在 → **幂等复制**（源保留作为备份）。
/// 最终仍可被目标根下 config.json 的 `data_root` 字段覆盖。
fn default_data_root() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if dir.join("portable.txt").is_file() {
                return dir.join("data");
            }
        }
    }
    match std::env::var_os("APPDATA") {
        Some(appdata) if !appdata.is_empty() => {
            let target = PathBuf::from(appdata).join("CompassZha");
            migrate_legacy_root(&target);
            target
        }
        _ => legacy_data_root(),
    }
}

/// 历史默认根（v4.11 去个人化时使用；v4.22 起仅作回落与迁移来源）。
fn legacy_data_root() -> PathBuf {
    match std::env::var_os("USERPROFILE") {
        Some(home) if !home.is_empty() => PathBuf::from(home).join("CompassZha"),
        _ => PathBuf::from("CompassZha"),
    }
}

/// 幂等迁移：目标根不存在、且历史根存在 → 递归复制（只增不覆盖；**源保留不删**）。
/// 已存在则直接返回（重复执行无副作用）。
fn migrate_legacy_root(target: &Path) {
    if target.exists() {
        return;
    }
    let legacy = legacy_data_root();
    if !legacy.is_dir() || legacy == target {
        return;
    }
    if let Err(e) = copy_tree(&legacy, target) {
        eprintln!("[bootstrap] 历史数据迁移失败（不影响启动）：{e}");
    } else {
        println!(
            "[bootstrap] 已将历史数据从 {} 复制到 {}（源保留为备份）",
            legacy.display(),
            target.display()
        );
    }
}

/// 递归复制目录（已存在的文件不覆盖）。
fn copy_tree(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &to)?;
        } else if !to.exists() {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
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

    // 2. 基础目录（§3.1 v4.22 审查后定稿：每类数据唯一归属一个顶层目录）。v4.4：corpus 为统一大库，不按主题分子目录
    for dir in ["daily", "life", "corpus", "events", "conversations"] {
        if let Err(e) = fs::create_dir_all(root.join(dir)) {
            eprintln!("[bootstrap] 创建目录 {dir} 失败：{e}");
        }
    }

    // 2b. 目录说明 README.md（v4.22：幂等生成，纯说明文件、应用不读；已存在则不覆盖）
    let readme = root.join("README.md");
    if !readme.is_file() {
        if let Err(e) = fs::write(&readme, DIR_README) {
            eprintln!("[bootstrap] README.md 写入失败：{e}");
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

/// §3.1 v4.22：数据根目录说明（首次启动幂等生成，已存在则不覆盖）。
const DIR_README: &str = "# CompassZha 数据目录说明\n\
\n\
这是 CompassZha 的全部数据目录——所有内容都是普通 Markdown 文件，可直接用任何编辑器打开、修改、备份。\n\
\n\
| 目录 / 文件 | 用途 | 命名规则 |\n\
| --- | --- | --- |\n\
| `daily/<年>/` | 日记 + 当日日程（日历事件） | `yyyy-mm-dd.md` |\n\
| `life/<板块名>/` | 人生板块内容（每个板块一个子文件夹，内部可放多个 md） | 文件夹名 = 板块名 |\n\
| `events/循环事件.md` | 循环事件规则库（规则驱动，仅在近 3 个月内自动生成事件） | 固定文件名 |\n\
| `corpus/` | 隆中对语料库（任何 md 都是语料；直接丢进本目录即可） | 自由命名 |\n\
| `conversations/` | 隆中对对话归档（应用内「保存本轮对话」写入） | `yyyy-mm-dd_hh-mm_标题.md` |\n\
| `config.json` | 应用设置（外观 / AI / Git / 关闭行为等） | 单文件 |\n\
| `.backup/` | 本地快照（自动维护，不进 Git） | — |\n\
\n\
提示：这些文件建议通过 CompassZha 应用内编辑（会自动提交到本地 Git 仓库便于回溯）；也可在应用「设置 → 数据」中一键打开本目录。\n";

/// §3.3 默认 config.json（version 5，v4.4：corpus_topics 为 RAG 标签路由，去 dir 字段）。
/// 敏感信息（DeepSeek key 等）不入本文件（SPEC-012）。
/// v0.2.0：默认卡补 keywords——索引卡是 AI 检索的筛选器，关键词并入检索打分。
fn default_config_json() -> String {
    let cfg = serde_json::json!({
        "version": 5,
        "data_root": "",
        "close_behavior": "ask",
        "corpus_topics": [
            { "id": "career", "name": "职业与方向", "keywords": ["职业选择", "跳槽", "升职", "转行", "副业", "面试", "工作", "事业"] },
            { "id": "ai-tools", "name": "AI 与工具观", "keywords": ["AI", "人工智能", "工具", "效率", "软件", "大模型", "自动化"] },
            { "id": "money", "name": "金钱", "keywords": ["金钱", "收入", "赚钱", "理财", "消费", "财富", "省钱"] },
            { "id": "creation-design", "name": "创作与设计", "keywords": ["创作", "设计", "写作", "内容", "作品", "审美", "表达"] },
            { "id": "industry", "name": "行业判断", "keywords": ["行业", "趋势", "市场", "竞争", "商业模式", "公司"] },
            { "id": "value-method", "name": "价值判断方法", "keywords": ["价值观", "判断", "决策", "思考", "逻辑", "原则"] },
            { "id": "emotion-self", "name": "情绪与自我", "keywords": ["情绪", "焦虑", "心态", "自我", "成长", "内耗", "压力"] },
            { "id": "health", "name": "健康", "keywords": ["健康", "睡眠", "运动", "身体", "作息", "饮食", "精力"] }
        ],
        "git": { "platform": "github", "auth": "auto", "remote": "", "branch": "main", "on_start": true, "enabled": false, "interval_min": 0 },
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

/* ---- 数据一键导出（v4.25 §2.13：整个数据根 → 「下载」文件夹 zip） ---- */

/// SystemTime → zip 条目的 MS-DOS 时间戳（手拼公历换算，避免引入 time 依赖；
/// MS-DOS 时间下限 1980 年，更早的 mtime 钳制到 1980-01-01）。
fn zipped_time(t: std::time::SystemTime) -> zip::DateTime {
    let secs = t
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let tod = (secs % 86_400) as u32;
    // Howard Hinnant civil_from_days：UNIX 天数 → 公历 (y, m, d)
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = (if m <= 2 { y + 1 } else { y }) as i32;
    zip::DateTime::from_date_and_time(
        y.clamp(1980, 2107) as u16,
        m as u8,
        d as u8,
        (tod / 3600) as u8,
        ((tod % 3600) / 60) as u8,
        (tod % 60) as u8,
    )
    .unwrap_or_default()
}

/// 递归把 dir 下所有条目写入 zip（目录/文件条目均带 `data/` 顶层前缀，
/// 解压后即得完整 data 目录；同目录内按名称排序，产物可复现）。
fn zip_tree(
    w: &mut zip::ZipWriter<std::fs::File>,
    opts: zip::write::SimpleFileOptions,
    base: &Path,
    dir: &Path,
) -> Result<(), String> {
    let mut entries: Vec<fs::DirEntry> = fs::read_dir(dir)
        .map_err(|e| format!("读目录失败 {}：{e}", dir.display()))?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let p = entry.path();
        let rel = p.strip_prefix(base).map_err(|e| format!("相对化失败：{e}"))?;
        let name = format!("data/{}", rel.to_string_lossy().replace('\\', "/"));
        if p.is_dir() {
            w.add_directory(&name, opts)
                .map_err(|e| format!("写入目录条目 {name} 失败：{e}"))?;
            zip_tree(w, opts, base, &p)?;
        } else if p.is_file() {
            let mtime = entry
                .metadata()
                .and_then(|m| m.modified())
                .unwrap_or(std::time::UNIX_EPOCH);
            let opts = opts.last_modified_time(zipped_time(mtime));
            let mut f =
                fs::File::open(&p).map_err(|e| format!("打开 {} 失败：{e}", p.display()))?;
            w.start_file(&name, opts)
                .map_err(|e| format!("写入条目 {name} 失败：{e}"))?;
            std::io::copy(&mut f, w).map_err(|e| format!("压缩写入 {name} 失败：{e}"))?;
        }
    }
    Ok(())
}

/// 一键导出：把整个数据根目录打包为单个 zip，落到「下载」文件夹。
/// `stamp` 由前端生成（`yyyy-mm-dd_hh-mm`），服务端再过滤一次非法字符防路径注入。
/// 返回 zip 完整路径（前端展示 + 「打开所在文件夹」用）。
#[tauri::command(async)]
pub fn export_data_zip(stamp: String) -> Result<String, String> {
    let root = data_root();
    if !root.is_dir() {
        return Err(format!("数据目录不存在：{}", root.display()));
    }
    let safe: String = stamp
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '-' || *c == '_')
        .collect();
    if safe.is_empty() {
        return Err("时间戳非法，导出取消".to_string());
    }
    let downloads = std::env::var_os("USERPROFILE")
        .map(|h| PathBuf::from(h).join("Downloads"))
        .ok_or("无法定位「下载」文件夹")?;
    fs::create_dir_all(&downloads).map_err(|e| format!("「下载」文件夹创建失败：{e}"))?;
    let out_path = downloads.join(format!("CompassZha数据备份_{safe}.zip"));
    let file = fs::File::create(&out_path).map_err(|e| format!("创建 zip 失败：{e}"))?;
    let mut writer = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .large_file(false);
    zip_tree(&mut writer, opts, &root, &root)?;
    writer
        .finish()
        .map_err(|e| format!("收尾 zip 失败：{e}"))?;
    Ok(out_path.display().to_string())
}

/* ---- 资源管理器定位（v4.20：文件树右键「定位文件位置」，§2.9） ---- */

/// 在资源管理器中定位并选中 dataRoot 下的文件（explorer /select,<绝对路径>）。
/// 异步执行（性能红线：全 command 异步）；Windows 下 CREATE_NO_WINDOW 防黑窗闪烁。
#[tauri::command(async)]
pub fn fs_reveal(rel: String) -> Result<(), String> {
    let path = resolve(&rel)?;
    if !path.exists() {
        return Err("文件不存在".to_string());
    }
    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("打开资源管理器失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("仅支持 Windows".into())
    }
}

/// 在资源管理器中定位**任意绝对路径**的文件（v4.25 §2.13：导出结果「打开所在文件夹」；
/// 与 fs_reveal 的区别——不限于 dataRoot 相对路径，仅定位、不做任何写操作）。
#[tauri::command(async)]
pub fn reveal_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("路径不存在".to_string());
    }
    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", p.display()))
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("打开资源管理器失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = p;
        Err("仅支持 Windows".into())
    }
}

/* ---- 数据根目录（v4.22：设置页 / 侧栏「打开数据目录」，§3.1） ---- */

/// 在资源管理器中打开数据根目录（非「定位选中文件」——那是 fs_reveal）。
/// 异步执行；Windows 下 CREATE_NO_WINDOW 防黑窗闪烁。
#[tauri::command(async)]
pub fn open_data_root() -> Result<(), String> {
    let root = data_root();
    if let Err(e) = fs::create_dir_all(&root) {
        return Err(format!("数据目录创建失败：{e}"));
    }
    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(root.as_os_str())
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| format!("打开数据目录失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = root;
        Err("仅支持 Windows".into())
    }
}

/* ---- 外部链接（v4.16：设置页「软件作者」弹窗） ---- */

/// 用系统默认浏览器打开 https 链接（仅接受 https:// 前缀，防任意协议注入）。
/// Windows 下经 `cmd /c start` 打开并加 CREATE_NO_WINDOW（防黑窗闪烁，同 git() 模式）。
#[tauri::command(async)]
pub fn open_url_https(url: String) -> Result<(), String> {
    let u = url.trim();
    if !u.starts_with("https://") {
        return Err("只允许打开 https:// 链接".to_string());
    }
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.args(["/c", "start", "", u]);
        c.creation_flags(0x0800_0000);
        c.status().map(|_| ()).map_err(|e| format!("打开浏览器失败：{e}"))
    }
    #[cfg(not(windows))]
    {
        let prog = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        Command::new(prog)
            .arg(u)
            .status()
            .map(|_| ())
            .map_err(|e| format!("打开浏览器失败：{e}"))
    }
}
