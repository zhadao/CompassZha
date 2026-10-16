<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import { METRIC_LABELS, METRIC_UNITS } from "../../mock/preview";
  import StaticBadge from "../layout/StaticBadge.svelte";
  import TrendCharts from "./TrendCharts.svelte";
  import GoalHeatmaps from "./GoalHeatmaps.svelte";

  const purpose =
    "干什么：展示当日 8 项关键指标、近 7/30/90 天趋势七折线（统一形式）、各人生板块投入热力图。数据源 = 每日日记 frontmatter 与清单（真实数据，录入即联动）。";

  // 今天的指标（录入表单与番茄钟写入内存后，这里实时联动）
  const metrics = $derived(app.peekNote(todayKey()).metrics);

  const CARDS: Array<{ key: keyof typeof metrics; icon: string }> = [
    { key: "sleep_hours", icon: "😴" },
    { key: "sleep_bedtime", icon: "🌙" },
    { key: "sleep_wake", icon: "☀️" },
    { key: "weight_kg", icon: "⚖️" },
    { key: "spend_total", icon: "💰" },
    { key: "mood", icon: "🙂" },
    { key: "focus_minutes", icon: "🎯" },
    { key: "steps", icon: "👟" },
  ];

  function fmt(v: string | number | null, key: string): string {
    if (v === null || v === "") return "—";
    if (typeof v === "string") return v;
    return `${v}${METRIC_UNITS[key] ?? ""}`;
  }
</script>

<div class="page">
  <StaticBadge />
  <p class="purpose">{purpose}</p>

  <section class="card metrics-row">
    {#each CARDS as c (c.key)}
      <div class="metric-card">
        <div class="metric-icon">{c.icon}</div>
        <div class="metric-value">{fmt(metrics[c.key], c.key)}</div>
        <div class="metric-label">{METRIC_LABELS[c.key]}</div>
      </div>
    {/each}
  </section>

  <TrendCharts />

  <GoalHeatmaps />
</div>

<style>
  .page {
    position: relative;
  }

  .purpose {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .metrics-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .metric-icon {
    font-size: var(--font-size-xl);
  }

  .metric-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  @media (min-width: 1000px) {
    .metrics-row {
      grid-template-columns: repeat(8, 1fr);
    }
  }
</style>
