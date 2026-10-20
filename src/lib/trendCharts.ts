/**
 * 趋势图的类型定义、取值辅助与**图定义派生**（E-1：由追踪项表生成图定义）。
 * 纯函数与类型，无副作用；组件只负责 ECharts 实例与渲染。
 */

import type { DailyNote, TrackerDef } from "../types/schema";

/** 单一折线系列 */
export interface SeriesSpec {
  name: string;
  color: string;
  /** 该系列在 date 当天的值；null = 无记录（断点） */
  get: (date: string) => number | null;
}

/** 一张趋势图定义 */
export interface ChartSpec {
  key: string;
  title: string;
  unit: string;
  yName: string;
  series: SeriesSpec[];
  /** 覆盖默认 y 轴（量程 / HH:mm 轴） */
  yAxis?: Record<string, unknown>;
  /** 覆盖 tooltip 值格式化（入睡/起床显示 HH:mm） */
  tooltipFmt?: (v: number) => string;
}

/** HH:mm → 当日分钟偏移 */
export function toMin(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** 当日分钟偏移 → HH:mm */
export function minToHHmm(m: number): string {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

/* ---- E-1：图定义派生（由追踪项表 + 日记内存态生成） ---- */

/** 自定义项折线配色（沿用既有内置折线已发布的同组色，不引入新色；按序循环） */
const PALETTE = [
  "#4f46e5",
  "#7c3aed",
  "#0ea5e9",
  "#059669",
  "#db2777",
  "#dc2626",
  "#2563eb",
  "#f59e0b",
];

/** 内置单线图展示顺序（与原版一致：睡眠 → 时钟 → 体重 → 支出 → 心情 → 质量 → 专注 → 步数） */
const BUILTIN_ORDER = [
  "sleep_hours",
  "sleep_quality",
  "weight_kg",
  "spend_total",
  "mood",
  "focus_minutes",
  "steps",
] as const;

const BUILTIN_META: Record<
  string,
  { title: string; unit: string; yName: string; color: string; field: string; level?: boolean }
> = {
  sleep_hours: { title: "睡眠时长", unit: " 小时", yName: "小时", color: "#4f46e5", field: "sleep_hours" },
  sleep_quality: { title: "睡眠质量", unit: "/5", yName: "质量", color: "#7c3aed", field: "sleep_quality", level: true },
  weight_kg: { title: "体重", unit: " kg", yName: "kg", color: "#0ea5e9", field: "weight_kg" },
  spend_total: { title: "当日支出", unit: " 元", yName: "元", color: "#059669", field: "spend_total" },
  mood: { title: "心情", unit: "/5", yName: "心情", color: "#db2777", field: "mood", level: true },
  focus_minutes: { title: "专注时长", unit: " 分钟", yName: "分钟", color: "#dc2626", field: "focus_minutes" },
  steps: { title: "运动步数", unit: " 步", yName: "步", color: "#2563eb", field: "steps" },
};

const LEVEL_AXIS = { min: 0, max: 5, interval: 1 };
const CLOCK_AXIS = { min: 0, max: 1440, axisLabel: { formatter: (v: number) => minToHHmm(v) } };

/** 自定义项取数：time 型值为 HH:mm 字符串（或分钟数），其余转 number */
function customValue(t: TrackerDef, notes: Record<string, DailyNote>, d: string): number | null {
  const raw = notes[d]?.metricsExtra?.[t.key] ?? null;
  if (raw === null || raw === "") return null;
  if (t.kind === "time") return typeof raw === "string" ? toMin(raw) : Number(raw);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 由追踪项表 + 日记内存态派生全部图定义：
 * 隐藏项不出图；入睡/起床合一（任一未隐藏即出图）；自定义项各出一条折线。
 */
export function buildChartSpecs(
  trackers: TrackerDef[],
  notes: Record<string, DailyNote>,
): ChartSpec[] {
  const visible = trackers.filter((t) => !t.hidden);
  const out: ChartSpec[] = [];
  const since = (k: string) => visible.some((t) => t.key === k);

  const clockSpec = (): ChartSpec => ({
    key: "sleep_clock",
    title: "入睡 / 起床时间",
    unit: "",
    yName: "时刻",
    yAxis: CLOCK_AXIS,
    tooltipFmt: (v) => minToHHmm(v),
    series: [
      { name: "入睡时间", color: "#7c3aed", get: (d) => toMin(notes[d]?.metrics.sleep_bedtime ?? null) },
      { name: "起床时间", color: "#f59e0b", get: (d) => toMin(notes[d]?.metrics.sleep_wake ?? null) },
    ],
  });
  const showClock = since("sleep_bedtime") || since("sleep_wake");

  let clockDone = false;
  for (const key of BUILTIN_ORDER) {
    if (!since(key)) continue;
    if (key === "sleep_quality") {
      out.push({ ...BUILTIN_META[key], key } as unknown as ChartSpec); // 占位，下面重建
      out.pop();
    }
    const meta = BUILTIN_META[key];
    out.push({
      key,
      title: meta.title,
      unit: meta.unit,
      yName: meta.yName,
      yAxis: meta.level ? LEVEL_AXIS : undefined,
      series: [
        {
          name: meta.title,
          color: meta.color,
          get: (d) =>
            (notes[d]?.metrics as unknown as Record<string, number | null>)?.[meta.field] ?? null,
        },
      ],
    });
    // 时钟图插在「睡眠时长」之后，与原顺序一致
    if (key === "sleep_hours" && showClock && !clockDone) {
      clockDone = true;
      out.push(clockSpec());
    }
  }
  if (showClock && !clockDone) out.push(clockSpec());

  let i = 0;
  for (const t of visible.filter((x) => !x.builtin)) {
    const color = PALETTE[i % PALETTE.length];
    i++;
    const isTime = t.kind === "time";
    out.push({
      key: t.key,
      title: t.name,
      unit: t.unit ? ` ${t.unit}` : "",
      yName: t.unit || t.name,
      yAxis: isTime ? CLOCK_AXIS : t.kind === "level" ? { min: 0, max: t.max ?? 5, interval: 1 } : undefined,
      tooltipFmt: isTime ? (v) => minToHHmm(v) : undefined,
      series: [{ name: t.name, color, get: (d) => customValue(t, notes, d) }],
    });
  }
  return out;
}
