<script lang="ts">
  // 仪表盘（阶段 2 · 检查点 2.2，v4.1）：当日指标卡 + 趋势曲线 + 板块热力图。
  // v4.15：顶端新增「问数据」入口——弹层对话窗（DataAiChat），AI 基于 9 项量化指标分析建议。
  // v4.40：入口文案统一为「问数据」（B-2 停用词清理）。
  // v4.17：自绘 SVG 指标图标替换 emoji。
  // A-3：原详情栏「时间范围 7/30/90」与「指标口径说明」搬进本页顶部工具栏。
  // R-1b / R-1c（v4.42）：改为「数据 / 热力图」分屏——数据屏 = 指标卡 + 趋势曲线，
  // 热力图屏 = 板块投入热力图；详情栏在本页退场（见 store 的 DETAIL_SECTIONS）。
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import { fmtTrackerValue } from "../../lib/trackers";
  import Icon from "../common/Icon.svelte";
  import Segmented from "../common/Segmented.svelte";
  import TrendCharts from "./TrendCharts.svelte";
  import GoalHeatmaps from "./GoalHeatmaps.svelte";
  import DataAiChat from "./DataAiChat.svelte";
  import MetricCaliberDialog from "./MetricCaliberDialog.svelte";
  import DashboardLayoutDialog from "./DashboardLayoutDialog.svelte";

  let aiChatOpen = $state(false);
  let caliberOpen = $state(false);
  let layoutOpen = $state(false);

  const TREND_OPTIONS = [
    { value: "7", label: "近 7 天" },
    { value: "30", label: "近 30 天" },
    { value: "90", label: "近 90 天" },
  ];

  /** R-1b：分屏切换——左「数据」（指标卡 + 趋势曲线）／右「热力图」（板块投入热力图） */
  const VIEW_OPTIONS = [
    { value: "data", label: "数据" },
    { value: "heatmap", label: "热力图" },
  ];

  // E-1：卡片由 app.trackers 派生——新增自定义指标自动出现（顺序 / 显隐编排见 D-5）
  const note = $derived(app.peekNote(todayKey()));

  /** 内置项 → 自绘指标图标；自定义项回落到通用图标 */
  const ICON_BY_KEY: Record<string, string> = {
    sleep_hours: "metric-sleep",
    sleep_quality: "metric-mood",
    sleep_bedtime: "metric-bedtime",
    sleep_wake: "metric-wake",
    weight_kg: "metric-weight",
    spend_total: "metric-expense",
    mood: "metric-mood",
    focus_minutes: "metric-focus",
    steps: "metric-steps",
  };

  /** 单张指标卡 */
  interface MetricCard {
    key: string;
    icon: string;
    label: string;
    value: string;
  }

  /** 指标卡按 key 建表（仅未隐藏的追踪项；D-5 的 dashboardHidden 在分块时再过滤） */
  const cardByKey = $derived.by(() => {
    const m: Record<string, MetricCard> = {};
    for (const t of app.trackers) {
      if (t.hidden) continue;
      const raw = t.builtin
        ? (note.metrics as unknown as Record<string, number | string | null>)[t.key]
        : note.metricsExtra[t.key];
      m[t.key] = {
        key: t.key,
        icon: ICON_BY_KEY[t.key] ?? "index-card",
        label: t.name,
        value: fmtTrackerValue(t, raw),
      };
    }
    return m;
  });

  /**
   * D-5：数据屏的当日指标卡——按 effDashboardOrder 排列，隐藏项不呈现。
   * R-1b：热力图已独立成屏，这里只剩指标卡（伪键 `heatmaps` 已退场）。
   */
  const cards = $derived.by(() => {
    const hidden = new Set(app.dashboardHidden);
    return app.effDashboardOrder
      .filter((k) => !hidden.has(k))
      .map((k) => cardByKey[k])
      .filter((c): c is MetricCard => c !== undefined);
  });
</script>

<div class="page">
  <div class="top-bar">
    <div class="view-switch">
      <Segmented
        ariaLabel="仪表盘视图"
        options={VIEW_OPTIONS}
        value={app.dashboardViewMode}
        onchange={(v) => app.setDashboardViewMode(v === "heatmap" ? "heatmap" : "data")}
      />
      {#if app.dashboardViewMode === "data"}
        <Segmented
          ariaLabel="趋势时间范围"
          options={TREND_OPTIONS}
          value={String(app.trendRange)}
          onchange={(v) => (app.trendRange = Number(v) as 7 | 30 | 90)}
        />
      {/if}
    </div>
    <div class="top-actions">
      <button class="btn-secondary" onclick={() => (layoutOpen = true)}>编排</button>
      <button class="btn-secondary" onclick={() => (caliberOpen = true)}>指标口径</button>
      <button class="btn-secondary ai-btn" onclick={() => (aiChatOpen = true)}>
        <Icon name="ai" size={24} />
        问数据
      </button>
    </div>
  </div>

  {#if app.dashboardViewMode === "heatmap"}
    <GoalHeatmaps />
  {:else}
    <section class="card metrics-row">
      {#each cards as c (c.key)}
        <div class="metric-card">
          <div class="metric-icon"><Icon name={c.icon} size={39} /></div>
          <div class="metric-value">{c.value}</div>
          <div class="metric-label">{c.label}</div>
        </div>
      {/each}
    </section>
    <TrendCharts />
  {/if}
</div>

{#if aiChatOpen}
  <DataAiChat onclose={() => (aiChatOpen = false)} />
{/if}

{#if caliberOpen}
  <MetricCaliberDialog onclose={() => (caliberOpen = false)} />
{/if}

{#if layoutOpen}
  <DashboardLayoutDialog onclose={() => (layoutOpen = false)} />
{/if}

<style>
  .page {
    position: relative;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* R-1b：视图切换滑块（数据 / 热力图）+ 数据屏才出现的趋势时间范围 */
  .view-switch {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    min-width: 0;
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
    min-width: 0; /* A-1：允许栅格项收缩，极端窄宽下不溢出产生横向滚动 */
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
