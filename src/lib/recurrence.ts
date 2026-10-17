/**
 * 循环事件规则计算（v4.21 §2.10）。
 * 单一职责：规则 + 区间 → 发生日期列表（纯函数，无 IO、不依赖 store）。
 * 频率语义见 §2.10；月末（31 号 → 短月）与 2/29 遇平年钳制到当月最后一天。
 */

import { fromDateKey, offsetDays } from "./date";
import type { RecurRule } from "../types/schema";

const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"];

const PAD = (n: number): string => String(n).padStart(2, "0");

/** yyyy-mm-dd 加 n 个月（目标月无该日时钳制到月末，如 31 号 → 2 月 28/29） */
export function addMonthsKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12; // 0-11
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${PAD(nm + 1)}-${PAD(Math.min(d, last))}`;
}

/** 该日期所在周的周日（weekdays 0 = 周日） */
function sundayOf(key: string): string {
  return offsetDays(key, -fromDateKey(key).getDay());
}

/** 两个日期键相差的天数（b - a） */
function daysBetween(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86400000);
}

/** 生成 key（yyyy-mm-dd） */
function mk(y: number, m: number, d: number): string {
  return `${y}-${PAD(m)}-${PAD(d)}`;
}

/** 上限保护：任何循环的迭代次数不超过此值，防规则异常导致死循环 */
const MAX_ITER = 5000;

/**
 * 规则在 [from, to] 闭区间内的发生日期（升序，含端点）。
 * 不含 except 过滤（调用方按需过滤）；窗口外日期一律不产生。
 */
export function occurrencesBetween(rule: RecurRule, from: string, to: string): string[] {
  if (!rule.start_date || from > to) return [];
  const start = rule.start_date;
  const end = rule.end_date && rule.end_date < to ? rule.end_date : to;
  const lo = start > from ? start : from;
  if (lo > end) return [];
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const out: string[] = [];
  const push = (k: string): void => {
    if (k >= lo && k <= end) out.push(k);
  };

  if (rule.freq === "daily") {
    let k = start;
    const diff = daysBetween(start, lo);
    if (diff > 0) k = offsetDays(start, Math.ceil(diff / interval) * interval);
    for (let i = 0; i < MAX_ITER && k <= end; i++) {
      push(k);
      k = offsetDays(k, interval);
    }
  } else if (rule.freq === "weekly") {
    const days = [...rule.weekdays].filter((w) => w >= 0 && w <= 6).sort((a, b) => a - b);
    if (days.length === 0) return [];
    let wk = sundayOf(start); // 基准周（start 所在周的周日）
    for (let i = 0; i < MAX_ITER && wk <= end; i++) {
      for (const w of days) push(offsetDays(wk, w));
      wk = offsetDays(wk, interval * 7);
    }
  } else if (rule.freq === "monthly") {
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ly, lm] = lo.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    let idx = sy * 12 + (sm - 1);
    const loIdx = ly * 12 + (lm - 1);
    const endIdx = ey * 12 + (em - 1);
    if (loIdx > idx) idx += Math.ceil((loIdx - idx) / interval) * interval;
    for (let i = 0; i < MAX_ITER && idx <= endIdx; i++) {
      const y = Math.floor(idx / 12);
      const m = idx % 12; // 0-11
      const last = new Date(y, m + 1, 0).getDate();
      push(mk(y, m + 1, Math.min(sd, last)));
      idx += interval;
    }
  } else {
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey] = end.split("-").map(Number);
    let y = sy;
    const loY = Number(lo.slice(0, 4));
    if (loY > y) y += Math.ceil((loY - y) / interval) * interval;
    for (let i = 0; i < MAX_ITER && y <= ey; i++) {
      const last = new Date(y, sm, 0).getDate(); // 该年 sm 月最后一天
      push(mk(y, sm, Math.min(sd, last)));
      y += interval;
    }
  }
  return out;
}

/** 规则的人类可读描述（管理弹窗列表用） */
export function describeRule(rule: RecurRule): string {
  const n = Math.max(1, rule.interval);
  let freq: string;
  if (rule.freq === "daily") {
    freq = n === 1 ? "每天" : `每 ${n} 天`;
  } else if (rule.freq === "weekly") {
    const wd = [...rule.weekdays].sort((a, b) => a - b).map((w) => `周${WEEKDAY_CN[w] ?? ""}`).join(" ");
    freq = `${n === 1 ? "每周" : `每 ${n} 周`}${wd ? " " + wd : ""}`;
  } else if (rule.freq === "monthly") {
    freq = `${n === 1 ? "每月" : `每 ${n} 个月`} ${Number(rule.start_date.slice(8, 10))} 号`;
  } else {
    const m = Number(rule.start_date.slice(5, 7));
    const d = Number(rule.start_date.slice(8, 10));
    freq = `${n === 1 ? "每年" : `每 ${n} 年`} ${m} 月 ${d} 日`;
  }
  const time = rule.start === null ? "全天" : `${rule.start}${rule.end ? `-${rule.end}` : ""}`;
  const end = rule.end_date ? ` · 至 ${rule.end_date}` : " · 永久";
  return `${freq} · ${time}${end}`;
}
