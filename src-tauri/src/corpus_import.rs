// 语料导入（v4.26 §2.14）：epub/pdf 转 md 后落 corpus/<书名>/。
// - 文件选择器由前端调 Tauri 官方 dialog 插件（rfd 在 async 线程弹不出，已弃用）；
// - epub 按阅读顺序拆成多个 md，pdf 按页拼接成单个 md；
// - 输出直接落 dataRoot/corpus/<书名>/ —— 与用户手动放的语料平级，一眼可见；
// - 错误软处理：单个文件失败不影响其他，返回报告让前端展示。

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::fs_cmds;

/// 导入结果（前端提示条：成功 N 个文件、失败 M 个、落盘路径）。
#[derive(Serialize, Clone)]
pub struct ImportResult {
    pub files_selected: u32,
    pub files_converted: u32,
    pub files_failed: u32,
    pub output_dir: String,
    pub details: Vec<String>,
}

/// Tauri 命令：把选中的 epub/pdf 逐个转写 → 落 corpus/<书名>/ → 返回报告。
#[tauri::command(async)]
pub fn import_corpus_file(paths: Vec<String>) -> Result<ImportResult, String> {
    if paths.is_empty() {
        return Err("未选择任何文件".to_string());
    }

    // v4.26 修正：输出直接落语料库根（corpus/），书名目录与手动语料平级
    let corpus_root = fs_cmds::data_root().join("corpus");
    fs::create_dir_all(&corpus_root).map_err(|e| format!("创建语料目录失败：{e}"))?;

    let mut result = ImportResult {
        files_selected: paths.len() as u32,
        files_converted: 0,
        files_failed: 0,
        output_dir: corpus_root.to_string_lossy().to_string(),
        details: Vec::new(),
    };

    for p_str in &paths {
        let p = PathBuf::from(p_str);
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let stem = p
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        match ext.as_str() {
            "epub" => match convert_epub(&p, &corpus_root, &stem) {
                Ok(n) => {
                    result.files_converted += 1;
                    result
                        .details
                        .push(format!("✅ {stem}.epub → corpus/{stem}/ 共 {n} 章"));
                }
                Err(e) => {
                    result.files_failed += 1;
                    result.details.push(format!("❌ {stem}.epub：{e}"));
                }
            },
            "pdf" => match convert_pdf(&p, &corpus_root, &stem) {
                Ok((text_pages, total)) => {
                    result.files_converted += 1;
                    let partial = if text_pages < total {
                        format!("（仅 {text_pages}/{total} 页有文字层，其余可能是扫描图）")
                    } else {
                        String::new()
                    };
                    result
                        .details
                        .push(format!("✅ {stem}.pdf → corpus/{stem}.md{partial}"));
                }
                Err(e) => {
                    result.files_failed += 1;
                    result.details.push(format!("❌ {stem}.pdf：{e}"));
                }
            },
            other => {
                result.files_failed += 1;
                result
                    .details
                    .push(format!("⚠️  跳过 .{other}（暂只支持 epub/pdf）"));
            }
        }
    }

    Ok(result)
}

/// EPUB → 多章节 md：按阅读顺序逐页写 md，落 corpus/<书名>/ 目录。
fn convert_epub(src: &Path, out_base: &Path, stem: &str) -> Result<u32, String> {
    let book = epub_parser::Epub::parse(src).map_err(|e| format!("解析 epub 失败：{e}"))?;
    let book_dir = out_base.join(stem);
    fs::create_dir_all(&book_dir).map_err(|e| format!("创建章节目录失败：{e}"))?;

    let title = book
        .metadata
        .title
        .clone()
        .unwrap_or_else(|| stem.to_string());
    let author = book
        .metadata
        .author
        .clone()
        .unwrap_or_else(|| "未知作者".to_string());

    // 封面 meta md（书名、作者、来源）
    let meta_md = format!(
        "# {title}\n\n> 来源：{src_path}\n> 作者：{author}\n> 导入方式：EPUB 自动转写\n\n",
        src_path = src.display()
    );
    let meta_path = book_dir.join("00-封面信息.md");
    fs::write(&meta_path, &meta_md).map_err(|e| format!("写封面失败：{e}"))?;

    // 逐页写 md（epub-parser 的 pages 是 OPF spine 顺序）
    // Page 没有 href 字段，无法精确匹配 TOC；用 Page.index + "第 N 章" 作标题
    let mut count = 1u32;
    for page in &book.pages {
        let cleaned = page.content.trim();
        if cleaned.is_empty() {
            continue;
        }
        let heading = format!("第 {} 章", count);
        let md_content = format!("# {heading}\n\n{cleaned}\n");
        let fname = format!("{:02}-{}.md", count, heading);
        let fpath = book_dir.join(&fname);
        fs::write(&fpath, md_content).map_err(|e| format!("写章节 {count} 失败：{e}"))?;
        count += 1;
    }

    Ok(count - 1) // 返回实际章节数（不含封面）
}

/// PDF → 单 md：逐页抽取文本。返回 (有文字页数, 总页数)。
/// v4.26 修正：全书抽不到文字 = 扫描版（图片型）PDF，没有文本层——
/// 不生成空壳 md（会误导 RAG：看似入库实则零内容），按失败报错并建议换 epub。
fn convert_pdf(src: &Path, out_base: &Path, stem: &str) -> Result<(u32, u32), String> {
    let doc =
        pdf_oxide::PdfDocument::open(src).map_err(|e| format!("打开 pdf 失败：{e}"))?;
    let num_pages = doc.page_count().map_err(|e| format!("读取页数失败：{e}"))?;

    let mut out = String::new();
    out.push_str(&format!("# {stem}\n\n"));
    out.push_str(&format!("> 来源：{}\n", src.display()));
    out.push_str(&format!("> 页数：{num_pages}\n"));
    out.push_str("> 导入方式：PDF 自动文本抽取\n\n");
    out.push_str("---\n\n");

    let mut text_pages = 0u32;
    for i in 0..num_pages {
        match doc.extract_text(i) {
            Ok(text) => {
                let t = text.trim();
                if !t.is_empty() {
                    text_pages += 1;
                    out.push_str(&format!("## 第 {} 页\n\n", i + 1));
                    out.push_str(t);
                    out.push_str("\n\n");
                }
            }
            Err(e) => {
                text_pages += 1; // 抽取失败页也算「有文字层」（保留失败标记）
                out.push_str(&format!(
                    "## 第 {} 页\n\n*抽取失败：{e}*\n\n",
                    i + 1
                ));
            }
        }
    }

    if text_pages == 0 {
        return Err(format!(
            "{num_pages} 页全部没有可抽取文字——这本 PDF 是扫描版（每页为图片，无文本层），需 OCR 才能转，暂不支持；建议改用该书的 epub 版本导入"
        ));
    }

    let out_path = out_base.join(format!("{stem}.md"));
    fs::write(&out_path, out).map_err(|e| format!("写 pdf md 失败：{e}"))?;
    Ok((text_pages, num_pages as u32))
}
