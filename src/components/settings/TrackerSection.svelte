<script lang="ts">
  /**
   * E-1：数据追踪设置（设置 → 数据追踪）。
   * - 内置项：可隐藏 / 恢复（隐藏 = 表单与图表收起，日记文件里的数据保留）；
   * - 自定义项：新建 / 改名 / 单位 / 方向 / 隐藏 / 删除（删除不动历史数据）；
   * - 新增一个自定义指标全程零改代码。
   */
  import { app } from "../../stores/app.svelte";
  import TrackerEditorDialog from "../today/TrackerEditorDialog.svelte";
  import type { TrackerDef } from "../../types/schema";

  const builtins = $derived(app.trackers.filter((t) => t.builtin));
  const customs = $derived(app.trackers.filter((t) => !t.builtin));

  /** 新建 / 编辑弹窗：null = 关闭；{ def: null } = 新建 */
  let editing = $state<{ def: TrackerDef | null } | null>(null);
  /** 待确认删除的键 */
  let removing = $state<string | null>(null);
  /** 保存失败的提示（键冲突） */
  let error = $state("");

  const DIR_LABEL: Record<TrackerDef["direction"], string> = { up: "越高越好", down: "越低越好" };
  const KIND_LABEL: Record<TrackerDef["kind"], string> = {
    number: "数值",
    level: "档位",
    bool: "是/否",
    time: "时刻",
  };

  function saveTracker(def: TrackerDef): void {
    if (editing?.def) {
      app.updateTracker(editing.def.key, def);
      error = "";
    } else {
      const err = app.addTracker(def);
      if (err) {
        error = err;
        return;
      }
      error = "";
    }
    editing = null;
  }
</script>

<section class="card block">
  <h2 class="block-title">数据追踪</h2>
  <p class="block-hint">
    内置项与自定义项走同一套机制：这里新建一个指标后，今日表单、仪表盘卡片与趋势曲线会自动出现，无需改任何代码。
    隐藏或删除都不会动日记文件里已记录的数据。
  </p>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="group">
    <h3 class="group-title">内置项</h3>
    {#each builtins as t (t.key)}
      <div class="row">
        <div class="info">
          <span class="name">{t.name}</span>
          <span class="meta">{KIND_LABEL[t.kind]} · {DIR_LABEL[t.direction]} · <code>{t.key}</code></span>
        </div>
        <button class="btn-mini" type="button" onclick={() => app.setTrackerHidden(t.key, !t.hidden)}>
          {t.hidden ? "恢复显示" : "隐藏"}
        </button>
      </div>
    {/each}
  </div>

  <div class="group">
    <div class="group-head">
      <h3 class="group-title">自定义项（{customs.length}）</h3>
      <button class="btn-secondary btn-add" type="button" onclick={() => (editing = { def: null })}>
        + 新建追踪项
      </button>
    </div>
    {#if customs.length === 0}
      <p class="empty">还没有自定义指标。点「+ 新建追踪项」添加（如「睡眠质量2」「每日饮水」）。</p>
    {/if}
    {#each customs as t (t.key)}
      <div class="row">
        <div class="info">
          <span class="name" class:muted={t.hidden}>{t.name}{t.hidden ? "（已隐藏）" : ""}</span>
          <span class="meta">
            {KIND_LABEL[t.kind]}{t.unit ? ` · ${t.unit}` : ""} · {DIR_LABEL[t.direction]} · <code>{t.key}</code>
          </span>
        </div>
        <div class="ops">
          <button class="btn-mini" type="button" onclick={() => (editing = { def: t })}>编辑</button>
          <button class="btn-mini" type="button" onclick={() => app.setTrackerHidden(t.key, !t.hidden)}>
            {t.hidden ? "显示" : "隐藏"}
          </button>
          <button class="btn-mini danger" type="button" onclick={() => (removing = t.key)}>删除</button>
        </div>
      </div>
      {#if removing === t.key}
        <div class="confirm">
          <p class="confirm-text">
            删除「{t.name}」？历史数据仍保留在日记文件中（重新新建同名键即可恢复图表）。
          </p>
          <div class="confirm-actions">
            <button class="btn-danger" type="button" onclick={() => { app.removeTracker(t.key); removing = null; }}>
              确认删除
            </button>
            <button class="btn-mini" type="button" onclick={() => (removing = null)}>取消</button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</section>

{#if editing}
  <TrackerEditorDialog
    def={editing.def}
    takenKeys={app.trackers.map((t) => t.key)}
    onSave={saveTracker}
    onCancel={() => (editing = null)}
  />
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 560px;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
  }

  .error {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-danger);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .group-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-alt);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .name.muted {
    color: var(--color-text-tertiary);
  }

  .meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  code {
    color: var(--color-primary);
  }

  .ops {
    display: flex;
    flex-shrink: 0;
    gap: var(--space-1);
  }

  .btn-mini {
    flex-shrink: 0;
    white-space: nowrap;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .btn-mini:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-mini.danger {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .btn-add {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--font-size-xs);
  }

  .empty {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .confirm {
    padding: var(--space-2);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
  }

  .confirm-text {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .confirm-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .btn-danger {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-danger);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .btn-danger:hover {
    background: var(--color-danger);
    color: var(--color-text-inverse, #fff);
  }
</style>
