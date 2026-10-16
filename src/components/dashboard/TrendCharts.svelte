<script lang="ts">
  /**
   * 趋势七图（ECharts，总需求 §2.4 v4.1）：
   * 全部统一为折线图形式（平滑曲线，仅系列数不同），覆盖全部可数字化指标：
   * ①睡眠时长 ②入睡/起床时间双折线 ③体重 ④当日支出 ⑤心情 ⑥专注时长 ⑦运动步数。
   * 数据源：每日日记 frontmatter（store 内存态，近 7/30/90 天右栏切换）；
   * 3.4 SQLite 派生索引落地后只改本组件取数，图定义不变。
   */
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { offsetDays, todayKey } from "../../lib/date";
  import * as echarts from "echarts/core";
  import { LineChart } from "echarts/charts";
  import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
  } from "echarts/components";
  import { CanvasRenderer } from "echarts/renderers";

  echarts.use([
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    CanvasRenderer,
  ]);

  type Chart = ReturnType<typeof echarts.init>;

  /** 统一图定义（数据驱动，七张图共用一套渲染逻辑） */
  interface SeriesSpec {
    name: string;
    color: string;
    /** 该系列在 date 当天的值；null = 无记录（断点） */
    get: (date: string) => number | null;
  }
  interface ChartSpec {
    key: string;
    title: string;
    unit: string;
    yName: string;
    series: SeriesSpec[];
    /** 覆盖默认 y 轴（量程 / HH:mm 轴） */
    yAxis?: Record<string, unknown>;
    /** 覆盖 tooltip 值格式化（入睡/起床显示 HH:mm） */
    tooltipFmt?: (v: number) => string;
  }

  /** HH:mm → 当日分钟偏移 */
  function toMin(hhmm: string | null): number | null {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function minToHHmm(m: number): string {
    const x = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  }

  const SPECS: ChartSpec[] = [
    {
      key: "sleep_hours",
      title: "睡眠时长",
      unit: " 小时",
      yName: "小时",
      series: [
        {
          name: "睡眠时长",
          color: "#4f46e5",
          get: (d) => app.dailyNotes[d]?.metrics.sleep_hours ?? null,
        },
      ],
    },
    {
      key: "sleep_clock",
      title: "入睡 / 起床时间",
      unit: "",
      yName: "时刻",
      yAxis: {
        min: 0,
        max: 1440,
        axisLabel: { formatter: (v: number) => minToHHmm(v) },
      },
      tooltipFmt: (v) => minToHHmm(v),
      series: [
        {
          name: "入睡时间",
          color: "#7c3aed",
          get: (d) => toMin(app.dailyNotes[d]?.metrics.sleep_bedtime ?? null),
        },
        {
          name: "起床时间",
          color: "#f59e0b",
          get: (d) => toMin(app.dailyNotes[d]?.metrics.sleep_wake ?? null),
        },
      ],
    },
    {
      key: "weight",
      title: "体重",
      unit: " kg",
      yName: "kg",
      series: [
        {
          name: "体重",
          color: "#0ea5e9",
          get: (d) => app.dailyNotes[d]?.metrics.weight_kg ?? null,
        },
      ],
    },
    {
      key: "spend",
      title: "当日支出",
      unit: " 元",
      yName: "元",
      series: [
        {
          name: "当日支出",
          color: "#059669",
          get: (d) => app.dailyNotes[d]?.metrics.spend_total ?? null,
        },
      ],
    },
    {
      key: "mood",
      title: "心情",
      unit: "/5",
      yName: "心情",
      yAxis: { min: 0, max: 5, interval: 1 },
      series: [
        {
          name: "心情",
          color: "#db2777",
          get: (d) => app.dailyNotes[d]?.metrics.mood ?? null,
        },
      ],
    },
    {
      key: "focus",
      title: "专注时长",
      unit: " 分钟",
      yName: "分钟",
      series: [
        {
          name: "专注时长",
          color: "#dc2626",
          get: (d) => app.dailyNotes[d]?.metrics.focus_minutes ?? null,
        },
      ],
    },
    {
      key: "steps",
      title: "运动步数",
      unit: " 步",
      yName: "步",
      series: [
        {
          name: "运动步数",
          color: "#2563eb",
          get: (d) => app.dailyNotes[d]?.metrics.steps ?? null,
        },
      ],
    },
  ];

  const GRID = { left: 44, right: 16, top: 36, bottom: 24 };
  const axisLabel = { formatter: (v: string) => v.slice(5) };

  const els: HTMLDivElement[] = [];
  let charts: Chart[] = [];
  /** onMount 初始化后置 true，驱动 $effect 首次可靠执行 */
  let ready = $state(false);

  function dates(): string[] {
    const n = app.trendRange;
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(offsetDays(todayKey(), -i));
    return out;
  }

  onMount(() => {
    charts = els.map((el) => echarts.init(el));
    ready = true;
    const onResize = () => charts.forEach((c) => c.resize());
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      charts.forEach((c) => c.dispose());
      charts = [];
    };
  });

  // 统一折线渲染：一次 effect 绘全部七图（依赖 trendRange / dailyNotes）
  $effect(() => {
    if (!ready) return;
    const ds = dates();
    SPECS.forEach((spec, i) => {
      charts[i]?.setOption({
        grid: GRID,
        tooltip: {
          trigger: "axis",
          valueFormatter: (v: unknown) =>
            spec.tooltipFmt
              ? spec.tooltipFmt(Number(v))
              : `${v}${spec.unit}`,
        },
        legend: spec.series.length > 1 ? { top: 0 } : undefined,
        xAxis: { type: "category", data: ds, axisLabel },
        yAxis: { type: "value", name: spec.yName, ...(spec.yAxis ?? {}) },
        series: spec.series.map((s) => ({
          type: "line" as const,
          name: s.name,
          data: ds.map((d) => s.get(d)),
          connectNulls: true,
          smooth: true,
          itemStyle: { color: s.color },
        })),
      });
    });
  });
</script>

<section class="card block">
  <h2 class="block-title">
    趋势曲线
    <span class="range-tag">近 {app.trendRange} 天</span>
  </h2>
  <div class="charts-grid">
    {#each SPECS as spec, i (spec.key)}
      <div class="chart-box">
        <h3 class="chart-name">{spec.title}</h3>
        <div class="chart" bind:this={els[i]}></div>
      </div>
    {/each}
  </div>
  <p class="tip">
    七项指标统一折线形式；数据来自每日日记 frontmatter，录入/番茄钟记录即实时联动。时间范围在右栏切换（近
    7 / 30 / 90 天）。
  </p>
</section>

<style>
  .block {
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .range-tag {
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--color-text-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  @media (min-width: 1000px) {
    .charts-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .chart-box {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2);
  }

  .chart-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    padding-left: var(--space-1);
  }

  .chart {
    width: 100%;
    height: 220px;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
