<script lang="ts">
  // 阶段 1 · A-5 / A-7：日历页顶部控件——
  // 「时间缩放 −/+」（像绘图软件一样缩放视图：改「像素 / 时间比」，不显示数字档位）+ 右侧「日程」开关。
  // v4.39：−/+ 按钮改为**每步约 5% 的连续微调**（细粒度）；Ctrl+滚轮仍走离散档位跳档（粗粒度）。
  // D-4b：新增「时间轴 / 待办」视图切换；待办模式下时间缩放不适用（隐藏 −/+）。
  import { app } from "../../stores/app.svelte";
  import { stepPxPerHourFine } from "../../lib/calendarZoom";

  /** 再走一步是否越界（+ 到上限 / − 到下限）；连续值下不能用「是否等于 17 / 525」判定 */
  const atFinest = $derived(stepPxPerHourFine(app.calendarPxPerHour, 1) === app.calendarPxPerHour);
  const atCoarsest = $derived(
    stepPxPerHourFine(app.calendarPxPerHour, -1) === app.calendarPxPerHour,
  );

  function zoom(dir: 1 | -1): void {
    app.setCalendarPxPerHour(stepPxPerHourFine(app.calendarPxPerHour, dir));
  }
</script>

<div class="zoom-bar">
  <div class="view-toggle" role="tablist" aria-label="日历视图">
    <button
      class="btn-secondary view-btn"
      class:on={app.calendarViewMode === "timeline"}
      aria-pressed={app.calendarViewMode === "timeline"}
      onclick={() => app.setCalendarViewMode("timeline")}>时间轴</button
    >
    <button
      class="btn-secondary view-btn"
      class:on={app.calendarViewMode === "todo"}
      aria-pressed={app.calendarViewMode === "todo"}
      onclick={() => app.setCalendarViewMode("todo")}>待办</button
    >
  </div>
  {#if app.calendarViewMode === "timeline"}
    <span class="zoom-label">时间缩放</span>
    <button
      class="btn-secondary zoom-btn"
      aria-label="缩小视图（一屏能装下更多时间，缩到最粗可一屏看完一整天）"
      disabled={atCoarsest}
      onclick={() => zoom(-1)}>−</button
    >
    <button
      class="btn-secondary zoom-btn"
      aria-label="放大视图（1 小时占更多高度，便于阅读细节）"
      disabled={atFinest}
      onclick={() => zoom(1)}>+</button
    >
  {/if}
  <button
    class="btn-secondary daily-toggle"
    class:on={app.calendarDailyVisible}
    aria-pressed={app.calendarDailyVisible}
    title="显示 / 隐藏日历左侧的当日日程预览列"
    onclick={() => app.toggleCalendarDaily()}>日程</button
  >
</div>

<style>
  .zoom-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .view-toggle {
    display: flex;
    gap: 0;
  }

  .view-btn {
    flex-shrink: 0;
    white-space: nowrap;
    border-radius: 0;
    font-size: var(--font-size-xs);
  }

  .view-toggle .view-btn:first-child {
    border-top-left-radius: var(--radius-sm);
    border-bottom-left-radius: var(--radius-sm);
  }

  .view-toggle .view-btn:last-child {
    border-top-right-radius: var(--radius-sm);
    border-bottom-right-radius: var(--radius-sm);
    border-left-width: 0;
  }

  .view-btn.on {
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);
  }

  .zoom-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .zoom-btn {
    min-width: 32px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-md);
    line-height: 1;
    flex-shrink: 0;
  }

  .daily-toggle {
    margin-left: auto;
    font-size: var(--font-size-xs);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .daily-toggle.on {
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);
  }
</style>
