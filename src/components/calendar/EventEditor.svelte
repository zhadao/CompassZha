<script lang="ts">
  /**
   * 日历事件编辑器（右栏）：新建 / 编辑共用，操作 app.calendarDraft。
   */
  import { app } from "../../stores/app.svelte";

  const draft = $derived(app.calendarDraft);
  const isEdit = $derived(draft?.mode === "edit");

  function setTitle(v: string): void {
    if (draft) draft.title = v;
  }
  function setDate(v: string): void {
    if (draft) draft.date = v;
  }
  function setAllDay(v: boolean): void {
    if (draft) draft.allDay = v;
  }
  function setStart(v: string): void {
    if (draft) draft.start = v;
  }
  function setEnd(v: string): void {
    if (draft) draft.end = v;
  }
</script>

<div class="editor">
  {#if draft}
    <h3 class="editor-title">{isEdit ? "编辑事件" : "新建事件"}</h3>
    <form
      class="form"
      onsubmit={(e) => {
        e.preventDefault();
        app.saveDraft();
      }}
    >
      <label class="field">
        <span class="label">标题</span>
        <input
          type="text"
          placeholder="事件标题…"
          value={draft.title}
          oninput={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <label class="field">
        <span class="label">日期</span>
        <input
          type="date"
          value={draft.date}
          onchange={(e) => setDate(e.currentTarget.value)}
        />
      </label>
      <label class="field checkbox-row">
        <input
          type="checkbox"
          checked={draft.allDay}
          onchange={(e) => setAllDay(e.currentTarget.checked)}
        />
        <span>全天事件</span>
      </label>
      {#if !draft.allDay}
        <div class="time-row">
          <label class="field half">
            <span class="label">开始</span>
            <input
              type="time"
              value={draft.start}
              onchange={(e) => setStart(e.currentTarget.value)}
            />
          </label>
          <label class="field half">
            <span class="label">结束</span>
            <input
              type="time"
              value={draft.end}
              onchange={(e) => setEnd(e.currentTarget.value)}
            />
          </label>
        </div>
      {/if}
      <div class="actions">
        <button class="btn-primary" type="submit" disabled={!draft.title.trim()}>
          保存
        </button>
        <button
          class="btn-secondary"
          type="button"
          onclick={() => app.closeDraft()}
        >
          取消
        </button>
        {#if isEdit}
          <button class="btn-danger" type="button" onclick={() => app.deleteSelected()}>
            删除
          </button>
        {/if}
      </div>
    </form>
  {:else}
    <div class="empty-state">
      <span>未选中事件</span>
      <span>点击日历空白处新建，或点击事件编辑</span>
    </div>
  {/if}
</div>

<style>
  .editor-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field.half {
    flex: 1;
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input[type="text"],
  .field input[type="date"],
  .field input[type="time"] {
    width: 100%;
  }

  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .time-row {
    display: flex;
    gap: var(--space-2);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .btn-danger {
    margin-left: auto;
    color: var(--color-danger);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    transition: all var(--transition-fast);
  }

  .btn-danger:hover {
    border-color: var(--color-danger);
  }
</style>
