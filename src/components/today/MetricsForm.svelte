<script lang="ts">
  // 指标快速录入（D-1 v4.40 / E-1 v4.41）：
  // 表单由 app.formTrackers 驱动——内置 8 项按「常显」折叠，自定义项一律列出；
  // 新增一个自定义指标全程零改代码（表单 / 仪表盘 / 趋势图自动出现）。
  // 不填不报错、不标红；「常显」集合持久化到 config.metrics.pinned。
  // 子组件（CODE-003）：TrackerField / MetricPinPanel / MetricsSummary。
  import { app } from "../../stores/app.svelte";
  import MetricsSummary from "./MetricsSummary.svelte";
  import TrackerField from "./TrackerField.svelte";
  import MetricPinPanel from "./MetricPinPanel.svelte";
  import { isCustomKey } from "../../lib/trackers";
  import type { DailyMetrics, TrackerDef } from "../../types/schema";

  const all = $derived(app.formTrackers);
  /** 内置项按「常显」拆分；自定义项不在折叠区 */
  const pinnedFields = $derived(
    all.filter((t) => (t.builtin ? app.metricPinned.includes(t.key) : true)),
  );
  const moreFields = $derived(all.filter((t) => t.builtin && !app.metricPinned.includes(t.key)));

  /**
   * 表单缓冲（字符串态，与追踪项键一一对应；折叠/隐藏项的既有值不在此，也不会被覆盖）。
   * 初值必须**在首次渲染前**就补齐所有键：TrackerField 的 `value` 是带 fallback 的可绑 prop，
   * 传 undefined 会被 Svelte 判为 props_invalid_value 并中断 mount（整窗白屏），故用 seed() 同步初始化。
   */
  let vals = $state<Record<string, string>>(seed());
  let saved = $state(false);
  let moreOpen = $state(false);
  let removing = $state<string | null>(null);

  /** 表单初值：内置项取 note.metrics，自定义项取 note.metricsExtra；缺键一律补 "" */
  function seed(): Record<string, string> {
    const m = app.note.metrics as unknown as Record<string, number | string | null>;
    const ex = app.note.metricsExtra;
    const next: Record<string, string> = {};
    for (const t of app.formTrackers) {
      const raw = t.builtin ? m[t.key] : ex[t.key];
      next[t.key] = raw === null || raw === undefined ? "" : String(raw);
    }
    return next;
  }

  // 切换日期 / 增删追踪项时同步表单。
  // 用 $effect.pre 而非 $effect：前者在 DOM 更新之前运行，可保证「新出现的追踪项字段」
  // 在被创建时 vals 里已有该键（$effect 晚于 DOM 更新，新字段拿到 undefined → 同样白屏）。
  $effect.pre(() => {
    vals = seed();
  });

  function toNum(v: string): number | null {
    const n = Number(v);
    return v === "" || Number.isNaN(n) ? null : n;
  }

  /** 表单字符串 → 落盘值（time 型保留 HH:mm 字符串，其余一律 number） */
  function encode(t: TrackerDef, v: string): number | string | null {
    if (t.kind === "time") return v === "" ? null : v;
    return toNum(v);
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    const patch: Record<string, number | string | null> = {};
    const extra: Record<string, number | string | null> = {};
    for (const t of all) {
      const enc = encode(t, vals[t.key] ?? "");
      if (isCustomKey(t.key)) extra[t.key] = enc;
      else patch[t.key] = enc;
    }
    app.setMetrics(app.selectedDate, patch as Partial<DailyMetrics>, extra);
    saved = true; // UI-003：可见反馈
    setTimeout(() => (saved = false), 1500);
  }
</script>

<section class="panel-block">
  <div class="head-row">
    <h3 class="panel-title">快速录入</h3>
    <MetricPinPanel />
  </div>

  <form class="form" onsubmit={submit}>
    {#each pinnedFields as t (t.key)}
      {#if isCustomKey(t.key)}
        <div class="custom-row">
          <TrackerField tracker={t} bind:value={vals[t.key]} />
          <button
            class="row-menu"
            type="button"
            title="不再追踪"
            aria-label="不再追踪"
            onclick={() => (removing = removing === t.key ? null : t.key)}
          >
            ⋯
          </button>
        </div>
        {#if removing === t.key}
          <div class="confirm">
            <p class="confirm-text">不再追踪「{t.name}」？已记录的历史保留在日记文件中（重新新建同名键即可恢复）。</p>
            <div class="confirm-actions">
              <button class="btn-danger" type="button" onclick={() => { app.removeTracker(t.key); removing = null; }}>
                确认不再追踪
              </button>
              <button class="link-btn" type="button" onclick={() => (removing = null)}>取消</button>
            </div>
          </div>
        {/if}
      {:else}
        <TrackerField tracker={t} bind:value={vals[t.key]} />
      {/if}
    {/each}

    {#if moreFields.length > 0}
      <button class="more-toggle" type="button" aria-expanded={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
        <span class="caret" class:open={moreOpen}>▸</span>
        更多指标（{moreFields.length}）
      </button>
      {#if moreOpen}
        {#each moreFields as t (t.key)}
          <TrackerField tracker={t} bind:value={vals[t.key]} />
        {/each}
      {/if}
    {/if}

    <div class="actions">
      <button class="btn-primary" type="submit">写入今日</button>
      {#if saved}
        <span class="saved-tip">已写入今日文件 ✓</span>
      {/if}
    </div>
  </form>
</section>

<MetricsSummary />

<style>
  .panel-block {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  /* D-1：标题 + 常显设置入口同行（面板展开时换行占满） */
  .head-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .link-btn {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* E-1：自定义项行（字段 + ⋯ 菜单） */
  .custom-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: var(--space-1);
  }

  .row-menu {
    flex-shrink: 0;
    margin-top: 18px;
    padding: 0 var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-alt);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .confirm {
    padding: var(--space-2);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    background: var(--color-surface-alt);
  }

  .confirm-text {
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

  /* D-1：折叠区开关 */
  .more-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) 0;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .caret {
    display: inline-block;
    transition: transform var(--transition-fast);
  }

  .caret.open {
    transform: rotate(90deg);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .saved-tip {
    font-size: var(--font-size-xs);
    color: var(--color-success);
  }
</style>
