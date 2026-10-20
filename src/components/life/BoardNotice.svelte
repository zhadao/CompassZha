<script lang="ts">
  /**
   * 板块操作结果横幅（v4.9 / D-6）：删除、封存、重启后在页面顶部告知数据去向。
   * 文案来自 store.boardNotice；关闭即置 null。
   */
  import { app } from "../../stores/app.svelte";
  import Icon from "../common/Icon.svelte";
</script>

<div class="board-notice">
  <span>{app.boardNotice}</span>
  <button class="notice-x" title="知道了" onclick={() => (app.boardNotice = null)}>
    <Icon name="close" size={20} />
  </button>
</div>

<style>
  .board-notice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .notice-x {
    display: inline-flex;
    margin-left: auto;
    color: var(--color-text-tertiary);
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .notice-x:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }
</style>
