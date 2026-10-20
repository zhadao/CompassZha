<script lang="ts">
  /**
   * 日历分区（布局外壳）：左列 = 当日日程栏（A-7 / R-2b，可收起）+ 右列 = 视图本体。
   * 视图本体按 D-4b 的「时间轴 / 待办」模式二选一渲染：
   * - 时间轴 → CalendarTimeline（FullCalendar 宿主）
   * - 待办   → CalendarTodoView（按日翻页的任务清单卡片）
   */
  import { app } from "../../stores/app.svelte";
  import EventEditor from "./EventEditor.svelte";
  import CalendarDayAgenda from "./CalendarDayAgenda.svelte";
  import CalendarZoomBar from "./CalendarZoomBar.svelte";
  import CalendarTimeline from "./CalendarTimeline.svelte";
  import CalendarTodoView from "./CalendarTodoView.svelte";

  // 右栏不可见（800–1280 档自动收起 / 手动收起）时，编辑器内联显示在日历页上方，
  // 避免点击空白/事件后表单不可见导致「无响应」。
  const inlineEditor = $derived(!!app.calendarDraft && !app.detailVisible);
</script>

<div class="page">
  <!-- A-8：日程列常驻（不写 {#if}，否则宽度无法过渡）；收起时宽度 195→0 向左滑出，
       「«」按钮在列头，工具条「日程」按钮保留作展开入口。 -->
  <aside class="side" class:collapsed={!app.calendarDailyVisible}>
    <div class="side-inner">
      <div class="side-head">
        <button
          class="side-collapse"
          title="收起日程栏"
          aria-label="收起日程栏"
          onclick={() => app.toggleCalendarDaily()}>«</button
        >
      </div>
      <CalendarDayAgenda />
    </div>
  </aside>
  <div class="main">
    {#if inlineEditor}
      <div class="card inline-editor">
        <EventEditor />
      </div>
    {/if}
    <CalendarZoomBar />
    {#if app.calendarViewMode === "timeline"}
      <CalendarTimeline />
    {:else}
      <div class="todo-wrap">
        <CalendarTodoView />
      </div>
    {/if}
  </div>
</div>

<style>
  /* A-7：左列（当日日程预览，收起时向左收） + 右列（视图本体）+ 已有详情栏（由 App 布局提供） */
  .page {
    position: relative;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: row;
  }

  .main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* A-8：日程列常驻 + 宽度过渡；收起 = 宽度 195→0 向左滑出（内容用定宽内层包裹，不重排、不挤压文字）。 */
  .side {
    flex-shrink: 0;
    width: var(--calendar-side-width);
    overflow: hidden;
    border-right: 1px solid var(--color-border);
    transition: width var(--transition-slow);
  }

  .side.collapsed {
    width: 0;
    border-right-width: 0;
  }

  .side-inner {
    box-sizing: border-box;
    width: var(--calendar-side-width);
    height: 100%;
    overflow: hidden auto;
    padding: var(--space-2);
  }

  .side-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: var(--space-1);
  }

  .side-collapse {
    padding: 0 var(--space-2);
    font-size: var(--font-size-md);
    line-height: 1;
    color: var(--color-text-tertiary);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .side-collapse:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-alt);
  }

  /* D-4b：待办视图占满剩余高度，内部滚动（任务多时不撑破页面） */
  .todo-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .inline-editor {
    max-width: 420px;
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
  }
</style>
