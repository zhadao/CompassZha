<script lang="ts">
  // 仪表盘（阶段 2 · 检查点 2.2，v4.1）：当日指标卡 + 趋势曲线 + 板块热力图。
  // v4.15：顶端新增「AI 数据分析」入口——弹层对话窗（DataAiChat），AI 基于 9 项量化指标分析建议。
  // v4.17：自绘 SVG 指标图标替换 emoji。
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import { METRIC_LABELS, METRIC_UNITS } from "../../mock/preview";
  import Icon from "../common/Icon.svelte";
  import TrendCharts from "./TrendCharts.svelte";
  import GoalHeatmaps from "./GoalHeatmaps.svelte";
  import DataAiChat from "./DataAiChat.svelte";

  let aiChatOpen = $state(false);

  // 今天的指标（录入表单与番茄钟写入内存后，这里实时联动）
  const metrics = $derived(app.peekNote(todayKey()).metrics);

  const CARDS: Array<{ key: keyof typeof metrics; icon: string }> = [
    { key: "sleep_hours", icon: "metric-sleep" },
    { key: "sleep_bedtime", icon: "metric-bedtime" },
    { key: "sleep_wake", icon: "metric-wake" },
    { key: "weight_kg", icon: "metric-weight" },
    { key: "spend_total", icon: "metric-expense" },
    { key: "mood", icon: "metric-mood" },
    { key: "focus_minutes", icon: "metric-focus" },
    { key: "steps", icon: "metric-steps" },
  ];

  function fmt(v: string | number | null, key: string): string {
    if (v === null || v === "") return "—";
    if (typeof v === "string") return v;
    return `${v}${METRIC_UNITS[key] ?? ""}`;
  }
</script>

<div class="page">
  <div class="top-bar">
    <button class="btn-secondary ai-btn" onclick={() => (aiChatOpen = true)}>
      <Icon name="ai" size={24} />
      AI 数据分析
    </button>
  </div>

  <section class="card metrics-row">
    {#each CARDS as c (c.key)}
      <div class="metric-card">
        <div class="metric-icon"><Icon name={c.icon} size={39} /></div>
        <div class="metric-value">{fmt(metrics[c.key], c.key)}</div>
        <div class="metric-label">{METRIC_LABELS[c.key]}</div>
      </div>
    {/each}
  </section>

  <TrendCharts />

  <GoalHeatmaps />
</div>

{#if aiChatOpen}
  <DataAiChat onclose={() => (aiChatOpen = false)} />
{/if}

<style>
  .page {
    position: relative;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: var(--space-2);
  }

  .ai-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
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
    line-height: 0;
  }

  .metric-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-title);
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
