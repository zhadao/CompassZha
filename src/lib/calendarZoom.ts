/**
 * 日历时间轴缩放与刻度（阶段 1 · A-5 / A-6；v4.37 重定义为「像素 / 时间比」缩放）：
 * 缩放量 = 1 小时占多少像素（pxPerHour），像绘图软件缩放视图那样缩放时间轴疏密；
 * 时间格粒度固定 15 分钟（行高 = pxPerHour / 4），表格总高 = 时段时长 × pxPerHour。
 * 事件纵向位置由 FullCalendar 按实测格子坐标算出 → 改完行高强制整视图重渲染即按真实时间比例一起缩放。
 * 除 applyCalendarZoom / attachWheelZoom 外均为纯函数；集中在本模块避免日历组件膨胀（CODE-003）。
 */
import type { Calendar } from "@fullcalendar/core";

/** A-5：缩放档位表 = 1 小时占多少像素（**v1.5 起仅供 Ctrl+滚轮跳档使用**，−/+ 按钮走 5% 连续值）；
    相邻比≈1.7，滚轮一步一大步；
    锚点：默认 175（1 小时 = 175px）、58（3 小时 = 175px）、525（20 分钟 = 175px）；
    下限 17 特意更粗，保证用户在设置里自定的任意时段（乃至 24 小时）都能一屏放完。 */
export const PX_PER_HOUR_LEVELS: readonly number[] = [17, 30, 58, 101, 175, 303, 525];

/** A-5：缺省 1 小时 = 175px */
export const DEFAULT_PX_PER_HOUR = 175;

/** A-5：时间格粒度固定 15 分钟（吸附粒度另由 FullCalendar 的 snapDuration 固定 5 分钟） */
export const SLOT_MINUTES = 15;

/** 一小时切成的格数（15 分钟 → 4） */
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;

/** 「每 N 小时一横线」候选值（0 = 取消该方式） */
export const TICK_HOURS: readonly number[] = [1, 2, 3, 4, 6];

/** 刻度规则（config.calendar.ticks） */
export interface CalendarTicks {
  /** 每 N 小时一条横线；0 = 取消 */
  everyHours: number;
  /** 指定时刻 HH:mm 列表；空数组 = 取消 */
  times: string[];
}

/** 缺省刻度规则：每 1 小时一横线，无指定时刻 */
export const DEFAULT_TICKS: CalendarTicks = { everyHours: 1, times: [] };

/** Ctrl+滚轮累计多少像素算一步（拍平鼠标滚轮/触控板连发，避免跳档） */
const WHEEL_STEP_THRESHOLD = 40;

/** 刻度文字最小行距（px）：小于此值只画线不写时间，避免粗档下文字互相压叠 */
const MIN_LABEL_SPACING = 16;

/** HH:mm → 分钟数（00:00–24:00）；非法返回 -1 */
function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  if (h > 24) return -1;
  const t = h * 60 + Number(m[2]);
  return t <= 1440 ? t : -1;
}

/** 归一化单个时刻："8:00" → "08:00"；非法 / 24:00 返回 null */
function normHHmm(raw: string): string | null {
  const t = toMinutes(raw);
  if (t < 0 || t >= 1440) return null;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** 缩放上下限（取档位表两端；区间本身不变） */
export const PX_PER_HOUR_MIN = PX_PER_HOUR_LEVELS[0];
export const PX_PER_HOUR_MAX = PX_PER_HOUR_LEVELS[PX_PER_HOUR_LEVELS.length - 1];

/** −/+ 按钮的细步进比例（每步约 5%） */
const FINE_STEP_RATIO = 1.05;

/** A-5 v1.5：只做「区间夹取 + 取整」，**不再吸附到档位表** ——
    顶部 −/+ 按钮走 5% 连续值，故允许停在 183 / 197 这类中间值。 */
export function clampPxPerHour(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PX_PER_HOUR;
  return Math.round(Math.min(Math.max(n, PX_PER_HOUR_MIN), PX_PER_HOUR_MAX));
}

/** 距 n 最近的档位表下标（供滚轮跳档定位） */
function nearestLevelIndex(n: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PX_PER_HOUR_LEVELS.length; i += 1) {
    const d = Math.abs(n - PX_PER_HOUR_LEVELS[i]);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** 滚轮跳档：dir=1 放大（更细，1 小时占更多像素）；dir=-1 缩小（更粗）；到端点不动 */
export function stepPxPerHour(cur: number, dir: 1 | -1): number {
  const i = nearestLevelIndex(clampPxPerHour(cur));
  const j = dir === 1 ? i + 1 : i - 1;
  return PX_PER_HOUR_LEVELS[Math.min(Math.max(j, 0), PX_PER_HOUR_LEVELS.length - 1)];
}

/** A-5 v1.5：顶部「时间缩放 −/+」按钮的**细步进** = 每步约 5%（夹在区间内）。
    端点处返回原值 → 供组件用「再走一步是否越界」判定置灰。 */
export function stepPxPerHourFine(cur: number, dir: 1 | -1): number {
  const base = clampPxPerHour(cur);
  return clampPxPerHour(dir === 1 ? base * FINE_STEP_RATIO : base / FINE_STEP_RATIO);
}

/** A-5：1 小时占 pxPerHour 像素 → 一格（15 分钟）的 CSS 行高（px） */
export function slotHeightPx(pxPerHour: number): number {
  return clampPxPerHour(pxPerHour) / SLOTS_PER_HOUR;
}

/** 分钟数 → FullCalendar duration 串：20 → "00:20:00" */
export function toFcDuration(minutes: number): string {
  const n = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}:00`;
}

/** 解析刻度时刻文本（逗号 / 空格 / 顿号 / 分号分隔）→ 去重升序的 HH:mm 列表 */
export function parseTickTimes(text: string): string[] {
  const set = new Set<string>();
  for (const raw of text.split(/[\s,，、;；]+/)) {
    const t = normHHmm(raw);
    if (t) set.add(t);
  }
  return [...set].sort();
}

/** 找出「时间格承载不了」的指定时刻（非阻断，仅设置页提示）。
    时间格粒度固定 15 分钟，故 T 必须与常用时段起同余（即落在 :00 / :15 / :30 / :45）且在时段内。 */
export function unrepresentableTimes(slotMin: string, times: string[]): string[] {
  const base = toMinutes(slotMin);
  const from = base < 0 ? 0 : base;
  return times.filter((t) => {
    const m = toMinutes(t);
    return m < 0 || m < from || (m - from) % SLOT_MINUTES !== 0;
  });
}

/** 该分钟是否为「指定具体时刻」刻度 */
function isSpecifiedTick(minutesOfDay: number, ticks: CalendarTicks): boolean {
  for (const t of ticks.times) {
    if (toMinutes(t) === minutesOfDay) return true;
  }
  return false;
}

/** 该分钟是否为「每 N 小时一横线」刻度 */
function isEveryTick(minutesOfDay: number, ticks: CalendarTicks): boolean {
  return ticks.everyHours > 0 && minutesOfDay % (ticks.everyHours * 60) === 0;
}

/** 刻度行判定：是否应画横线（两种规则任一命中即可） */
export function isTickRow(minutesOfDay: number, ticks: CalendarTicks): boolean {
  return isSpecifiedTick(minutesOfDay, ticks) || isEveryTick(minutesOfDay, ticks);
}

/** 刻度文字判定：指定时刻始终写文字；「每 N 小时」在行距不足时只画线不写字（防粗档压叠） */
export function isTickLabelRow(
  minutesOfDay: number,
  ticks: CalendarTicks,
  pxPerHour: number,
): boolean {
  if (isSpecifiedTick(minutesOfDay, ticks)) return true;
  return isEveryTick(minutesOfDay, ticks) && ticks.everyHours * pxPerHour >= MIN_LABEL_SPACING;
}

/** applyCalendarZoom 入参 */
export interface ZoomOptions {
  /** A-5：1 小时占多少像素 */
  pxPerHour: number;
  /** A-4：常用时段起点（HH:mm） */
  slotMin: string;
  /** A-6：刻度规则 */
  ticks: CalendarTicks;
}

/**
 * 把缩放档位与刻度规则应用到 FullCalendar 实例。
 * ① 写 CSS 变量 `--cal-slot-h`（行高 = pxPerHour / 4）→ 表格总高随缩放变化；
 * ② 每次调用都新建函数引用传给 slotLabelContent / slotLaneClassNames —— FC 按引用比较，
 *    新引用必然触发「整视图重渲染」，从而让事件按新的格子坐标重新贴合时间轴
 *    （`updateSize()` 只发 _resize、FC 不会重测格子；传相同值给 setOption 会被判为无变化）。
 */
export function applyCalendarZoom(cal: Calendar, cardEl: HTMLElement, opts: ZoomOptions): void {
  const px = clampPxPerHour(opts.pxPerHour);
  const ticks = opts.ticks;
  const base = Math.max(0, toMinutes(opts.slotMin));
  void base;
  cardEl.style.setProperty("--cal-slot-h", `${px / SLOTS_PER_HOUR}px`);
  const at = (d: Date | null | undefined): number =>
    d ? d.getHours() * 60 + d.getMinutes() : -1;

  // 每行都是「标签候选行」（行高已由 CSS 变量控制，标签不参与行高）
  cal.setOption("slotLabelInterval", toFcDuration(SLOT_MINUTES));
  // 刻度文字固定 HH:mm（24 小时制），避免被 FC 按档位自动切成别的格式
  cal.setOption("slotLabelFormat", { hour: "2-digit", minute: "2-digit", hour12: false });
  cal.setOption("slotLabelContent", (arg: { date?: Date; text: string }) =>
    isTickLabelRow(at(arg.date), ticks, px) ? arg.text : "",
  );
  cal.setOption("slotLaneClassNames", (arg: { date?: Date }) =>
    isTickRow(at(arg.date), ticks) ? "cal-tick" : "",
  );
}

/**
 * 在日历容器上挂 Ctrl+滚轮缩放监听（返回解绑函数）。
 * 仅按住 Ctrl 才处理（同时阻止 WebView2 整页缩放）；
 * 向上（deltaY < 0）= 放大 dir=1，向下 = 缩小 dir=-1。
 */
export function attachWheelZoom(el: HTMLElement, onStep: (dir: 1 | -1) => void): () => void {
  let acc = 0;
  const handler = (e: WheelEvent): void => {
    if (!e.ctrlKey) {
      acc = 0;
      return;
    }
    e.preventDefault();
    if (e.deltaY === 0) return;
    acc += Math.abs(e.deltaY);
    if (acc < WHEEL_STEP_THRESHOLD) return;
    acc = 0;
    onStep(e.deltaY < 0 ? 1 : -1);
  };
  el.addEventListener("wheel", handler, { passive: false });
  return () => el.removeEventListener("wheel", handler);
}
