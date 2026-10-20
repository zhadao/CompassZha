/**
 * AI 接缝层（阶段 4 · v4.12）：唯一允许出现 invoke 调用的位置之一（与 tauri-fs.ts 同级）。
 * 隆中对仅检索 dataRoot/corpus/（日记/量化数据绝不进入检索——v4.12 用户澄清）。
 */

import { invoke } from "@tauri-apps/api/core";

/** 对话消息（发给 ai_ask 的多轮历史；role: user / assistant） */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** 语料引用出处（ai_ask 返回；对应 Rust CorpusHit） */
export interface CorpusHit {
  rel_path: string;
  title: string;
  snippet: string;
  score: number;
}

/** ai_ask 返回 */
export interface AiAnswer {
  answer: string;
  citations: CorpusHit[];
}

/** 设置页 AI 配置（data_* 为解析后有效值，含回落；v4.15 双 API） */
export interface AiConfig {
  base_url: string;
  model: string;
  key_saved: boolean;
  data_base_url: string;
  data_model: string;
  data_key_saved: boolean;
  corpus_dir: string;
  data_root: string;
}

/** 索引卡（config.json corpus_topics；keywords/desc 为 v4.12 扩展字段，旧卡可能缺省） */
export interface TopicCard {
  id: string;
  name: string;
  keywords?: string;
  desc?: string;
}

export const aiGetConfig = (): Promise<AiConfig> =>
  invoke<AiConfig>("ai_get_config");

/**
 * 保存 AI 配置。key 三态语义（同 GitHub PAT）：
 * 非空串 = 写入系统凭据管理器 / 空串 = 清除 / null = 保持不动。
 * v4.15 双 API：dataBaseUrl/dataModel/dataKey 同语义（data* 空串=清除，回落共用主 API）。
 */
export const aiSetConfig = (
  baseUrl: string,
  model: string,
  key: string | null,
  dataBaseUrl: string | null,
  dataModel: string | null,
  dataKey: string | null,
): Promise<void> =>
  invoke<void>("ai_set_config", {
    baseUrl,
    model,
    key,
    dataBaseUrl,
    dataModel,
    dataKey,
  });

/** 隆中对：扩词 → 检索 corpus/ → 生成（返回回答 + 引用出处） */
export const aiAsk = (messages: ChatMsg[]): Promise<AiAnswer> =>
  invoke<AiAnswer>("ai_ask", { messages });

/** 数据分析对话（v4.15）：多轮消息 + 前端组装的每日量化数据表 → 返回 AI 分析回答 */
export const dataAnalyzeAsk = (messages: ChatMsg[], dataText: string): Promise<string> =>
  invoke<string>("data_analyze_ask", { messages, dataText });

/** 「资源跳转」：用系统资源管理器打开语料文件夹 */
export const openCorpusFolder = (): Promise<void> =>
  invoke<void>("open_corpus_folder");

/** D-8①：语料库统计（递归计数，口径与检索一致） */
export interface CorpusStats {
  file_count: number;
  dir_count: number;
}

/** D-8①：读取语料库统计（用于「语料还是空的」轻提示；不阻断对话） */
export const corpusStats = (): Promise<CorpusStats> =>
  invoke<CorpusStats>("corpus_stats");

/** 读取全部索引卡 */
export const configGetTopics = (): Promise<TopicCard[]> =>
  invoke<TopicCard[]>("config_get_topics");

/** 保存全部索引卡（整组替换） */
export const configSetTopics = (topics: TopicCard[]): Promise<void> =>
  invoke<void>("config_set_topics", { topics });

// ---- v4.26 语料导入 ----

/** 导入结果（corpus_import.rs ImportResult） */
export interface ImportResult {
  files_selected: number;
  files_converted: number;
  files_failed: number;
  output_dir: string;
  details: string[];
}

/** 弹文件选择器（多选 epub/pdf），取消返回空数组。
 *  v4.26 修正：改用 Tauri 官方 dialog 插件（rfd 在 async 命令线程 Windows 下弹不出）。 */
export const pickCorpusFiles = async (): Promise<string[]> => {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    multiple: true,
    title: "选择要转化的文件（epub / pdf，可多选）",
    filters: [{ name: "电子书 / PDF", extensions: ["epub", "pdf"] }],
  });
  if (!picked) return []; // 用户取消
  return Array.isArray(picked) ? picked : [picked];
};

/** 将选定文件逐个转为 md，落 corpus/<书名>/ */
export const importCorpusFile = (paths: string[]): Promise<ImportResult> =>
  invoke<ImportResult>("import_corpus_file", { paths });
