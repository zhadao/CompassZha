<script lang="ts">
  /**
   * 趋势曲线（ECharts，总需求 §2.4 v4.1 / E-1 v4.41）：
   * 全部统一为折线图形式（平滑曲线，仅系列数不同），覆盖全部追踪项。
   * 图定义由 lib/trendCharts.ts 的 buildChartSpecs(app.trackers, app.dailyNotes) 派生：
   * 内置项按原映射（睡眠时长 → 入睡/起床时间双折线 → 体重 → 支出 → 心情 → 质量 → 专注 → 步数）
   * + **自定义项各出一条折线**（新增指标零改代码自动出现）。
   * 数据源：每日日记 frontmatter（store 内存态，近 7/30/90 天切换）。
   */
  import { onMount, onDestroy } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { offsetDays, todayKey } from "../../lib/date";
  import { buildChartSpecs } from "../../lib/trendCharts";
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

  /** 入睡/起床合并图不在编排序中，用「睡眠时长」的位置占位（R-1d：提升到组件作用域供拖拽复用） */
  const ALIAS: Record<string, string> = { sleep_clock: "sleep_hours" };
  const keyOf = (k: string): string => ALIAS[k] ?? k;

  /** 图定义随追踪项表 / 日记内存态实时派生（D-5：再按仪表盘编排过滤 + 排序） */
  const specs = $derived.by(() => {
    const all = buildChartSpecs(app.trackers, app.dailyNotes);
    const hidden = new Set(app.dashboardHidden);
    const order = app.effDashboardOrder;
    const rank = (k: string): number => {
      const i = order.indexOf(keyOf(k));
      return i === -1 ? order.length + 1 : i;
    };
    return all
      .filter((s) => !hidden.has(keyOf(s.key)))
      .sort((a, b) => rank(a.key) - rank(b.key));
  });

  // R-1d 拖拽排序（原生 HTML5 拖放；与指标卡共用同一份 order，故走 app.moveDashboardKey）
  let dragKey = $state<string | null>(null);
  let overKey = $state<string | null>(null);

  function onDragStart(e: DragEvent, k: string): void {
    dragKey = k;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", k);
    }
  }

  function onDragOver(e: DragEvent, k: string): void {
    if (!dragKey || dragKey === k) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    overKey = k;
  }

  /** 落位语义：往下拖 = 插到目标之后，往上拖 = 插到目标之前 */
  function onDrop(k: string): void {
    const from = dragKey;
    dragKey = null;
    overKey = null;
    if (!from || from === k) return;
    app.moveDashboardKey(keyOf(from), keyOf(k));
  }

  function onDragEnd(): void {
    dragKey = null;
    overKey = null;
  }

  const GRID = { left: 44, right: 16, top: 36, bottom: 24 };
  const axisLabel = { formatter: (v: string) => v.slice(5) };

  /** 时间轴刻度抽稀：按数据跨度决定「每几个点显示一个标签」 */
  function axisInterval(n: number): number {
    if (n <= 8) return 0;
    return Math.ceil(n / 6) - 1;
  }

  /** 图容器（键 → DOM，供动态增删图使用；非响应式，仅作引用表） */
  const elsByKey: Record<string, HTMLDivElement> = {};
  const chartMap = new Map<string, Chart>();
  const roMap = new Map<string, ResizeObserver>();
  let ready = $state(false);

  function dates(): string[] {
    const n = app.trendRange;
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(offsetDays(todayKey(), -i));
    return out;
  }

  onMount(() => {
    ready = true;
  });

  onDestroy(() => {
    roMap.forEach((ro) => ro.disconnect());
    chartMap.forEach((c) => c.dispose());
    chartMap.clear();
    roMap.clear();
  });

  // 统一折线渲染：一次 effect 建/清实例 + 绘全部图（依赖 specs / trendRange / dailyNotes）
  $effect(() => {
    if (!ready) return;
    const keys = specs.map((s) => s.key);

    // 1) 清理已移除的图
    for (const k of [...chartMap.keys()]) {
      if (!keys.includes(k)) {
        roMap.get(k)?.disconnect();
        roMap.delete(k);
        chartMap.get(k)?.dispose();
        chartMap.delete(k);
      }
    }
    // 2) 为新出现的图建实例
    for (const k of keys) {
      if (chartMap.has(k)) continue;
      const el = elsByKey[k];
      if (!el) continue;
      const c = echarts.init(el);
      const ro = new ResizeObserver(() => c.resize());
      ro.observe(el);
      roMap.set(k, ro);
      chartMap.set(k, c);
    }

    // 3) 绘制
    const ds = dates();
    const interval = axisInterval(ds.length);
    specs.forEach((spec) => {
      chartMap.get(spec.key)?.setOption({
        grid: GRID,
        tooltip: {
          trigger: "axis",
          valueFormatter: (v: unknown) =>
            spec.tooltipFmt ? spec.tooltipFmt(Number(v)) : `${v}${spec.unit}`,
        },
        legend: spec.series.length > 1 ? { top: 0 } : undefined,
        xAxis: {
          type: "category",
          data: ds,
          axisLabel: { ...axisLabel, interval },
        },
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
    {#each specs as spec (spec.key)}
      <div
        class="chart-box"
        class:dragging={dragKey === spec.key}
        class:drag-over={overKey === spec.key && dragKey !== spec.key}
        role="group"
        aria-label={`${spec.title} 趋势曲线`}
        title="按住拖动可调整曲线顺序"
        draggable="true"
        ondragstart={(e) => onDragStart(e, spec.key)}
        ondragover={(e) => onDragOver(e, spec.key)}
        ondragleave={() => {
          if (overKey === spec.key) overKey = null;
        }}
        ondrop={() => onDrop(spec.key)}
        ondragend={onDragEnd}
      >
        <h3 class="chart-name">{spec.title}</h3>
        <div class="chart" bind:this={elsByKey[spec.key]}></div>
      </div>
    {/each}
  </div>
  <p class="tip">
    各追踪项统一折线形式（含自定义指标）；可拖动卡片调整顺序；数据来自每日日记 frontmatter，录入/番茄钟记录即实时联动。
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
    overflow: hidden; /* A-1 兜底：极端宽度下裁掉溢出内容，不产生横向滚动 */
    min-width: 0; /* 栅格项允许收缩，图表随容器自适应重绘 */
    cursor: grab; /* R-1d：可拖动排序 */
    transition: border-color var(--transition-fast), opacity var(--transition-fast);
  }

  .chart-box.dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  .chart-box.drag-over {
    border-color: var(--color-accent);
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
