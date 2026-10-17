<script lang="ts">
  /**
   * 板块投入热力图（v4.28 重写，总需求 §2.4）：
   * 人生板块每建一个板块即生成一张 GitHub contribution 风格的投入热力图——
   * 统计每日清单中 #goal/<板块名> 被任务提及的次数：越多越绿，无记录为白。
   * 排版与配色对齐 grubersjoe/react-activity-calendar（网格计算见 lib/heatmap.ts，
   * 渲染见 HeatGrid.svelte，本组件只负责分区容器与板块标题）。
   * 数据源（v4.9「存档 ?? 实时」）：过去某天读 life/goal-stats.md 存档优先
   * （仅改过名/删过的板块有存档，历史锁定不漂移），无存档则实时聚合；今天永远实时。
   * 板块标题图标走 BoardIcon(board.icon)，与板块卡片/面包屑/右栏摘要同源，保证图标一致。
   */
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import { buildHeatGrid, HEAT_RANGE_TEXT } from "../../lib/heatmap";
  import type { HeatGrid as Grid } from "../../lib/heatmap";
  import BoardIcon from "../common/BoardIcon.svelte";
  import HeatGrid from "./HeatGrid.svelte";

  const grids = $derived.by(() => {
    const today = todayKey();
    const map = new Map<string, Grid>();
    for (const b of app.lifeBoards) {
      map.set(b.id, buildHeatGrid(today, (date) => app.boardCountOn(b.name, date)));
    }
    return map;
  });
</script>

<section class="card block">
  <h2 class="block-title">
    板块投入热力图
    <span class="range-tag">{HEAT_RANGE_TEXT}</span>
  </h2>
  {#if app.lifeBoards.length === 0}
    <p class="empty">
      还没有人生板块。到「人生板块」新建一个板块（如「学校」「专业」），在每日清单里用
      #goal/板块名 提到它，这里就会出现它的投入热力图。
    </p>
  {:else}
    {#each app.lifeBoards as board (board.id)}
      {@const grid = grids.get(board.id)}
      {#if grid}
        <div class="heat-box">
          <h3 class="heat-name">
            <BoardIcon icon={board.icon} size={22} />
            {board.name}
          </h3>
          <HeatGrid {grid} board={board.name} />
        </div>
      {/if}
    {/each}
  {/if}
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
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-2);
  }

  .heat-name {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    padding: var(--space-3);
    text-align: center;
  }
</style>
