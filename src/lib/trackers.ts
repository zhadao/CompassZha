/**
 * 数据追踪项常量表与纯函数（E-1：内置 8 项可录 + 番茄钟写入的专注时长）。
 *
 * 关键约定（勿改）：
 * - 内置可录 8 项走与自定义项**同一套机制**（form / 卡片 / 趋势图都由 app.trackers 驱动）；
 * - `focus_minutes` 由番茄钟写入，**不参与表单**（因此不在 BUILTIN_TRACKERS）；
 * - 自定义键一律 `x_<英文 slug>`，值落当日 frontmatter 的 `x_` 键；
 * - 未知 / 已删追踪项的 `x_` 键**原样保留**（写回只做「本次提交的键」的字段级手术）。
 */

import type { TrackerDef } from "../types/schema";

/** 自定义指标键前缀（P-2 拍板：`x_<英文slug>`） */
export const CUSTOM_PREFIX = "x_";

/** 专注时长键（番茄钟写入，不可手录） */
export const FOCUS_KEY = "focus_minutes";

/** 档位型默认上限 */
export const DEFAULT_LEVEL_MAX = 5;

/** 内置可录 8 项（顺序 = 今日表单与仪表盘默认呈现顺序；中文名沿用 METRIC_LABELS） */
export const BUILTIN_TRACKERS: TrackerDef[] = [
  { key: "sleep_hours", name: "睡眠时长", unit: "小时", kind: "number", direction: "up", step: "0.5", builtin: true, hidden: false },
  { key: "sleep_quality", name: "睡眠质量", unit: "/5", kind: "level", direction: "up", max: 5, builtin: true, hidden: false },
  { key: "sleep_bedtime", name: "入睡时间", unit: "", kind: "time", direction: "down", builtin: true, hidden: false },
  { key: "sleep_wake", name: "起床时间", unit: "", kind: "time", direction: "up", builtin: true, hidden: false },
  { key: "weight_kg", name: "体重", unit: "kg", kind: "number", direction: "down", step: "0.1", builtin: true, hidden: false },
  { key: "spend_total", name: "当日支出", unit: "元", kind: "number", direction: "down", step: "0.01", builtin: true, hidden: false },
  { key: "mood", name: "心情", unit: "/5", kind: "level", direction: "up", max: 5, builtin: true, hidden: false },
  { key: "steps", name: "运动步数", unit: "步", kind: "number", direction: "up", step: "1", builtin: true, hidden: false },
];

/** 专注时长（番茄钟写入；仪表盘 / 趋势图仍按内置项呈现，但表单不渲染） */
export const FOCUS_TRACKER: TrackerDef = {
  key: FOCUS_KEY,
  name: "专注时长",
  unit: "分钟",
  kind: "number",
  direction: "up",
  builtin: true,
  hidden: false,
};

/** 全部内置项（8 项可录 + 专注时长）；仪表盘 / 趋势图取数用 */
export const ALL_BUILTIN_TRACKERS: TrackerDef[] = [...BUILTIN_TRACKERS, FOCUS_TRACKER];

/** 内置项键集合（含专注时长）——用于校验与折叠集合 */
export const BUILTIN_KEYS: string[] = ALL_BUILTIN_TRACKERS.map((t) => t.key);

/** 是否为自定义键（`x_` 前缀） */
export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX);
}

/** 英文 slug 合法性：小写字母开头，后接小写字母 / 数字 / 下划线，总长 ≤ 24 */
export function validateSlug(slug: string): boolean {
  return /^[a-z][a-z0-9_]{0,23}$/.test(slug);
}

/** 生成未占用的自动键：`x_t1`、`x_t2`…（递增，跳过已占用） */
export function newTrackerKey(taken: string[]): string {
  for (let i = 1; ; i++) {
    const key = `${CUSTOM_PREFIX}t${i}`;
    if (!taken.includes(key)) return key;
  }
}

/** 分钟数 → HH:mm（自定义 time 型展示用） */
function minutesToHHmm(total: number): string {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 追踪项取值 → 展示字符串（null = 未记录 → 「—」） */
export function fmtTrackerValue(def: TrackerDef, v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (def.kind === "time") {
    if (typeof v === "string") return v;
    return Number.isFinite(v) ? minutesToHHmm(v) : "—";
  }
  if (def.kind === "bool") return Number(v) >= 1 ? "是" : "否";
  return `${v}${def.unit ?? ""}`;
}
