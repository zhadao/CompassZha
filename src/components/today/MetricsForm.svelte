<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import { METRIC_LABELS } from "../../mock/preview";
  import type { DailyMetrics } from "../../types/schema";
  import Icon from "../common/Icon.svelte";

  /** 心情档位 1-5（v4.31：以自绘 SVG 图标替换原 emoji 下拉） */
  const MOODS = [1, 2, 3, 4, 5];

  // 录入表单：字段与 frontmatter 一一对应（UI-004：命名一致）
  let sleepHours = $state(toStr(app.note.metrics.sleep_hours));
  let sleepBedtime = $state(app.note.metrics.sleep_bedtime ?? "");
  let sleepWake = $state(app.note.metrics.sleep_wake ?? "");
  let weightKg = $state(toStr(app.note.metrics.weight_kg));
  let spendTotal = $state(toStr(app.note.metrics.spend_total));
  let mood = $state(toStr(app.note.metrics.mood));
  let steps = $state(toStr(app.note.metrics.steps));
  let saved = $state(false);

  // 切换日期同步表单
  $effect(() => {
    const m = app.note.metrics;
    sleepHours = toStr(m.sleep_hours);
    sleepBedtime = m.sleep_bedtime ?? "";
    sleepWake = m.sleep_wake ?? "";
    weightKg = toStr(m.weight_kg);
    spendTotal = toStr(m.spend_total);
    mood = toStr(m.mood);
    steps = toStr(m.steps);
  });

  function toStr(v: number | null): string {
    return v === null ? "" : String(v);
  }

  function toNum(v: string): number | null {
    const n = Number(v);
    return v === "" || Number.isNaN(n) ? null : n;
  }

  function toTime(v: string): string | null {
    return v === "" ? null : v;
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    app.setMetrics(app.selectedDate, {
      sleep_hours: toNum(sleepHours),
      sleep_bedtime: toTime(sleepBedtime),
      sleep_wake: toTime(sleepWake),
      weight_kg: toNum(weightKg),
      spend_total: toNum(spendTotal),
      mood: toNum(mood),
      steps: toNum(steps),
    });
    saved = true; // UI-003：可见反馈
    setTimeout(() => (saved = false), 1500);
  }

  // frontmatter 摘要（实时，8 项核心指标）
  const metrics = $derived(app.note.metrics);
  const summary: Array<[keyof DailyMetrics, string | number | null]> = $derived([
    ["sleep_hours", metrics.sleep_hours],
    ["sleep_bedtime", metrics.sleep_bedtime],
    ["sleep_wake", metrics.sleep_wake],
    ["weight_kg", metrics.weight_kg],
    ["spend_total", metrics.spend_total],
    ["mood", metrics.mood],
    ["focus_minutes", metrics.focus_minutes],
    ["steps", metrics.steps],
  ]);
</script>

<section class="panel-block">
  <h3 class="panel-title">快速录入</h3>
  <form class="form" onsubmit={submit}>
    <label class="field">
      <span class="label">睡眠时长（小时）</span>
      <input type="number" step="0.5" min="0" max="24" bind:value={sleepHours} />
    </label>
    <label class="field">
      <span class="label">入睡时间</span>
      <input type="time" bind:value={sleepBedtime} />
    </label>
    <label class="field">
      <span class="label">起床时间</span>
      <input type="time" bind:value={sleepWake} />
    </label>
    <label class="field">
      <span class="label">体重（kg）</span>
      <input type="number" step="0.1" min="0" bind:value={weightKg} />
    </label>
    <label class="field">
      <span class="label">今日支出（元）</span>
      <input type="number" step="1" min="0" bind:value={spendTotal} />
    </label>
    <div class="field">
      <span class="label">心情（1-5）</span>
      <div class="mood-row" role="group" aria-label="心情（1-5）">
        {#each MOODS as m (m)}
          <button
            type="button"
            class="mood-btn"
            class:active={mood === String(m)}
            aria-pressed={mood === String(m)}
            aria-label={`心情 ${m}`}
            title={`心情 ${m}（再次点击可清除）`}
            onclick={() => (mood = mood === String(m) ? "" : String(m))}
          >
            <Icon name={`mood-${m}`} size={30} />
          </button>
        {/each}
      </div>
    </div>
    <label class="field">
      <span class="label">运动步数</span>
      <input type="number" step="500" min="0" bind:value={steps} />
    </label>
    <div class="actions">
      <button class="btn-primary" type="submit">写入今日</button>
      {#if saved}
        <span class="saved-tip">已写入今日文件 ✓</span>
      {/if}
    </div>
  </form>
</section>

<section class="panel-block">
  <h3 class="panel-title">frontmatter 摘要</h3>
  <ul class="summary">
    {#each summary as [key, value] (key)}
      <li class:unset={value === null}>
        <span class="s-label">{METRIC_LABELS[key]}</span>
        <span class="s-value">{value === null ? "—" : value}</span>
      </li>
    {/each}
  </ul>
  <p class="tip">录入实时写入当日 Markdown 文件的 frontmatter（500ms 防抖落盘 + 本地 git 提交），仪表盘同步联动。</p>
</section>

<style>
  .panel-block {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: var(--font-size-md);
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

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input {
    width: 100%;
  }

  /* v4.31：心情档位图标选择器（原 emoji 下拉的替代） */
  .mood-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .mood-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    opacity: 0.4;
    cursor: pointer;
    transition:
      opacity var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .mood-btn:hover {
    opacity: 0.8;
    background: var(--color-surface-alt);
  }

  .mood-btn.active {
    opacity: 1;
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .mood-btn:focus-visible {
    outline: 2px solid var(--color-focus-ring, var(--color-primary));
    outline-offset: 2px;
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

  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }

  .summary li {
    display: flex;
    justify-content: space-between;
  }

  .summary li.unset {
    color: var(--color-text-tertiary);
  }

  .s-label {
    color: var(--color-text-secondary);
  }

  .s-value {
    font-variant-numeric: tabular-nums;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
