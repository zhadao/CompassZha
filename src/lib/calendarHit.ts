/**
 * 日历右键命中反查（v4.21）：
 * 1) .fc-event（dataset.eventId）→ 事件菜单；
 * 2) [data-date] 格子（日期列头 / dayGrid td / timeGrid 背景列）→ 日期菜单；
 * 3) 兜底：timeGrid 时间槽行（.fc-timegrid-slot-lane）没有 data-date 祖先，
 *    在日历网格内时按 X 坐标反查最近日列——保证「日历视图任何地方右键都有菜单」
 *    （周/日视图日期只由 X 决定；月视图 td 直接命中，不走兜底）。
 * 工具栏与日历网格外不弹菜单。
 */
export type CalendarHit =
  | { kind: "event"; eventId: string }
  | { kind: "day"; date: string };

export function hitCalendar(
  root: HTMLElement,
  target: HTMLElement,
  x: number,
): CalendarHit | null {
  const evEl = target.closest<HTMLElement>(".fc-event");
  if (evEl?.dataset.eventId) return { kind: "event", eventId: evEl.dataset.eventId };

  const cell = target.closest<HTMLElement>("[data-date]");
  if (cell?.dataset.date) return { kind: "day", date: cell.dataset.date.slice(0, 10) };

  if (!target.closest(".fc-scrollgrid") || target.closest(".fc-toolbar")) return null;

  let best: { date: string; dist: number } | null = null;
  for (const c of root.querySelectorAll<HTMLElement>("[data-date]")) {
    const date = c.dataset.date;
    if (!date) continue;
    const r = c.getBoundingClientRect();
    if (r.width <= 0) continue;
    const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (!best || dist < best.dist) best = { date: date.slice(0, 10), dist };
  }
  return best ? { kind: "day", date: best.date } : null;
}
