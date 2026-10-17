// 语料检索（阶段 4 · 检查点 4.2）：L1 关键词打分。
// - 范围严格限定 dataRoot/corpus/ 下全部 .md/.txt/.json——daily/（日记与量化数据）与 life/（板块）
//   绝不进入检索（v4.12 用户澄清：对话语料仅用户主动放入 corpus/ 的文件）；
// - 接口固定（进：关键词/卡 id；出：带出处的段落列表）：未来 L2（SQLite FTS 索引）
//   与 L3（向量检索）只换本模块内部实现，调用方与前端零改动；
// - 纯本地只读：段落按空行切分、单段截 500 字、默认取 top-12 段（控制上下文长度与库大小无关）。
// - v4.26：白名单从 .md 扩到 .md/.txt/.json，epub/pdf 通过导入按钮自动转 md 后入库。

use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::fs_cmds;

/// 最低保留分：仅命中 1 次且无文件加成的段落几乎必是噪声（标题表格行、片语提及），丢弃；
/// 清洗后为空时由调用方走「无材料」兜底分支。
const MIN_SCORE: u32 = 2;

/// 目录级排除（小写集合）：开源语料仓自带的脚手架目录，里面没有正文。
/// 实测背景：lizheng-open-context 仓 1270 个 md 中 37 个是这类元文件
/// （index/ 标题清单、docs/、context/ 判断卡等），曾把真实正文挤出 top-12。
fn is_meta_dir(name: &str) -> bool {
    name.starts_with('.')
        || matches!(
            name.to_lowercase().as_str(),
            "index"
                | "docs"
                | "doc"
                | "scripts"
                | "tests"
                | "test"
                | "evals"
                | "eval"
                | "examples"
                | "demo"
                | "catalog"
                | "config"
                | "licenses"
                | "license"
                | "assets"
                | "images"
                | "media"
                | "context"
                | "benchmarks"
        )
}

/// 文件级排除（兜底，防止正文目录混入同名文件）：stem 小写命中即跳过。
fn is_meta_file(stem: &str) -> bool {
    let s = stem.to_lowercase();
    s.starts_with("license-")
        || matches!(
            s.as_str(),
            "readme"
                | "index"
                | "changelog"
                | "changes"
                | "news"
                | "license"
                | "licence"
                | "copying"
                | "contributing"
                | "contributors"
                | "code_of_conduct"
                | "security"
                | "governance"
                | "agents"
                | "maintainers"
                | "authors"
                | "reuse"
                | "manifest"
                | "notice"
        )
}

/// v4.26 支持的语料文件扩展名（小写）：md/txt/json 均可被检索。
fn is_supported_ext(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_lowercase().as_str(), "md" | "txt" | "json"))
        .unwrap_or(false)
}

/// 单段命中（corpus_search 返回；带出处供 AI 标注引用）。
#[derive(Serialize, Clone)]
pub struct CorpusHit {
    pub rel_path: String,
    pub title: String,
    pub snippet: String,
    pub score: u32,
}

/// 语料检索命令（async：文件扫描在线程池执行，v4.5 红线）。
#[tauri::command(async)]
pub fn corpus_search(
    keywords: Vec<String>,
    topic_ids: Option<Vec<String>>,
    limit: Option<usize>,
) -> Result<Vec<CorpusHit>, String> {
    let root = fs_cmds::data_root().join("corpus");
    let keywords: Vec<String> = keywords
        .iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if keywords.is_empty() {
        return Ok(Vec::new());
    }
    let limit = limit.unwrap_or(12).clamp(1, 40);

    let start = std::time::Instant::now();
    let mut hits = Vec::new();
    let mut files = 0u32;

    // 迭代 walk（跳过语料仓脚手架目录与元文件；只取 .md）
    let mut stack: Vec<PathBuf> = vec![root.clone()];
    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                if p.file_name().map(|n| is_meta_dir(&n.to_string_lossy())).unwrap_or(false) {
                    continue;
                }
                stack.push(p);
            } else if is_supported_ext(&p) {
                if p.file_stem().map(|s| is_meta_file(&s.to_string_lossy())).unwrap_or(false) {
                    continue;
                }
                files += 1;
                score_file(&p, &root, &keywords, topic_ids.as_deref(), &mut hits);
            }
        }
    }

    hits.retain(|h| h.score >= MIN_SCORE);
    hits.sort_by(|a, b| b.score.cmp(&a.score));
    hits.truncate(limit);
    eprintln!(
        "[corpus_search] {} 关键词 · 扫描 {files} 个文件 · 命中并保留 {} 段 · L1 扫描耗时 {:?}",
        keywords.len(),
        hits.len(),
        start.elapsed()
    );
    Ok(hits)
}

/// 单文件打分：文件级命中（路径/文件名含关键词或卡名）整段加权，段落按关键词出现次数计分。
fn score_file(
    p: &Path,
    root: &Path,
    keywords: &[String],
    topic_ids: Option<&[String]>,
    hits: &mut Vec<CorpusHit>,
) {
    let Ok(text) = std::fs::read_to_string(p) else { return };
    let rel = p
        .strip_prefix(root)
        .unwrap_or(p)
        .to_string_lossy()
        .replace('\\', "/");
    let title = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    // 文件级加成：路径或文件名直接命中关键词 / 命中主题卡 id → 该文件段落分数 ×2
    // 注：不做文件级过滤（正文命中而文件名不命中的段落同样要被检出——文件名粗筛会漏检）
    let mut file_bonus = 1u32;
    if keywords.iter().any(|k| rel.contains(k.as_str()) || title.contains(k.as_str())) {
        file_bonus = 2;
    } else if let Some(topics) = topic_ids {
        if topics.iter().any(|t| rel.to_lowercase().contains(&t.to_lowercase())) {
            file_bonus = 2;
        }
    }

    // 段落打分（空行切分；截 500 字）
    for para in text.split("\n\n") {
        let para = para.trim();
        if para.is_empty() || para.starts_with("---") {
            continue; // 跳过空段与 frontmatter
        }
        let mut score = 0u32;
        for k in keywords {
            score += para.matches(k.as_str()).count() as u32;
        }
        if score == 0 {
            continue;
        }
        hits.push(CorpusHit {
            rel_path: rel.clone(),
            title: title.clone(),
            snippet: para.chars().take(500).collect(),
            score: score * file_bonus,
        });
    }
}
