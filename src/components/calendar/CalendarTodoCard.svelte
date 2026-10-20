<script lang="ts">
  /**
   * D-4b：日历「待办」视图的任务卡片（勾选 / 专注 / 删除）。
   * 拖拽由外层日列（CalendarTodoView）负责，本组件只渲染内容与行内操作。
   */
  import { app } from "../../stores/app.svelte";
  import { parseTaskSegments, stripAllGoalTags } from "../../lib/markdown";
  import Icon from "../common/Icon.svelte";
  import type { TaskItem } from "../../types/schema";

  interface Props {
    date: string;
    task: TaskItem;
  }

  let { date, task }: Props = $props();

  /** 以该任务为标题直接开正计时专注；已有计时在跑时不打断，改为跳到番茄钟查看 */
  function onFocus(): void {
    if (app.timer.phase !== "idle") {
      app.gotoSection("pomodoro");
      return;
    }
    app.startStopwatch(stripAllGoalTags(task.text));
    app.gotoSection("pomodoro");
  }
</script>

<div class="tcard" class:done={task.done} title={task.text}>
  <button
    class="check"
    title={task.done ? "标记为未完成" : "完成"}
    aria-label={task.done ? "标记为未完成" : "完成"}
    aria-pressed={task.done}
    onclick={() => app.toggleTask(date, task.id)}
  ></button>
  <div class="body">
    {#each parseTaskSegments(task.text) as seg, i (i)}
      {#if seg.type === "goal"}
        <span class="goal-tag"><Icon name="tag" size={15} />{seg.value}</span>
      {:else}
        <span>{seg.value}</span>
      {/if}
    {/each}
    {#if task.deferredFrom}
      <span class="deferred-note">（自 {task.deferredFrom} 顺延）</span>
    {/if}
  </div>
  <div class="acts">
    <button class="act" title="开始专注（正计时）" aria-label="开始专注" onclick={onFocus}>▶</button>
    <button
      class="act"
      title="删除"
      aria-label="删除"
      onclick={() => app.removeTask(date, task.id)}><Icon name="close" size={19} /></button
    >
  </div>
</div>

<style>
  /* R-1a：紧凑小方块卡片——正文最多两行截断，行内操作改悬停浮层不占宽度 */
  .tcard {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    min-height: 24px;
    padding: var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    cursor: grab;
    transition: border-color var(--transition-fast);
  }

  .tcard:hover {
    border-color: var(--color-border-strong);
  }

  .tcard.done .body {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }

  .check {
    position: relative;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    border: 2px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    transition: all var(--transition-fast);
  }

  .check::after {
    content: "";
    position: absolute;
    top: 25%;
    left: 25%;
    width: 50%;
    height: 50%;
    background-color: var(--color-primary-contrast);
    border-radius: 1px;
    transform: scale(0);
    transition: transform 100ms ease;
  }

  .tcard.done .check {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .tcard.done .check::after {
    transform: scale(1);
  }

  .body {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    overflow-wrap: anywhere;
    /* 最多两行，超出省略号 */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .goal-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: var(--font-size-xs);
    color: var(--color-title);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-sm);
    padding: 0 2px;
    margin-right: 2px;
  }

  .deferred-note {
    font-size: var(--font-size-xs);
    color: var(--color-warning);
  }

  /* 悬停浮层：不再占据流内宽度（此前正是它把任务文字挤到只剩 1 个汉字宽） */
  .acts {
    position: absolute;
    top: 1px;
    right: 1px;
    display: flex;
    gap: 2px;
    padding: 1px;
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    box-shadow: 0 0 6px 4px var(--color-surface);
    opacity: 0;
    /* R-2a′：opacity:0 仍会截获指针（挡住右上角起拖、并让隐形按钮可点）→ 基础态屏蔽 */
    pointer-events: none;
    transition: opacity var(--transition-fast);
  }

  .tcard:hover .acts {
    opacity: 1;
    pointer-events: auto;
  }

  .act {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 19px;
    height: 19px;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
    line-height: 1;
  }

  .act:hover {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }
</style>
