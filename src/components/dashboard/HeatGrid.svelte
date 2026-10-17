<script lang="ts">
  /**
   * GitHub 风格贡献网格（v4.28，需求文档 §2.4）：
   * 纯展示组件——SVG 以 viewBox 等比铺满容器宽度，因而格子恒为正方形
   * （旧 ECharts 日历图把格子拉成长方形，观感扁平呆板）；
   * 悬停浮层显示「日期 · 板块 · 提及次数」，右下角为「少 → 多」图例。
   * 排布与配色对齐 grubersjoe/react-activity-calendar 与 github.com 贡献日历。
   */
  import {
    HEAT_CELL,
    HEAT_DOW_LABEL,
    HEAT_GAP,
    HEAT_LABEL_H,
    HEAT_LABEL_W,
    HEAT_RANGE_TEXT,
  } from "../../lib/heatmap";
  import type { HeatGrid } from "../../lib/heatmap";

  let { grid, board }: { grid: HeatGrid; board: string } = $props();

  /** 悬停浮层：日期 · 板块 · 提及次数 */
  let tip = $state<{ x: number; y: number; text: string } | null>(null);

  function onOver(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest("[data-date]");
    if (!el) {
      tip = null;
      return;
    }
    tip = {
      x: e.clientX,
      y: e.clientY,
      text: `${el.getAttribute("data-date")} · ${board} ${el.getAttribute("data-count")} 次提及`,
    };
  }
</script>

<!-- 悬浮提示为鼠标专属（与 GitHub 贡献日历一致），格子不做键盘焦点目标 -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<svg
  class="cal"
  viewBox={`0 0 ${grid.width} ${grid.height}`}
  role="img"
  aria-label={`${board} 板块投入热力图，${HEAT_RANGE_TEXT}每日提及次数`}
  onmouseover={onOver}
  onmouseleave={() => (tip = null)}
>
  {#each grid.months as m (m.label + m.start)}
    <text
      class="month"
      x={HEAT_LABEL_W + (m.start - 1) * (HEAT_CELL + HEAT_GAP)}
      y={11}>{m.label}</text>
  {/each}
  {#each [0, 1, 2, 3, 4, 5, 6] as dow (dow)}
    {#if HEAT_DOW_LABEL[dow]}
      <text
        class="dow"
        x={HEAT_LABEL_W - 6}
        y={HEAT_LABEL_H + dow * (HEAT_CELL + HEAT_GAP) + HEAT_CELL - 1}>{HEAT_DOW_LABEL[dow]}</text>
    {/if}
  {/each}
  {#each grid.cells as c, i (c ? c.date : `pad-${i}`)}
    {#if c}
      <rect
        class="hcell lv{c.level}"
        x={HEAT_LABEL_W + (i % grid.weeks) * (HEAT_CELL + HEAT_GAP)}
        y={HEAT_LABEL_H + Math.floor(i / grid.weeks) * (HEAT_CELL + HEAT_GAP)}
        width={HEAT_CELL}
        height={HEAT_CELL}
        rx={2}
        data-date={c.date}
        data-count={c.count}
      />
    {/if}
  {/each}
</svg>

<div class="legend">
  <span>少</span>
  {#each [0, 1, 2, 3, 4] as lv (lv)}
    <i class="swatch lv{lv}"></i>
  {/each}
  <span>多</span>
</div>

{#if tip}
  <div class="tip" style:left="{tip.x + 14}px" style:top="{tip.y - 30}px">{tip.text}</div>
{/if}

<style>
  /* SVG 等比铺满卡片宽度：格子恒为正方形 */
  .cal {
    display: block;
    width: 100%;
    height: auto;
  }

  .month,
  .dow {
    font-size: 9px;
    fill: var(--color-text-tertiary);
  }

  .hcell {
    transition: stroke var(--transition-fast);
  }

  .hcell:hover {
    stroke: var(--color-text-secondary);
    stroke-width: 0.9;
  }

  .hcell.lv0,
  .swatch.lv0 {
    fill: var(--heat-0);
    background: var(--heat-0);
  }

  .hcell.lv1,
  .swatch.lv1 {
    fill: var(--heat-1);
    background: var(--heat-1);
  }

  .hcell.lv2,
  .swatch.lv2 {
    fill: var(--heat-2);
    background: var(--heat-2);
  }

  .hcell.lv3,
  .swatch.lv3 {
    fill: var(--heat-3);
    background: var(--heat-3);
  }

  .hcell.lv4,
  .swatch.lv4 {
    fill: var(--heat-4);
    background: var(--heat-4);
  }

  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
  }

  .tip {
    position: fixed;
    z-index: 60;
    padding: 2px var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-primary);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
