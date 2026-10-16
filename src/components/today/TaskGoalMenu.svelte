<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import { hasGoalTag } from "../../lib/markdown";
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
        <span class="goal-menu-icon">{b.icon}</span>
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
    padding: 4px;
    background: var(--bg-elevated, #fff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  }
  .goal-menu-title {
    padding: 6px 10px 4px;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }
  .goal-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .goal-menu-item:hover {
    background: var(--bg-hover, #f3f4f6);
  }
  .goal-menu-item input {
    accent-color: var(--primary, #2563eb);
  }
  .goal-menu-icon {
    font-size: 14px;
  }
  .goal-menu-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .goal-menu-empty {
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary, #6b7280);
    text-align: center;
  }
</style>
