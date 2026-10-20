<script lang="ts">
  /**
   * D-4b：日历「待办」卡片模式——以「周」为视图单位、7 个日列长格承载任务卡片。
   * 数据源 = dailyNotes[date].tasks（不读 events）；任务卡片可按日勾选划掉，
   * 也可拖到别的日子（moveTask 原子双写：两侧都写成功才算成功，失败回滚并提示）。
   * 不走 FullCalendar；由 CalendarPage 按 viewMode 条件渲染。
   */
  import { app } from "../../stores/app.svelte";
  import { fromDateKey, offsetDays, todayKey } from "../../lib/date";
  import CalendarTodoCard from "./CalendarTodoCard.svelte";
  import type { TaskItem } from "../../types/schema";

  const WEEK_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  /** 该日期键所在周的周一 */
  function mondayOf(key: string): string {
    const day = fromDateKey(key).getDay();
    return offsetDays(key, -((day + 6) % 7));
  }

  /** 当前周的周一（本地游标，不落盘） */
  let weekStart = $state(mondayOf(todayKey()));
  /** 拖拽中的任务（源日 + 任务），null = 未在拖拽 */
  let drag = $state<{ date: string; task: TaskItem } | null>(null);
  /** 当前落点高亮的日列 */
  let dropDate = $state<string | null>(null);
  /** 改期失败提示（成功即清空） */
  let errMsg = $state("");

  const days = $derived(Array.from({ length: 7 }, (_, i) => offsetDays(weekStart, i)));
  const today = todayKey();

  function shiftWeek(weeks: number): void {
    weekStart = offsetDays(weekStart, weeks * 7);
    errMsg = "";
  }

  function onDragStart(e: DragEvent, date: string, task: TaskItem): void {
    drag = { date, task };
    errMsg = "";
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    }
  }

  function onDragOver(e: DragEvent, date: string): void {
    if (!drag) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dropDate = date;
  }

  function onDragLeave(date: string): void {
    if (dropDate === date) dropDate = null;
  }

  function onDrop(e: DragEvent, date: string): void {
    e.preventDefault();
    const d = drag;
    drag = null;
    dropDate = null;
    if (!d || d.date === date) return;
    void (async () => {
      const msg = await app.moveTask(d.date, d.task.id, date);
      errMsg = msg ?? "";
    })();
  }

  function onDragEnd(): void {
    drag = null;
    dropDate = null;
  }

  /** R-2b：点某天 → 设为日历选中日（左侧「日程」栏联动），并高亮该日列 */
  function selectDay(date: string): void {
    app.selectDay(date);
  }
</script>

<section class="card block">
  <header class="head">
    <div class="nav">
      <button class="btn-secondary nav-btn" title="上一周" onclick={() => shiftWeek(-1)}>‹ 上周</button
      >
      <button class="btn-secondary nav-btn" onclick={() => (weekStart = mondayOf(todayKey()))}>
        本周
      </button>
      <button class="btn-secondary nav-btn" title="下一周" onclick={() => shiftWeek(1)}>下周 ›</button
      >
    </div>
    <span class="range">{days[0]} ~ {days[6]}</span>
  </header>

  {#if errMsg}
    <p class="err-line">{errMsg}</p>
  {/if}

  <div class="grid">
    {#each days as day, i (day)}
      <div
        class="day"
        class:today={day === today}
        class:drop={dropDate === day}
        class:selected={app.selectedDate === day}
        role="group"
        aria-label={`${WEEK_LABELS[i]} ${day} 的任务`}
        ondragover={(e) => onDragOver(e, day)}
        ondragleave={() => onDragLeave(day)}
        ondrop={(e) => onDrop(e, day)}
      >
        <button class="day-head" onclick={() => selectDay(day)}>
          <span class="wd">{WEEK_LABELS[i]}</span>
          <span class="dd">{day.slice(5)}</span>
        </button>
        {#if app.peekNote(day).tasks.length === 0}
          <p class="day-empty">无任务</p>
        {:else}
          <ul class="day-tasks">
            {#each app.peekNote(day).tasks as t (t.id)}
              <li
                class="slot"
                class:dragging={drag?.task.id === t.id}
                draggable="true"
                ondragstart={(e) => onDragStart(e, day, t)}
                ondragend={onDragEnd}
              >
                <CalendarTodoCard date={day} task={t} />
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>

  <p class="tip">
    提示：点日期列标题即把左侧「日程」栏切到那天；勾选卡片即完成（划掉）；<b>把卡片拖到别的日子即可改期</b>（两侧文件同时改写，失败会提示并回滚）；悬停卡片可「▶ 开始专注」或删除。
  </p>
</section>

<style>
  .block {
    padding: var(--space-3) var(--space-4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .nav {
    display: flex;
    gap: var(--space-1);
  }

  .nav-btn {
    font-size: var(--font-size-xs);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .range {
    margin-left: auto;
    flex: 1;
    min-width: 0;
    text-align: right;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .err-line {
    margin-bottom: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-danger);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .day {
    display: flex;
    flex-direction: column;
    min-height: 160px;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition:
      border-color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .day.today {
    border-color: var(--color-primary);
  }

  /* R-2b：当前选中的日列（左侧「日程」栏正显示的那天） */
  .day.selected {
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  /* 拖拽落点高亮 */
  .day.drop {
    border-style: dashed;
    border-color: var(--color-border-strong);
    background-color: var(--color-primary-light);
  }

  .day-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    width: 100%;
    margin-bottom: var(--space-2);
    padding: 0 0 var(--space-1);
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .day-head:hover .wd {
    color: var(--color-primary);
  }

  .wd {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .dd {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .day-empty {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    opacity: 0.6;
  }

  .day-tasks {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .slot {
    list-style: none;
    cursor: grab;
  }

  .slot.dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
