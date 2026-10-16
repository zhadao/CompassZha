<script lang="ts">
  /**
   * 板块投入热力图（ECharts calendar+heatmap，总需求 §2.4 v4.1/v4.9）：
   * GitHub contribution 风格——人生板块每建一个板块即生成一张热力图，
   * 统计近 90 天每日清单中 #goal/<板块名> 被任务提及的次数：越多越绿，无记录为白。
   * 数据源（v4.9「存档 ?? 实时」）：过去某天读 life/goal-stats.md 存档优先
   * （仅改过名/删过的板块有存档，历史锁定不漂移），无存档则实时聚合；今天永远实时。
   */
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { offsetDays, todayKey } from "../../lib/date";
  import * as echarts from "echarts/core";
  import { HeatmapChart } from "echarts/charts";
  import {
    CalendarComponent,
    TooltipComponent,
    VisualMapComponent,
  } from "echarts/components";
  import { CanvasRenderer } from "echarts/renderers";

  echarts.use([
    HeatmapChart,
    CalendarComponent,
    TooltipComponent,
    VisualMapComponent,
    CanvasRenderer,
  ]);

  type Chart = ReturnType<typeof echarts.init>;

  /** 近 90 天每天该板块被任务提及的次数（含 0，保证无记录的天也显示白格） */
  function boardCounts(boardName: string): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    for (let i = 89; i >= 0; i--) {
      const date = offsetDays(todayKey(), -i);
      out.push([date, app.boardCountOn(boardName, date)]);
    }
    return out;
  }

  /** GitHub 五档配色：0 白灰 → 4+ 深绿 */
  function buildOption(boardName: string, data: Array<[string, number]>): Record<string, unknown> {
    return {
      tooltip: {
        formatter: (p: unknown) => {
          const d = p as { value: [string, number] };
          return `${d.value[0]}<br/>${boardName}：${d.value[1]} 次提及`;
        },
      },
      visualMap: {
        show: false,
        type: "piecewise",
        pieces: [
          { value: 0, color: "#ebedf0" },
          { value: 1, color: "#9be9a8" },
          { value: 2, color: "#40c463" },
          { value: 3, color: "#30a14e" },
          { min: 4, color: "#216e39" },
        ],
      },
      calendar: {
        top: 22,
        left: 36,
        right: 12,
        cellSize: ["auto", 13],
        range: [offsetDays(todayKey(), -89), todayKey()],
        itemStyle: { color: "#ebedf0", borderColor: "#fff", borderWidth: 2 },
        splitLine: { show: false },
        yearLabel: { show: false },
        monthLabel: { nameMap: "ZH", color: "#9ca3af", fontSize: 10 },
        dayLabel: { nameMap: "ZH", color: "#9ca3af", fontSize: 10 },
      },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
    };
  }

  const els: Record<string, HTMLDivElement> = {};
  let chartMap = new Map<string, Chart>();

  onMount(() => {
    const onResize = () => chartMap.forEach((c) => c.resize());
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chartMap.forEach((c) => c.dispose());
      chartMap.clear();
    };
  });

  // 板块增删 / 任务提及变化 → 重建各板块热力图
  $effect(() => {
    const boards = app.lifeBoards.map((b) => ({ id: b.id, name: b.name }));
    chartMap.forEach((c) => c.dispose());
    chartMap.clear();
    for (const b of boards) {
      const el = els[b.id];
      if (!el) continue;
      const chart = echarts.init(el);
      chart.setOption(buildOption(b.name, boardCounts(b.name)));
      chartMap.set(b.id, chart);
    }
  });
</script>

<section class="card block">
  <h2 class="block-title">
    板块投入热力图
    <span class="range-tag">近 90 天</span>
  </h2>
  {#if app.lifeBoards.length === 0}
    <p class="empty">
      还没有人生板块。到「人生板块」新建一个板块（如「学校」「专业」），在每日清单里用
      #goal/板块名 提到它，这里就会出现它的投入热力图。
    </p>
  {:else}
    {#each app.lifeBoards as board (board.id)}
      <div class="heat-box">
        <h3 class="heat-name">{board.icon} {board.name}</h3>
        <div class="heat-chart" bind:this={els[board.id]}></div>
      </div>
    {/each}
  {/if}
  <p class="tip">
    GitHub contribution 风格：每日清单中 #goal/板块名 被任务提及的次数越多，色块越绿；与任务勾选状态无关。
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

  .heat-box {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .heat-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    padding-left: var(--space-1);
  }

  .heat-chart {
    width: 100%;
    height: 140px;
  }

  .empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    padding: var(--space-3);
    text-align: center;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
