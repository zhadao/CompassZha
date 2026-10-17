<script lang="ts">
  /**
   * 日记日历（v4.6，复刻 Zditor 交互）——「每日」分区右栏迷你月历：
   * - 点日期 = 查看/创建对应 daily/yyyy/yyyy-mm-dd.md 并跳转该日编辑（openDaily）；
   * - 右键日期 = 上下文菜单：打开（不存在则创建并打开）/ 收藏切换 / 删除（二次确认）；
   * - 有日记的日期下方圆点；收藏日期 ★ 高亮（文件名 star- 前缀派生）；今天描边、选中填充。
   * Zditor 的「对象」「模板」不引入（需求文档 v4.6 §2.2）。
   */
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";

  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

  /** 月份游标（面板独立翻阅，不绑选中日期） */
  const sel = app.selectedDate.split("-").map(Number);
  let cursor = $state({ y: sel[0], m: sel[1] });

  /** 右键菜单状态（屏幕坐标定位） */
  let menu = $state<{ x: number; y: number; date: string; exists: boolean } | null>(null);
  let confirmDel = $state(false);

  const cells = $derived.by(() => {
    const pad = new Date(cursor.y, cursor.m - 1, 1).getDay();
    const days = new Date(cursor.y, cursor.m, 0).getDate();
    const prev = new Date(cursor.y, cursor.m - 1, 0).getDate();
    const out: { idx: number; date: string | null; label: number }[] = [];
    let idx = 0;
    for (let i = pad - 1; i >= 0; i--) out.push({ idx: idx++, date: null, label: prev - i });
    for (let d = 1; d <= days; d++) {
      out.push({
        idx: idx++,
        date: `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        label: d,
      });
    }
    for (let n = 1; out.length % 7 !== 0; n++) out.push({ idx: idx++, date: null, label: n });
    return out;
  });

  function shiftMonth(delta: number): void {
    const d = new Date(cursor.y, cursor.m - 1 + delta, 1);
    cursor = { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  function goToday(): void {
    const t = todayKey().split("-").map(Number);
    cursor = { y: t[0], m: t[1] };
    closeMenu();
    app.openDaily(todayKey());
  }

  function openDate(date: string): void {
    closeMenu();
    app.openDaily(date);
  }

  function onCellMenu(e: MouseEvent, date: string | null): void {
    if (!date) return;
    e.preventDefault();
    confirmDel = false;
    menu = { x: e.clientX, y: e.clientY, date, exists: app.dailyNotes[date] !== undefined };
  }

  function toggleStar(): void {
    if (menu) app.toggleStarDaily(menu.date);
    closeMenu();
  }

  function del(): void {
    if (!menu) return;
    if (!confirmDel) {
      confirmDel = true; // 两次点击确认
      return;
    }
    const d = menu.date;
    closeMenu();
    app.deleteDaily(d);
  }

  function closeMenu(): void {
    menu = null;
    confirmDel = false;
  }

  const monthTitle = $derived(`${cursor.y}年 ${cursor.m}月`);
</script>

<section class="panel-block">
  <h3 class="panel-title">日记日历</h3>
  <div class="cal">
    <div class="cal-head">
      <button class="nav-btn" onclick={() => shiftMonth(-1)} title="上月">‹</button>
      <button class="today-btn" onclick={goToday}>今日</button>
      <button class="nav-btn" onclick={() => shiftMonth(1)} title="下月">›</button>
    </div>
    <div class="cal-title">{monthTitle}</div>
    <div class="cal-grid">
      {#each WEEK as w (w)}
        <div class="cal-wd">{w}</div>
      {/each}
      {#each cells as cell (cell.idx)}
        {@const has = cell.date !== null && app.dailyNotes[cell.date] !== undefined}
        {@const starred = cell.date !== null && app.starredDates.has(cell.date)}
        <button
          class="cal-day"
          class:other={cell.date === null}
          class:today={cell.date === todayKey()}
          class:selected={cell.date !== null && cell.date === app.selectedDate}
          class:has
          disabled={cell.date === null}
          onclick={() => cell.date && openDate(cell.date)}
          oncontextmenu={(e) => onCellMenu(e, cell.date)}
        >
          <span class="day-num">{cell.label}</span>
          {#if starred}
            <span class="marker star">★</span>
          {:else if has}
            <span class="marker dot"></span>
          {:else}
            <span class="marker"></span>
          {/if}
        </button>
      {/each}
    </div>
    <p class="tip">点日期查看/创建；右键收藏或删除。★ = 已收藏（star- 前缀）</p>
  </div>
</section>

{#if menu}
  <div
    class="menu-veil"
    role="presentation"
    onclick={closeMenu}
    oncontextmenu={(e) => {
      e.preventDefault();
      closeMenu();
    }}
  >
    <div
      class="ctx-menu"
      style:left="{Math.min(menu.x, window.innerWidth - 180)}px"
      style:top="{Math.min(menu.y, window.innerHeight - 160)}px"
      role="menu"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      oncontextmenu={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === "Escape") closeMenu();
      }}
    >
      <div class="ctx-date">{menu.date}</div>
      <button
        role="menuitem"
        onclick={() => {
          const d = menu!.date;
          closeMenu();
          app.openDaily(d);
        }}
      >
        {menu.exists ? "打开日记" : "创建并打开"}
      </button>
      {#if menu.exists}
        <button role="menuitem" onclick={toggleStar}>
          {app.starredDates.has(menu.date) ? "★ 取消收藏" : "☆ 收藏日记"}
        </button>
        <button role="menuitem" class="danger" class:armed={confirmDel} onclick={del}>
          {confirmDel ? "确认删除该日记？" : "删除日记"}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .cal {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
    font-size: var(--font-size-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
  }

  .nav-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .today-btn {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-primary);
  }

  .today-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .cal-title {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .cal-wd {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-align: center;
    padding: var(--space-1) 0;
  }

  .cal-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 3px 0 2px;
    font-size: var(--font-size-xs);
    color: var(--color-text-primary);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .cal-day:hover {
    background-color: var(--color-surface-alt);
  }

  .cal-day.other {
    color: var(--color-text-tertiary);
    opacity: 0.45;
    cursor: default;
  }

  .cal-day.other:hover {
    background: transparent;
  }

  .cal-day.today {
    border-color: var(--color-primary);
  }

  .cal-day.selected {
    background-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .cal-day.selected .marker.star {
    color: var(--color-primary-contrast);
  }

  .day-num {
    line-height: 1.2;
  }

  .marker {
    height: 12px;
    display: flex;
    align-items: center;
  }

  .marker.dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-primary);
  }

  .cal-day.selected .marker.dot {
    background-color: var(--color-primary-contrast);
  }

  .marker.star {
    font-size: 10px;
    color: var(--color-primary);
    line-height: 1;
  }

  .tip {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }

  .menu-veil {
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .ctx-menu {
    position: fixed;
    min-width: 160px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
    padding: var(--space-1);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ctx-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: var(--space-1) var(--space-2);
  }

  .ctx-menu button {
    position: relative;
    text-align: left;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-1) calc(var(--space-2) + 3px);
    cursor: pointer;
  }

  /* GitHub 式悬停：左侧 3px 主题色竖条 + 底色微变 */
  .ctx-menu button::before {
    content: "";
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 3px;
    border-radius: 3px;
    background: var(--color-primary);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .ctx-menu button:hover {
    background-color: var(--color-primary-light);
  }

  .ctx-menu button:hover::before {
    opacity: 1;
  }

  .ctx-menu button.danger {
    color: var(--color-danger);
  }

  .ctx-menu button.danger::before {
    background: var(--color-danger);
  }

  .ctx-menu button.danger.armed {
    background-color: var(--color-danger);
    color: #ffffff;
  }
</style>
