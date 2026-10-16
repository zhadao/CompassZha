/**
 * AI 对话接缝层（阶段 4 · v4.12）：唯一允许出现 invoke 调用的位置之一（与 tauri-fs.ts 同级）。
 * 语料对话仅检索 dataRoot/corpus/（日记/量化数据绝不进入检索——v4.12 用户澄清）。
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

/** 设置页 AI 配置（ai_get_config 返回） */
export interface AiConfig {
  base_url: string;
  model: string;
  key_saved: boolean;
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
 */
export const aiSetConfig = (
  baseUrl: string,
  model: string,
  key: string | null,
): Promise<void> =>
  invoke<void>("ai_set_config", {
    baseUrl,
    model,
    key,
  });

/** 语料对话：扩词 → 检索 corpus/ → 生成（返回回答 + 引用出处） */
export const aiAsk = (messages: ChatMsg[]): Promise<AiAnswer> =>
  invoke<AiAnswer>("ai_ask", { messages });

/** 「资源跳转」：用系统资源管理器打开语料文件夹 */
export const openCorpusFolder = (): Promise<void> =>
  invoke<void>("open_corpus_folder");

/** 读取全部索引卡 */
export const configGetTopics = (): Promise<TopicCard[]> =>
  invoke<TopicCard[]>("config_get_topics");

/** 保存全部索引卡（整组替换） */
export const configSetTopics = (topics: TopicCard[]): Promise<void> =>
  invoke<void>("config_set_topics", { topics });
