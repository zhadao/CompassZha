/**
 * 板块投入热力图网格计算（v4.28，需求文档 §2.4）：
 * 把「近 N 天每日提及次数」摊成 GitHub contribution 风格的「周列 × 7 行」网格，
 * 并算出月份标签的起始列与跨列数（对齐 grubersjoe/react-activity-calendar 的排布）。
 * 纯函数、不碰 store：次数由调用方以 countOf(date) 回调注入。
 * 从 GoalHeatmaps.svelte 拆出，遵守组件 ≤300 行（CODE-003）。
 */
import { offsetDays } from "./date";

/** 统计窗口（天）：371 ≈ 53 周，对齐 GitHub 一年视图；要回到近 90 天只需改成 90 */
export const HEAT_RANGE_DAYS = 371;
/** SVG 逻辑单位（viewBox 内）：格子 11、间距 3、左侧星期标签留白 26、顶部月份标签留白 18 */
export const HEAT_CELL = 11;
export const HEAT_GAP = 3;
export const HEAT_LABEL_W = 26;
export const HEAT_LABEL_H = 18;
export const HEAT_RANGE_TEXT = HEAT_RANGE_DAYS >= 365 ? "近一年" : `近 ${HEAT_RANGE_DAYS} 天`;
/** 左侧星期标签：只标 一 / 三 / 五（0 = 周日，与 GitHub 一致） */
export const HEAT_DOW_LABEL: Record<number, string> = { 1: "一", 3: "三", 5: "五" };

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export interface HeatDay {
  date: string;
  count: number;
  /** 0 = 空（白灰）/ 1..3 递增 / 4 = 4 次及以上（最深） */
  level: number;
}

export interface HeatGrid {
  weeks: number;
  width: number;
  height: number;
  /** 行主序：index = 星期（0 = 周日）× weeks + 周序号；首周不足 7 天处为 null */
  cells: Array<HeatDay | null>;
  months: Array<{ label: string; start: number; span: number }>;
}

/** 0 → 4 档：0 空 / 1 / 2 / 3 / 4+ 最深，与 GitHub 五档同构 */
export function heatLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/** YYYY-MM-DD → 星期序号（0 = 周日）；手工解析避免 Date 字符串的时区偏移 */
function dowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function buildHeatGrid(
  today: string,
  countOf: (date: string) => number,
): HeatGrid {
  const from = offsetDays(today, -(HEAT_RANGE_DAYS - 1));
  const pad = dowOf(from); // 首周不足 7 天：列内前面留空
  const weeks = Math.ceil((pad + HEAT_RANGE_DAYS) / 7);
  const cells: Array<HeatDay | null> = new Array<HeatDay | null>(weeks * 7).fill(null);

  for (let i = 0; i < HEAT_RANGE_DAYS; i++) {
    const date = offsetDays(from, i);
    const at = pad + i;
    const count = countOf(date);
    cells[(at % 7) * weeks + Math.floor(at / 7)] = {
      date,
      count,
      level: heatLevel(count),
    };
  }

  // 月份标签：某周首个有效日期换月即开新标签并向后扩跨列；跨列过窄的直接丢弃（避免叠字）
  const months: HeatGrid["months"] = [];
  let prev = -1;
  for (let w = 0; w < weeks; w++) {
    let first: string | null = null;
    for (let dow = 0; dow < 7; dow++) {
      const c = cells[dow * weeks + w];
      if (c) {
        first = c.date;
        break;
      }
    }
    if (!first) continue;
    const mi = Number(first.slice(5, 7)) - 1;
    if (mi !== prev) {
      months.push({ label: MONTHS[mi], start: w + 1, span: 1 });
      prev = mi;
    } else {
      months[months.length - 1].span += 1;
    }
  }

  return {
    weeks,
    width: HEAT_LABEL_W + weeks * (HEAT_CELL + HEAT_GAP) - HEAT_GAP,
    height: HEAT_LABEL_H + 7 * (HEAT_CELL + HEAT_GAP) - HEAT_GAP,
    cells,
    months: months.filter((m) => m.span >= 2),
  };
}
