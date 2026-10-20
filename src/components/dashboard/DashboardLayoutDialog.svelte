<script lang="ts">
  /**
   * 仪表盘编排弹窗（D-5，v4.41；R-1d v4.42）：卡片顺序（↑ / ↓）、显隐开关、一键恢复默认。
   * R-1d：伪键 `heatmaps` 与「热力图置顶 / 置底」已退场——热力图顺序改在热力图屏直接拖拽，
   * 本弹窗只保留「数据屏」的卡片编排（order 为指标卡与趋势曲线的唯一次序真相）。
   * 改动**即时生效**并持久化（config.dashboard），与设置页其他偏好同一范式。
   */
  import { app } from "../../stores/app.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  /** 键 → 显示名（追踪项名） */
  const nameByKey = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const t of app.trackers) m[t.key] = t.name;
    return m;
  });

  const items = $derived(app.effDashboardOrder);
  const hiddenSet = $derived(new Set(app.dashboardHidden));

  function move(idx: number, dir: -1 | 1): void {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    app.setDashboardOrder(next);
  }

  function toggleHidden(key: string): void {
    const s = new Set(app.dashboardHidden);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    app.setDashboardHidden([...s]);
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="编排仪表盘" tabindex="-1">
    <h3 class="dialog-title">编排仪表盘</h3>
    <p class="dialog-hint">
      调整数据屏卡片与趋势曲线的呈现顺序、显隐；也可在页面上直接拖动卡片排序。隐藏只影响仪表盘展示，日记里的数据仍完整保留。
    </p>

    <ul class="list">
      {#each items as key, i (key)}
        <li class="row" class:hidden-item={hiddenSet.has(key)}>
          <span class="row-name">{nameByKey[key] ?? key}</span>
          <div class="row-ops">
            <button
              class="icon-btn"
              aria-label="上移"
              title="上移"
              disabled={i === 0}
              onclick={() => move(i, -1)}>↑</button
            >
            <button
              class="icon-btn"
              aria-label="下移"
              title="下移"
              disabled={i === items.length - 1}
              onclick={() => move(i, 1)}>↓</button
            >
            <button
              class="btn-secondary"
              onclick={() => toggleHidden(key)}
              aria-pressed={hiddenSet.has(key)}
            >
              {hiddenSet.has(key) ? "已隐藏" : "显示"}
            </button>
          </div>
        </li>
      {/each}
    </ul>

    <div class="dialog-actions">
      <button class="btn-secondary" onclick={() => app.resetDashboard()}>恢复默认</button>
      <button class="btn-primary" onclick={onclose}>完成</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .dialog {
    width: min(460px, 100%);
    max-height: 80vh;
    overflow: auto;
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dialog-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .dialog-hint {
    margin: 0;
    font-size: var(--font-size-xs);
    line-height: 1.7;
    color: var(--color-text-secondary);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .hidden-item .row-name {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }

  .row-name {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-ops {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .icon-btn {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    transition: all var(--transition-fast);
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--color-title);
    border-color: var(--color-accent);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dialog-actions {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }
</style>
