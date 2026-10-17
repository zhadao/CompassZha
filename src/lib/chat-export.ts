/**
 * v4.22 §2.12：隆中对对话归档（conversations/）。
 * 纯前端序列化：手写 frontmatter（不引 gray-matter，与 markdown.ts 同风格）+ 分块正文。
 * 落盘路径固定为 `conversations/yyyy-mm-dd_hh-mm_标题.md`，供后续 AI 分析与定期归档。
 */

import type { CorpusHit } from "./ai";

/** 对话气泡（ChatPage 内存态；citations 为检索引用出处，仅 assistant 有） */
export interface ChatBubble {
  role: "user" | "assistant";
  content: string;
  citations?: CorpusHit[];
}

/** 文件名非法字符（Windows 保留：\ / : * ? " < > |，另去换行与制表） */
const ILLEGAL = /[\\/:*?"<>|\r\n\t]/g;

/** 标题：取首条用户消息前 15 个字符，清洗文件名非法字符；无用户消息时回落「对话记录」 */
export function slugTitle(bubbles: ChatBubble[]): string {
  const first = bubbles.find((b) => b.role === "user")?.content ?? "";
  const flat = first.replace(/\s+/g, " ").trim();
  const clean = Array.from(flat)
    .slice(0, 15)
    .join("")
    .replace(ILLEGAL, "")
    .trim();
  return clean || "对话记录";
}

/** 本地时间戳：yyyy-mm-dd hh:mm */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 文件名时间戳：yyyy-mm-dd_hh-mm */
function fileStamp(d: Date): string {
  return localStamp(d).replace(" ", "_").replace(":", "-");
}

/** 归档相对路径：conversations/yyyy-mm-dd_hh-mm_标题.md */
export function conversationRel(title: string, at: Date = new Date()): string {
  return `conversations/${fileStamp(at)}_${title}.md`;
}

/** 单条消息 → `### User` / `### Assistant` 分块（含引用出处列表） */
function block(b: ChatBubble): string {
  const who = b.role === "user" ? "User" : "Assistant";
  const lines = [`### ${who}`, "", b.content.trim(), ""];
  if (b.citations && b.citations.length > 0) {
    lines.push(
      "引用出处：",
      ...b.citations.map((c, i) => `${i + 1}. ${c.title}（${c.rel_path}）`),
      "",
    );
  }
  return lines.join("\n");
}

/**
 * 序列化整轮对话：frontmatter（时间 / 消息数 / 模型 / 引用数）+ H1 标题 + 分块正文。
 * 注：token 用量暂不记录（Rust ai_ask 未回传 usage，登记为可选后续）。
 */
export function toConversationMd(
  bubbles: ChatBubble[],
  model: string,
  at: Date = new Date(),
): string {
  const cites = bubbles.reduce((n, b) => n + (b.citations?.length ?? 0), 0);
  const head = [
    "---",
    `date: ${localStamp(at)}`,
    "type: conversation",
    `model: ${model || "unknown"}`,
    `messages: ${bubbles.length}`,
    `citations: ${cites}`,
    "---",
    "",
    `# ${slugTitle(bubbles)}`,
    "",
    "",
  ];
  return head.join("\n") + bubbles.map(block).join("\n");
}
