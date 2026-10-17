<script lang="ts">
  /**
   * 任务右键菜单（v4.9）：GUI 勾选关联/取消关联人生板块，免手写 #tag。
   * v4.17：GitHub 式右键菜单重漆（tokens 化 + 悬停左侧主题色竖条）。
   */
  import { app } from "../../stores/app.svelte";
  import { hasGoalTag } from "../../lib/markdown";
  import BoardIcon from "../common/BoardIcon.svelte";
  import type { TaskItem } from "../../types/schema";

  interface Props {
    task: TaskItem;
    date: string;
    x: number;
    y: number;
    onClose: () => void;
  }
  let { task, date, x, y, onClose }: Props = $props();

  // 视口边缘防溢出（菜单宽约 200px；$derived 跟随 props）
  const left = $derived(Math.min(x, window.innerWidth - 216));
  const top = $derived(Math.min(y, window.innerHeight - 240));
</script>

<svelte:window
  onclick={(e) => {
    // 点击菜单外部关闭；点在菜单内（勾选框/标签）不关闭
    if (!(e.target as HTMLElement).closest(".goal-menu")) onClose();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") onClose();
  }}
/>

{#if app.lifeBoards.length > 0}
  <div class="goal-menu" style:left="{left}px" style:top="{top}px">
    <div class="goal-menu-title">关联人生板块</div>
    {#each app.lifeBoards as b (b.id)}
      <label class="goal-menu-item">
        <input
          type="checkbox"
          checked={hasGoalTag(task.text, b.name)}
          onchange={() =>
            app.toggleTaskGoal(date, task.id, b.name, !hasGoalTag(task.text, b.name))}
        />
        <span class="goal-menu-icon"><BoardIcon icon={b.icon} size={24} /></span>
        <span class="goal-menu-name">{b.name}</span>
      </label>
    {/each}
  </div>
{:else}
  <div class="goal-menu" style:left="{left}px" style:top="{top}px">
    <div class="goal-menu-empty">还没有人生板块<br />先到「人生板块」新建后再关联</div>
  </div>
{/if}

<style>
  .goal-menu {
    position: fixed;
    z-index: 100;
    min-width: 180px;
    max-width: 240px;
    max-height: 220px;
    overflow-y: auto;
    padding: var(--space-1);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
  }

  .goal-menu-title {
    padding: var(--space-1) calc(var(--space-2) + 3px);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .goal-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    padding-left: calc(var(--space-2) + 3px);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  /* GitHub 式悬停：左侧 3px 主题色竖条 + 底色微变 */
  .goal-menu-item::before {
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

  .goal-menu-item:hover {
    background: var(--color-primary-light);
  }

  .goal-menu-item:hover::before {
    opacity: 1;
  }

  .goal-menu-item input {
    accent-color: var(--color-primary);
  }

  .goal-menu-icon {
    display: inline-flex;
    line-height: 0;
  }

  .goal-menu-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .goal-menu-empty {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-xs);
    line-height: 1.6;
    color: var(--color-text-secondary);
    text-align: center;
  }
</style>
