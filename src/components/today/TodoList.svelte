<script lang="ts">
  import { app } from "../../stores/app.svelte";

  // #goal/xxx 文本标签识别（用于板块投入热力图统计）
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
        <li class="task" class:done={t.done}>
          <button class="check" title={t.done ? "标记为未完成" : "完成"} onclick={() => onToggle(t.id)}>
            {t.done ? "✓" : ""}
          </button>
          <div class="task-body">
            {#each parseSegments(t.text) as seg, i (i)}
              {#if seg.type === "goal"}
                <span class="goal-tag">{seg.value}</span>
              {:else}
                <span>{seg.value}</span>
              {/if}
            {/each}
            {#if t.deferredFrom}
              <span class="deferred-note">（自 {t.deferredFrom} 顺延）</span>
            {/if}
          </div>
          <div class="task-actions">
            <button class="act" title="排上日历" onclick={() => onSchedule(t.id)}>📆</button>
            <button class="act" title="顺延到明天" onclick={() => onDefer(t.id)}>⏭</button>
            <button class="act danger" title="删除" onclick={() => onRemove(t.id)}>✕</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="tip">提示：勾选会立即生效；「⏭ 顺延」把任务移到明天清单（原型期数据重启还原）。</p>
</section>

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

  .check {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border: 1.5px solid var(--color-border-strong);
    border-radius: 50%;
    color: var(--color-surface);
    background-color: var(--color-surface);
    font-size: var(--font-size-xs);
    line-height: 1;
    transition: all var(--transition-fast);
  }

  .task.done .check {
    background-color: var(--color-success);
    border-color: var(--color-success);
  }

  .task-body {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-md);
    word-break: break-word;
  }

  .goal-tag {
    display: inline-block;
    font-size: var(--font-size-xs);
    color: var(--color-primary);
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
    font-size: var(--font-size-sm);
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
