/**
 * 日期工具：原生 Date + Intl，不引第三方日期库（依赖最小化原则）。
 * 全项目统一 yyyy-mm-dd 字符串作为日期主键。
 */

/** Date → yyyy-mm-dd（本地时区） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-dd → Date（本地时区零点） */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 今天的日期键 */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** 偏移 n 天的日期键 */
export function offsetDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** 中文长日期，例：2026年10月15日 · 星期四 */
export function formatDateCN(key: string): string {
  const d = fromDateKey(key);
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return date.format(d);
}

/** 短日期，例：10月15日（周X） */
export function formatDateShort(key: string): string {
  const d = fromDateKey(key);
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return date.format(d);
}

/** HH:mm 加 n 小时（原型期不跨天） */
export function addHours(hhmm: string, n: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h + n).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}
