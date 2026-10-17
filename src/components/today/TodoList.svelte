<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import Icon from "../common/Icon.svelte";
  import TaskGoalMenu from "./TaskGoalMenu.svelte";
  import type { TaskItem } from "../../types/schema";

  // #goal/xxx 文本标签识别（总需求 §2.3 任务标签系统，原型期识别展示）
  interface Segment {
    type: "text" | "goal";
    value: string;
  }

  function parseSegments(text: string): Segment[] {
    const parts = text.split(/(#goal\/[\w\u4e00-\u9fa5-]+)/g);
    return parts
      .filter((p) => p !== "")
      .map((p) =>
        p.startsWith("#goal/") ? { type: "goal" as const, value: p } : { type: "text" as const, value: p },
      );
  }

  let newTask = $state("");
  /** 任务右键关联板块菜单（v4.9）：{ task, 坐标 }，null = 关闭 */
  let goalMenu = $state<{ task: TaskItem; x: number; y: number } | null>(null);

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    if (!newTask.trim()) return;
    app.addTask(app.selectedDate, newTask);
    newTask = "";
  }

  function onToggle(id: string): void {
    app.toggleTask(app.selectedDate, id);
  }

  function onRemove(id: string): void {
    app.removeTask(app.selectedDate, id);
  }

  function onDefer(id: string): void {
    app.deferTask(app.selectedDate, id);
  }

  function onSchedule(id: string): void {
    app.scheduleTask(app.selectedDate, id);
    app.gotoSection("calendar");
  }
</script>

<section class="card block">
  <h2 class="block-title">今日清单</h2>

  <form class="add-row" onsubmit={submit}>
    <input
      class="add-input"
      type="text"
      placeholder="添加任务，可用 #goal/xxx 标签关联人生板块…"
      bind:value={newTask}
    />
    <button class="btn-primary" type="submit" disabled={!newTask.trim()}>添加</button>
  </form>

  {#if app.note.tasks.length === 0}
    <div class="empty-state">
      <span>还没有任务</span>
      <span>在上方输入今天要做的第一件事，或从昨天顺延过来</span>
    </div>
  {:else}
    <ul class="task-list">
      {#each app.note.tasks as t (t.id)}
        <li
          class="task"
          class:done={t.done}
          oncontextmenu={(e) => {
            e.preventDefault();
            goalMenu = { task: t, x: e.clientX, y: e.clientY };
          }}
        >
          <button
            class="check"
            title={t.done ? "标记为未完成" : "完成"}
            aria-label={t.done ? "标记为未完成" : "完成"}
            aria-pressed={t.done}
            onclick={() => onToggle(t.id)}
          ></button>
          <div class="task-body">
            {#each parseSegments(t.text) as seg, i (i)}
              {#if seg.type === "goal"}
                <span class="goal-tag"><Icon name="tag" size={17} />{seg.value}</span>
              {:else}
                <span>{seg.value}</span>
              {/if}
            {/each}
            {#if t.deferredFrom}
              <span class="deferred-note">（自 {t.deferredFrom} 顺延）</span>
            {/if}
          </div>
          <div class="task-actions">
            <button class="act" title="排上日历" onclick={() => onSchedule(t.id)}>
              <Icon name="calendar" size={21} />
            </button>
            <button class="act" title="顺延到明天" onclick={() => onDefer(t.id)}>
              <Icon name="clock" size={21} />
            </button>
            <button class="act danger" title="删除" onclick={() => onRemove(t.id)}>
              <Icon name="close" size={21} />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="tip">
    提示：勾选会立即生效；「顺延」把任务移到明天清单；<b>右键任务</b>可关联/取消关联人生板块。
  </p>
</section>

{#if goalMenu}
  <TaskGoalMenu
    task={goalMenu.task}
    date={app.selectedDate}
    x={goalMenu.x}
    y={goalMenu.y}
    onClose={() => (goalMenu = null)}
  />
{/if}

<style>
  .block {
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
    position: relative;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .add-input {
    flex: 1;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .task {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .task:hover {
    border-color: var(--color-border-strong);
  }

  .task.done .task-body {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }

  /* 方块化勾选（v4.17）：交互形态参考 uiverse.io checkpoint，配色全走 tokens */
  .check {
    position: relative;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border: 2px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    transition: all var(--transition-fast);
  }

  .check:hover {
    border-color: var(--color-primary);
  }

  /* 内部方点：scale 动画 */
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

  .task.done .check {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .task.done .check::after {
    transform: scale(1);
  }

  .task-body {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-md);
    word-break: break-word;
  }

  .goal-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: var(--font-size-xs);
    color: var(--color-title);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    margin: 0 var(--space-1);
  }

  .deferred-note {
    font-size: var(--font-size-xs);
    color: var(--color-warning);
  }

  .task-actions {
    display: flex;
    gap: var(--space-1);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .task:hover .task-actions {
    opacity: 1;
  }

  .act {
    display: inline-flex;
    padding: 2px var(--space-1);
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
  }

  .act:hover {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .act.danger:hover {
    color: var(--color-danger);
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
