/**
 * E-2 每周罗盘简报的内容生成（纯函数，无副作用：不读时间、不读 store、不落盘）。
 *
 * 统计口径（全部本地聚合，不依赖任何 API）：
 *   - 本周区间 = 含 `today` 的那个**周一～周日**；对比区间 = 上一周同区间；
 *   - 关键指标：睡眠时长 / 步数（日均）、支出（合计）、体重（最近一次）、心情（均分）；
 *   - 板块痕迹：本周 7 天里「当日清单提到该板块标签」的次数合计（不判完成）；
 *   - 专注合计：本周专注记录的段数与分钟合计（番茄钟真实记录）；
 *   - 哪些任务做得最少：本周未完成任务的去重文本（最多 3 条）；
 *   - 一句话建议：无 AI Key 时的**规则模板**（有 key 时由 store 侧异步替换为 AI 结论）。
 */

import { fromDateKey, offsetDays, toDateKey } from "./date";
import { hasGoalTag, stripAllGoalTags } from "./markdown";
import { pickFocus, type FocusBoardInput, type FocusTaskInput } from "./pick-focus";
import type { DailyNote, FocusSession } from "../types/schema";

/** 日期 → 「10月14日」（简报区间用短格式，不带年份/星期） */
export function shortCN(dateKey: string): string {
  const d = fromDateKey(dateKey);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 一段闭区间日期（yyyy-mm-dd） */
export interface WeekRange {
  start: string;
  end: string;
}

/** 含 `dateKey` 的那一周（周一 → 周日） */
export function weekRangeOf(dateKey: string): WeekRange {
  const d = fromDateKey(dateKey);
  const dow = d.getDay(); // 0 = 周日
  const backToMon = dow === 0 ? 6 : dow - 1;
  const start = offsetDays(dateKey, -backToMon);
  return { start, end: offsetDays(start, 6) };
}

/** 上一周（同长度、紧邻其前） */
export function prevWeekOf(r: WeekRange): WeekRange {
  return { start: offsetDays(r.start, -7), end: offsetDays(r.end, -7) };
}

/** 区间内日期列表（含首尾） */
function daysIn(r: WeekRange): string[] {
  const out: string[] = [];
  let cur = r.start;
  while (cur <= r.end) {
    out.push(cur);
    cur = offsetDays(cur, 1);
  }
  return out;
}

/* ---- 关键指标 ---- */

export interface MetricPair {
  label: string;
  unit: string;
  agg: "avg" | "sum" | "latest";
  thisWeek: number | null;
  lastWeek: number | null;
  decimals: number;
}

/** 一组数值按聚合方式取值；空数组 → null */
export function aggregate(
  values: number[],
  agg: MetricPair["agg"],
): number | null {
  if (values.length === 0) return null;
  if (agg === "sum") return values.reduce((a, b) => a + b, 0);
  if (agg === "latest") return values[values.length - 1];
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 指标变化一行：「睡眠时长 7.2 小时（较上周 +0.3）」 */
export function metricLine(p: MetricPair): string {
  const cur = p.thisWeek;
  const prev = p.lastWeek;
  const v = (n: number) => n.toFixed(p.decimals);
  if (cur === null) return `${p.label} 本周无记录`;
  const base = `${p.label} ${v(cur)} ${p.unit}`;
  if (prev === null) return `${base}（上周无数据）`;
  const d = cur - prev;
  if (Math.abs(d) < (p.decimals > 0 ? 0.05 : 0.5)) return `${base}（与上周持平）`;
  const sign = d > 0 ? "+" : "−";
  return `${base}（较上周 ${sign}${Math.abs(d).toFixed(p.decimals)}）`;
}

/** 从日记里取某指标的数值序列（按日期升序，跳过 null） */
function metricSeries(
  notes: Record<string, DailyNote>,
  r: WeekRange,
  key: keyof DailyNote["metrics"],
): number[] {
  const out: number[] = [];
  for (const d of daysIn(r)) {
    const v = notes[d]?.metrics?.[key];
    if (typeof v === "number") out.push(v);
  }
  return out;
}

/* ---- 板块痕迹 ---- */

export interface BoardTrace {
  name: string;
  /** 本周提及次数（当日清单含 `#goal/板块名` 的任务条数，不论完成） */
  mentions: number;
  /** 最近一次留痕距今天数；null = 从未留痕 */
  daysSince: number | null;
}

/** 某天该板块的提及数 */
function mentionsOn(note: DailyNote | undefined, name: string): number {
  if (!note) return 0;
  return note.tasks.filter((t) => hasGoalTag(t.text, name)).length;
}

/** 板块痕迹一行：「英语 本周 0 次 · 最近留痕 32 天前」 */
export function boardLine(t: BoardTrace): string {
  const recent =
    t.daysSince === null
      ? "从未留痕"
      : t.daysSince === 0
        ? "今天留痕"
        : `最近留痕 ${t.daysSince} 天前`;
  return `${t.name} 本周 ${t.mentions} 次 · ${recent}`;
}

/* ---- 一句话建议（规则模板） ---- */

/** 规则模板：本周未做完 → 停滞板块 → 无专注 → 保持节奏 */
export function suggestFromRules(input: {
  openTasks: number;
  stalled: FocusBoardInput[];
  unfinished: FocusTaskInput[];
  focusCount: number;
}): string {
  const pick = pickFocus(input.stalled, input.unfinished);
  if (pick) {
    return pick.kind === "board"
      ? `「${pick.title}」已经搁了一段时间，本周给它留 25 分钟。`
      : `先动最小的一件：「${pick.title}」。`;
  }
  if (input.openTasks > 0) {
    return `本周还有 ${input.openTasks} 项没做完，先挑最小的一件开始。`;
  }
  if (input.focusCount === 0) {
    return "本周还没有专注记录，用 15 分钟开个头试试。";
  }
  return "本周节奏保持得不错，继续按现在的安排走就好。";
}

/* ---- 汇总 ---- */

export interface BriefingResult {
  /** 弹层主标题 */
  title: string;
  /** 「10月14日 ~ 10月20日 · 本周」 */
  dateRange: string;
  metricLines: string[];
  boardLines: string[];
  focusLine: string;
  /** 完成 / 未完成一行 */
  taskLine: string;
  /** 哪些任务做得最少（最多 3 条，未完成任务文本） */
  taskLines: string[];
  suggestion: string;
}

export interface BriefingSource {
  /** 日记（date → 内容；缺该日视为无记录） */
  notes: Record<string, DailyNote>;
  /** 全部专注记录（函数自行按日期筛） */
  focus: FocusSession[];
  /** 板块名 → 最近留痕天数（null = 从未留痕） */
  boards: Array<{ name: string; daysSinceTrace: number | null }>;
  /** 今天 yyyy-mm-dd */
  today: string;
}

/** 生成简报（纯函数：同输入同输出） */
export function buildBriefing(src: BriefingSource): BriefingResult {
  const thisWeek = weekRangeOf(src.today);
  const lastWeek = prevWeekOf(thisWeek);

  const metrics: MetricPair[] = [
    {
      label: "睡眠时长",
      unit: "小时",
      agg: "avg",
      thisWeek: aggregate(metricSeries(src.notes, thisWeek, "sleep_hours"), "avg"),
      lastWeek: aggregate(metricSeries(src.notes, lastWeek, "sleep_hours"), "avg"),
      decimals: 1,
    },
    {
      label: "步数",
      unit: "步",
      agg: "avg",
      thisWeek: aggregate(metricSeries(src.notes, thisWeek, "steps"), "avg"),
      lastWeek: aggregate(metricSeries(src.notes, lastWeek, "steps"), "avg"),
      decimals: 0,
    },
    {
      label: "支出",
      unit: "元",
      agg: "sum",
      thisWeek: aggregate(metricSeries(src.notes, thisWeek, "spend_total"), "sum"),
      lastWeek: aggregate(metricSeries(src.notes, lastWeek, "spend_total"), "sum"),
      decimals: 0,
    },
    {
      label: "体重",
      unit: "kg",
      agg: "latest",
      thisWeek: aggregate(metricSeries(src.notes, thisWeek, "weight_kg"), "latest"),
      lastWeek: aggregate(metricSeries(src.notes, lastWeek, "weight_kg"), "latest"),
      decimals: 1,
    },
    {
      label: "心情",
      unit: "分",
      agg: "avg",
      thisWeek: aggregate(metricSeries(src.notes, thisWeek, "mood"), "avg"),
      lastWeek: aggregate(metricSeries(src.notes, lastWeek, "mood"), "avg"),
      decimals: 1,
    },
  ];

  const boardTraces: BoardTrace[] = src.boards.map((b) => ({
    name: b.name,
    mentions: daysIn(thisWeek).reduce(
      (n, d) => n + mentionsOn(src.notes[d], b.name),
      0,
    ),
    daysSince: b.daysSinceTrace,
  }));

  const inWeek = new Set(daysIn(thisWeek));
  const weekFocus = src.focus.filter((f) => inWeek.has(f.date));
  const focusMinutes = weekFocus.reduce((n, f) => n + f.minutes, 0);
  const h = Math.floor(focusMinutes / 60);
  const m = focusMinutes % 60;
  const focusLine =
    weekFocus.length === 0
      ? "本周还没有专注记录"
      : `本周专注 ${h > 0 ? `${h} 小时 ` : ""}${m} 分钟，共 ${weekFocus.length} 段`;

  let done = 0;
  let open = 0;
  const undoneTexts: string[] = [];
  for (const d of daysIn(thisWeek)) {
    for (const t of src.notes[d]?.tasks ?? []) {
      if (t.done) {
        done += 1;
      } else {
        open += 1;
        const text = stripAllGoalTags(t.text).trim();
        if (text && !undoneTexts.includes(text)) undoneTexts.push(text);
      }
    }
  }

  const stalled = boardTraces
    .filter((b) => b.daysSince !== null)
    .map((b) => ({ name: b.name, daysSinceTrace: b.daysSince }));
  const unfinished: FocusTaskInput[] = undoneTexts.map((text) => ({ text, done: false }));

  return {
    title: "本周罗盘简报",
    dateRange: `${shortCN(thisWeek.start)} ~ ${shortCN(thisWeek.end)}`,
    metricLines: metrics.map(metricLine),
    boardLines: boardTraces.map(boardLine),
    focusLine,
    taskLine: `本周完成 ${done} 项，还有 ${open} 项未完成`,
    taskLines: undoneTexts.slice(0, 3).map((t) => `做得最少：${t}`),
    suggestion: suggestFromRules({ openTasks: open, stalled, unfinished, focusCount: weekFocus.length }),
  };
}

/* ---- 触发时机（到点 / 启动补发共用一套判定） ---- */

/** 本地时刻戳 `YYYY-MM-DDTHH:mm`（与 Rust `last_shown` 同格式） */
export function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 把 `weekday`(0=周日) + `time`(HH:mm) 解析成 Date（在 `ref` 所在那一周内） */
function dueDateInWeek(ref: Date, weekday: number, time: string): Date {
  const [hh, mm] = time.split(":").map((x) => Number(x));
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), hh || 0, mm || 0, 0, 0);
  const delta = weekday - d.getDay();
  d.setDate(d.getDate() + delta);
  return d;
}

/** 最近一次「应该出简报」的时刻（本周该点未到则取上周那次） */
export function latestDueAt(now: Date, weekday: number, time: string): Date {
  const thisWeek = dueDateInWeek(now, weekday, time);
  if (thisWeek.getTime() <= now.getTime()) return thisWeek;
  const prev = new Date(thisWeek);
  prev.setDate(prev.getDate() - 7);
  return prev;
}

/**
 * 到点 / 补发判定：启用后，只要「最近应触发时刻」晚于上次弹出时刻，就该弹。
 * （关着软件错过时刻 → 下次启动时 `last_shown` 仍早于该时刻 → 补发。）
 */
export function isBriefingDue(
  now: Date,
  enabled: boolean,
  weekday: number,
  time: string,
  lastShown: string | null,
): boolean {
  if (!enabled) return false;
  const due = stamp(latestDueAt(now, weekday, time));
  return lastShown === null || lastShown < due;
}
