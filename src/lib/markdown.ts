/**
 * Markdown 数据层。
 * 单一职责：每日文件的解析与「章节级写回」。
 *
 * 核心原则——章节级写回（计划关键设计 1）：
 *   应用永远只替换「被 UI 修改的章节/字段」，其余内容字节级原样保留，
 *   保证用户手改的文件永远不会被应用规范化重排（AI Native：文件永远可手编）。
 *
 * 章节边界：## 日程 / ## 今日清单 / ## 临时记录 / ## 专注记录 / ## 今日收尾
 * 行格式：任务 `- [ ]`/`- [x]`；专注 `- HH:mm · 标题 · N 分钟 · 模式`；
 *         日程 `- HH:mm-HH:mm 标题` / `- 全天 · 标题`（v4.4 落盘：事件增删改经 debounce 写回）。
 * 解析容错：允许 `##日程`（无空格）、全角空格、CRLF、`- [X]` 等手写变体；
 *           无法识别的章节与行原样保留不动。
 * frontmatter 解析为手写 YAML-lite（浏览器/Node 同构）：
 *   曾试 gray-matter，但其 CJS 内部 require('fs') 在 WebView 里模块加载即崩（实测），
 *   故本模块只实现本格式约束下的最小解析：标量/引号串/流式数组/注释；写入侧本就是行级手术。
 */

import type { DailyMetrics, DailyNote, FocusSession, TaskItem } from "../types/schema";
import { emptyMetrics } from "../types/schema";
import { genId } from "../mock/preview";
import type { EventItem } from "../types/schema";

/** frontmatter 中 UI 管理的量化指标键（其余键如 habits/goals/energy_peak 原样保留） */
const METRIC_KEYS = [
  "sleep_hours",
  "sleep_quality",
  "sleep_bedtime",
  "sleep_wake",
  "weight_kg",
  "spend_total",
  "mood",
  "focus_minutes",
  "steps",
] as const;

/** 章节标题（模板顺序） */
const SECTION_TITLES = ["日程", "今日清单", "临时记录", "专注记录", "今日收尾"] as const;

/* ---- 小工具 ---- */

/** 章节标题 → 行首匹配正则（容错：`##` 后空格可有可无、全角空格、行尾空白） */
function headingRe(title: string): RegExp {
  return new RegExp(`^##[ \\t\\u3000]*${title}[ \\t\\u3000]*$`, "m");
}

/** 章节定位：headingStart（含）~ bodyEnd（不含，指向下一个二级标题行首或文末） */
interface SectionPos {
  headingStart: number;
  bodyStart: number;
  bodyEnd: number;
}

function findSection(text: string, title: string): SectionPos | null {
  const m = headingRe(title).exec(text);
  if (!m) return null;
  const headingStart = m.index;
  let bodyStart = m.index + m[0].length;
  // 跳过标题行结尾的换行
  if (text[bodyStart] === "\n") bodyStart += 1;
  const after = text.slice(bodyStart);
  const next = /^##[^\n]*$/m.exec(after); // 下一个二级标题（### 属于章节内部，不算边界）
  const bodyEnd = next ? bodyStart + next.index : text.length;
  return { headingStart, bodyStart, bodyEnd };
}

/** 取章节原文（去掉首尾空白行）；不存在返回空串 */
function sectionBody(text: string, title: string): string {
  const sec = findSection(text, title);
  if (!sec) return "";
  return text.slice(sec.bodyStart, sec.bodyEnd).replace(/^\n+/, "").replace(/\n+$/, "");
}

/** YAML 标量格式化：null → null；数字原样；字符串加双引号（HH:mm 防被误读为时间类型） */
function yamlValue(v: number | string | null): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

/** 分钟数（YAML 1.1 把裸 `23:30` 读成六十进制整数 1410）→ HH:mm */
function minutesToHHmm(total: number): string | null {
  if (!Number.isFinite(total) || total < 0) return null;
  const m = Math.round(total) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** frontmatter 指标字段解析（容错：数字串、六十进制整数、多余空白） */
function toMetricValue(key: string, raw: unknown): number | string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (key === "sleep_bedtime" || key === "sleep_wake") return minutesToHHmm(raw);
    return raw;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "") return null;
    if (key === "sleep_bedtime" || key === "sleep_wake") {
      return /^\d{1,2}:\d{2}$/.test(s) ? s : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** YAML-lite 标量解析：null/数字/引号串/流式数组/裸串；裸 HH:mm 保持字符串（语义更对） */
function parseScalar(s: string): unknown {
  const t = s.trim();
  if (t === "" || t === "null" || t === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (t.startsWith("[") && t.endsWith("]")) {
    return t
      .slice(1, -1)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return t;
}

/** frontmatter 块解析：顶层 `key: value`；注释/空行/嵌套行跳过（写入侧原样保留，不归解析管） */
function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  content: string;
  hasFm: boolean;
} {
  const m = /^---[ \t]*\n([\s\S]*?)---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { data: {}, content: text, hasFm: false };
  const data: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    if (line.trim() === "" || /^\s*[#/]/.test(line) || /^\s/.test(line)) continue;
    const kv = /^([^:]+):[ \t]*(.*)$/.exec(line);
    if (kv) data[kv[1].trim()] = parseScalar(kv[2]);
  }
  return { data, content: text.slice(m[0].length), hasFm: true };
}

/* ---- 解析 ---- */

/** parseDaily 的返回：结构化数据（全部来自已知章节与 frontmatter） */
export interface ParsedDaily {
  metrics: DailyMetrics;
  tasks: TaskItem[];
  /** ## 临时记录 原文（自由文本，含用户手写的子标题等） */
  notes: string;
  /** ## 今日收尾 原文 */
  review: string;
  /** ## 专注记录 解析出的专注记录 */
  focusLog: FocusSession[];
  /** ## 日程 原始行（v4.4 起日历接真：经 schedulesToEvents 转为 EventItem） */
  schedules: string[];
  /** 是否存在 frontmatter 块 */
  hasFrontmatter: boolean;
}

/** 解析每日文件全文。date 用于给解析出的任务/专注记录生成 id 关联与日期归属。 */
export function parseDaily(text: string, date: string): ParsedDaily {
  const crlf = text.includes("\r\n");
  const lf = crlf ? text.replace(/\r\n/g, "\n") : text;

  const fm = parseFrontmatter(lf);
  const data = fm.data;
  const content = fm.content;
  const hasFrontmatter = fm.hasFm;

  const raw: Record<string, number | string | null> = {};
  for (const key of METRIC_KEYS) {
    const v = toMetricValue(key, data[key]);
    raw[key] = v === undefined ? null : v;
  }
  const metrics = raw as unknown as DailyMetrics;

  const tasks: TaskItem[] = [];
  for (const line of sectionBody(content, "今日清单").split("\n")) {
    const m = /^[ \t]*[-*][ \t]*\[([ xX])\][ \t]*(.*)$/.exec(line);
    if (m) tasks.push({ id: genId("task"), text: m[2].trim(), done: m[1].toLowerCase() === "x" });
  }

  const focusLog: FocusSession[] = [];
  for (const line of sectionBody(content, "专注记录").split("\n")) {
    const m =
      /^[ \t]*[-*][ \t]*(\d{1,2}:\d{2})[ \t]*·[ \t]*(.*?)[ \t]*·[ \t]*(\d+)[ \t]*分钟[ \t]*·[ \t]*(倒计时|正计时)[ \t]*$/.exec(
        line,
      );
    if (m) {
      focusLog.push({
        id: genId("focus"),
        date,
        startHHmm: m[1],
        task: m[2],
        minutes: Number(m[3]),
        mode: m[4] === "倒计时" ? "countdown" : "stopwatch",
      });
    }
  }

  const schedules = sectionBody(content, "日程")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    metrics,
    tasks,
    notes: sectionBody(content, "临时记录"),
    review: sectionBody(content, "今日收尾"),
    focusLog,
    schedules,
    hasFrontmatter,
  };
}

/* ---- 写回（章节级手术） ---- */

/**
 * 替换章节体：只动 [bodyStart, bodyEnd) 区域，其余字节不动。
 * 章节体规范：标题行后直接接内容行，末尾与下一标题之间空一行；末章节无多余空行。
 */
function replaceSectionBody(text: string, title: string, body: string): string {
  const sec = findSection(text, title);
  const newBody = body.trim() === "" ? "" : body.replace(/^\n+/, "").replace(/\n+$/, "");
  const isLast = sec === null || sec.bodyEnd >= text.length;
  let insertion: string;
  if (newBody === "") {
    insertion = isLast ? "" : "\n";
  } else {
    insertion = newBody + "\n" + (isLast ? "" : "\n");
  }
  if (sec) {
    return text.slice(0, sec.bodyStart) + insertion + text.slice(sec.bodyEnd);
  }
  return insertMissingSection(text, title, insertion);
}

/** 章节缺失时按模板顺序插入：插在「模板序中其后第一个已存在章节」之前，否则追加文末 */
function insertMissingSection(text: string, title: string, bodyInsertion: string): string {
  const order = [...SECTION_TITLES];
  const idx = order.indexOf(title as (typeof SECTION_TITLES)[number]);
  for (let i = idx + 1; i < order.length; i++) {
    const m = headingRe(order[i]).exec(text);
    if (m) {
      const head = "## " + title + "\n" + bodyInsertion;
      return text.slice(0, m.index) + head + text.slice(m.index);
    }
  }
  const tail = text.endsWith("\n") || text === "" ? text : text + "\n";
  return tail + "## " + title + "\n" + (bodyInsertion === "" ? "\n" : bodyInsertion);
}

/** 写回 frontmatter 指标：字段级手术，仅重写 9 个指标行，其余键（habits/goals/…）原样保留 */
export function writeMetrics(text: string, metrics: DailyMetrics, date: string): string {
  const crlf = text.includes("\r\n");
  let lf = crlf ? text.replace(/\r\n/g, "\n") : text;

  if (!/^---[ \t]*\n/.test(lf)) {
    // 无 frontmatter：按模板补全块（不覆盖正文）
    const fm = ["---", `date: ${date}`, "type: daily", ...METRIC_KEYS.map((k) => `${k}: null`), "habits: []", "goals: []", "---", ""].join("\n");
    lf = fm + "\n" + lf;
  }

  const open = lf.indexOf("\n") + 1; // 首行 --- 之后
  const closeRel = /^---[ \t]*$/m.exec(lf.slice(open));
  if (!closeRel) return crlf ? lf.replace(/\n/g, "\r\n") : lf; // 结构异常：不动
  const closeStart = open + closeRel.index;

  let fmText = lf.slice(open, closeStart);
  const hadTrailingNl = fmText.endsWith("\n");
  const lines = (hadTrailingNl ? fmText.slice(0, -1) : fmText).split("\n");

  for (const key of METRIC_KEYS) {
    const v = metrics[key];
    const re = new RegExp(`^[ \\t]*${key}[ \\t]*:`);
    const i = lines.findIndex((l) => re.test(l));
    const newLine = `${key}: ${yamlValue(v)}`;
    if (i >= 0) lines[i] = newLine;
    else lines.push(newLine);
  }

  fmText = lines.join("\n") + (hadTrailingNl || lines.length ? "\n" : "");
  lf = lf.slice(0, open) + fmText + lf.slice(closeStart);
  return crlf ? lf.replace(/\n/g, "\r\n") : lf;
}

/** 写回 ## 今日清单（任务行 `- [ ]`/`- [x]`） */
export function writeTasks(text: string, tasks: TaskItem[]): string {
  return eolAware(text, (lf) =>
    replaceSectionBody(
      lf,
      "今日清单",
      tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n"),
    ),
  );
}

/** 写回 ## 临时记录（自由文本） */
export function writeNotes(text: string, notes: string): string {
  return eolAware(text, (lf) => replaceSectionBody(lf, "临时记录", notes));
}

/** 写回 ## 今日收尾 */
export function writeReview(text: string, review: string): string {
  return eolAware(text, (lf) => replaceSectionBody(lf, "今日收尾", review));
}

/** 写回 ## 专注记录（`- HH:mm · 标题 · N 分钟 · 模式`，按开始时刻排序） */
export function writeFocusLog(text: string, sessions: FocusSession[]): string {
  const sorted = sessions.slice().sort((a, b) => a.startHHmm.localeCompare(b.startHHmm));
  const body = sorted
    .map((s) => `- ${s.startHHmm} · ${s.task || "专注"} · ${s.minutes} 分钟 · ${s.mode === "countdown" ? "倒计时" : "正计时"}`)
    .join("\n");
  return eolAware(text, (lf) => replaceSectionBody(lf, "专注记录", body));
}

/** 写回 ## 日程（`- HH:mm-HH:mm 标题` / `- 全天 · 标题`，按时间排序；v4.4 事件落盘） */
export function writeSchedules(text: string, date: string, events: EventItem[]): string {
  const day = sortEvents(events.filter((e) => e.date === date));
  const body = day
    .map((e) =>
      e.start === null
        ? `- 全天 · ${e.title}`
        : `- ${e.start}${e.end ? `-${e.end}` : ""} ${e.title}`,
    )
    .join("\n");
  return eolAware(text, (lf) => replaceSectionBody(lf, "日程", body));
}

/** `## 日程` 行 → 事件（loadAll 反向装载；source 统一 manual，排程关联不还原） */
export function schedulesToEvents(schedules: string[], date: string): EventItem[] {
  const out: EventItem[] = [];
  for (const line of schedules) {
    let m = /^-\s*全天\s*·\s*(.+)$/.exec(line);
    if (m) {
      out.push({ id: genId("evt"), title: m[1], date, start: null, end: null, source: "manual" });
      continue;
    }
    m = /^-\s*(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\s+(.+)$/.exec(line);
    if (m) {
      out.push({ id: genId("evt"), title: m[3], date, start: m[1], end: m[2] ?? null, source: "manual" });
    }
  }
  return out;
}

/** 正文提取（frontmatter 之后的部分，去首部空行）——编辑器模式缓冲（v4.4） */
export function dailyBody(text: string): string {
  const m = /^---[ \t]*\n[\s\S]*?---[ \t]*(?:\n|$)/.exec(text);
  return (m ? text.slice(m[0].length) : text).replace(/^\n+/, "");
}

/**
 * 正文整体替换（编辑器模式保存）：frontmatter 字节级保留（指标仍由 GUI 表单管理），
 * 其余整体换成编辑器 Markdown。fm 与正文间保持一个空行，正文以单个换行结尾。
 */
export function replaceBody(text: string, body: string): string {
  return eolAware(text, (lf) => {
    const m = /^---[ \t]*\n[\s\S]*?---[ \t]*(?:\n|$)/.exec(lf);
    const b = body.trim() === "" ? "" : body.replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
    if (!m) return b === "" ? "\n" : b;
    return b === "" ? m[0] : m[0] + "\n" + b;
  });
}

/** CRLF 文件进出同格式（Windows 记事本手编场景） */
function eolAware(text: string, fn: (lf: string) => string): string {
  const crlf = text.includes("\r\n");
  const lf = crlf ? text.replace(/\r\n/g, "\n") : text;
  const out = fn(lf);
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

/* ---- 模板与全量序列化 ---- */

/** 每日模板：空 frontmatter（全部指标 null）+ 五个空章节 */
export function buildDailyFile(date: string, metrics: DailyMetrics | null = null): string {
  const m = metrics ?? emptyMetrics();
  return [
    "---",
    `date: ${date}`,
    "type: daily",
    ...METRIC_KEYS.map((k) => `${k}: ${yamlValue(m[k])}`),
    "energy_peak: null",
    "habits: []",
    "goals: []",
    "---",
    "",
    "## 日程",
    "",
    "## 今日清单",
    "",
    "## 临时记录",
    "",
    "## 专注记录",
    "",
    "## 今日收尾",
    "",
  ].join("\n");
}

/** 全量序列化（模板 → 各章节写入）：用于往返自测与 frontmatter 异常时的恢复重建 */
export function serializeDaily(note: DailyNote, focusLog: FocusSession[] = []): string {
  let text = buildDailyFile(note.date, note.metrics);
  text = writeTasks(text, note.tasks);
  text = writeNotes(text, note.notes);
  text = writeReview(text, note.review);
  text = writeFocusLog(text, focusLog);
  return text;
}

/* ---- 原型期保留：日历事件 → Markdown 预览（CalendarPage 引用） ---- */

/** 当日事件按时间排序：定时事件按开始时间，全天事件排最后 */
function sortEvents(events: EventItem[]): EventItem[] {
  return events.slice().sort((a, b) => {
    if (a.start === null && b.start === null) return a.title.localeCompare(b.title);
    if (a.start === null) return 1;
    if (b.start === null) return -1;
    return a.start.localeCompare(b.start);
  });
}

/** 序列化为当日文件的 `## 日程` 区块（AI Native：单文件即一天全貌） */
export function eventsToMarkdown(date: string, events: EventItem[]): string {
  const day = sortEvents(events.filter((e) => e.date === date));
  const lines = day.map((e) =>
    e.start === null
      ? `- 全天 · ${e.title}`
      : `- ${e.start}${e.end ? `-${e.end}` : ""} ${e.title}`,
  );
  return ["## 日程", ...lines].join("\n");
}
