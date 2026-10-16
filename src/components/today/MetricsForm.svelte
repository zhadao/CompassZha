<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import { METRIC_LABELS } from "../../mock/preview";
  import type { DailyMetrics } from "../../types/schema";

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
    <label class="field">
      <span class="label">心情（1-5）</span>
      <select bind:value={mood}>
        <option value="">未选择</option>
        <option value="1">1 😞</option>
        <option value="2">2😕</option>
        <option value="3">3 😐</option>
        <option value="4">4 🙂</option>
        <option value="5">5 😄</option>
      </select>
    </label>
    <label class="field">
      <span class="label">运动步数</span>
      <input type="number" step="500" min="0" bind:value={steps} />
    </label>
    <div class="actions">
      <button class="btn-primary" type="submit">写入今日</button>
      {#if saved}
        <span class="saved-tip">已写入 ✓（内存）</span>
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

  .field input,
  .field select {
    width: 100%;
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
