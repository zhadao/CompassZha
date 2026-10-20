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
   * R-1d（v4.42）：板块顺序由 config.dashboard.heatmap_order 决定，可在本页直接拖拽调整。
   */
  import { app } from "../../stores/app.svelte";
  import { offsetDays, todayKey } from "../../lib/date";
  import { boardAdvanceOn, buildHeatGrid, HEAT_RANGE_TEXT } from "../../lib/heatmap";
  import type { HeatGrid as Grid } from "../../lib/heatmap";
  import BoardIcon from "../common/BoardIcon.svelte";
  import HeatGrid from "./HeatGrid.svelte";

  /** D-7：焦虑型重复阈值（用户拍板）= 近 14 天提及 ≥6 次且推进 = 0 */
  const ANXIETY_DAYS = 14;
  const ANXIETY_MIN_MENTIONS = 6;

  const grids = $derived.by(() => {
    const today = todayKey();
    const map = new Map<string, Grid>();
    for (const b of app.lifeBoards) {
      map.set(
        b.id,
        buildHeatGrid(
          today,
          (date) => app.boardCountOn(b.name, date),
          (date) => boardAdvanceOn(app.dailyNotes[date], b.name),
        ),
      );
    }
    return map;
  });

  /** D-7：焦虑型重复 = 近 14 天提及 ≥6 次但一次都没完成（嘴上一直提、手上不推进） */
  const anxietyBoards = $derived.by(() => {
    const today = todayKey();
    const set = new Set<string>();
    for (const b of app.lifeBoards) {
      let mentions = 0;
      let advances = 0;
      for (let i = 0; i < ANXIETY_DAYS; i++) {
        const date = offsetDays(today, -i);
        mentions += app.boardCountOn(b.name, date);
        advances += boardAdvanceOn(app.dailyNotes[date], b.name);
      }
      if (mentions >= ANXIETY_MIN_MENTIONS && advances === 0) set.add(b.id);
    }
    return set;
  });

  /** R-1d：热力图块的展示顺序 = dashboard.heatmap_order 优先，未列出的板块按 lifeBoards 原序补在后 */
  const boards = $derived.by(() => {
    const rest = new Map(app.lifeBoards.map((b) => [b.id, b]));
    const out = [];
    for (const id of app.dashboardHeatmapOrder) {
      const b = rest.get(id);
      if (b) {
        out.push(b);
        rest.delete(id);
      }
    }
    for (const b of app.lifeBoards) if (rest.has(b.id)) out.push(b);
    return out;
  });

  // R-1d 拖拽排序（原生 HTML5 拖放，与日历待办视图跨日改期同一范式）
  let dragId = $state<string | null>(null);
  let overId = $state<string | null>(null);

  function onDragStart(e: DragEvent, id: string): void {
    dragId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    }
  }

  function onDragOver(e: DragEvent, id: string): void {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    overId = id;
  }

  /** 落位语义：往下拖 = 插到目标之后，往上拖 = 插到目标之前 */
  function onDrop(id: string): void {
    const from = dragId;
    dragId = null;
    overId = null;
    if (!from || from === id) return;
    const ids = boards.map((b) => b.id);
    const i = ids.indexOf(from);
    const j = ids.indexOf(id);
    if (i < 0 || j < 0) return;
    ids.splice(i, 1);
    ids.splice(j, 0, from);
    app.setDashboardHeatmapOrder(ids);
  }

  function onDragEnd(): void {
    dragId = null;
    overId = null;
  }
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
    {#each boards as board (board.id)}
      {@const grid = grids.get(board.id)}
      {#if grid}
        <div
          class="heat-box"
          class:dragging={dragId === board.id}
          class:drag-over={overId === board.id && dragId !== board.id}
          role="group"
          aria-label={`${board.name} 板块投入热力图`}
          title="按住拖动可调整板块顺序"
          draggable="true"
          ondragstart={(e) => onDragStart(e, board.id)}
          ondragover={(e) => onDragOver(e, board.id)}
          ondragleave={() => {
            if (overId === board.id) overId = null;
          }}
          ondrop={() => onDrop(board.id)}
          ondragend={onDragEnd}
        >
          <h3 class="heat-name">
            <BoardIcon icon={board.icon} size={22} />
            {board.name}
            {#if anxietyBoards.has(board.id)}
              <!-- D-7：近 14 天提及 ≥6 次但推进 = 0 -->
              <span class="anxiety-chip" title="近 14 天反复提及，但没有任何任务被完成">焦虑型重复</span>
            {/if}
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
    cursor: grab; /* R-1d：可拖动排序 */
    transition: border-color var(--transition-fast), opacity var(--transition-fast);
  }

  .heat-box.dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  .heat-box.drag-over {
    border-color: var(--color-accent);
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

  /* D-7：焦虑型重复 chip（只提及、不推进） */
  .anxiety-chip {
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--color-danger);
    background-color: var(--color-danger-bg);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    padding: var(--space-3);
    text-align: center;
  }
</style>
