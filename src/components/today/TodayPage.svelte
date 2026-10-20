<script lang="ts">
  /**
   * 今日页（E-3 入口）：日期行 + 「此刻最该动的一件事」按钮 + 清单 + 快速记录。
   * 按钮一次点击即由 store 挑一条并直接开正计时；无候选时只显示结束语（不跳转、不报错）。
   */
  import { app } from "../../stores/app.svelte";
  import TodoList from "./TodoList.svelte";
  import QuickCapture from "./QuickCapture.svelte";
  import { formatDateCN } from "../../lib/date";
</script>

<div class="page">
  <div class="top">
    <p class="date-line">{formatDateCN(app.selectedDate)}</p>
    <button
      class="pick-focus"
      title="自动挑出此刻最该动的一件事，并直接开始正计时"
      onclick={() => app.pickAndStartFocus()}
    >
      此刻最该动的一件事
    </button>
  </div>

  {#if app.focusPickNotice}
    <p class="notice" role="status">{app.focusPickNotice}</p>
  {/if}

  <TodoList />
  <QuickCapture />
</div>

<style>
  .page {
    position: relative;
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .date-line {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
  }

  /* E-3：主入口按钮（浅色描边卡片风，不抢清单的视觉权重） */
  .pick-focus {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    color: var(--color-title);
    background-color: var(--color-primary-light);
    border: 1px solid var(--color-primary-light);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .pick-focus:hover {
    border-color: var(--color-primary);
  }

  .notice {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
    background-color: var(--color-surface-alt);
    border-radius: var(--radius-md);
  }
</style>
