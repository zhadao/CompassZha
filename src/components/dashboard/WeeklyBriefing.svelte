<script lang="ts">
  /**
   * E-2：每周罗盘简报（一个弹层、两个按钮，不填写不打分）。
   * 内容全部由 `app.briefingData` 本地聚合而来；「现在开始」= 关掉简报并直接开正计时，
   * 「稍后」= 只关闭（两者都会记录弹出时刻，避免重启后重复弹）。
   */
  import type { BriefingResult } from "../../lib/briefing";

  interface Props {
    data: BriefingResult;
    onStart: () => void;
    onLater: () => void;
  }
  let { data, onStart, onLater }: Props = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onLater();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={data.title} tabindex="-1">
    <header class="head">
      <h2>{data.title}</h2>
      <p class="range">{data.dateRange}</p>
    </header>

    <div class="body">
      <section class="sec">
        <h3>本周状态</h3>
        <ul>
          {#each data.metricLines as line (line)}
            <li>{line}</li>
          {/each}
        </ul>
      </section>

      <section class="sec">
        <h3>各板块留痕</h3>
        {#if data.boardLines.length === 0}
          <p class="empty">还没有人生板块</p>
        {:else}
          <ul>
            {#each data.boardLines as line (line)}
              <li>{line}</li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="sec">
        <h3>专注与清单</h3>
        <p>{data.focusLine}</p>
        <p>{data.taskLine}</p>
        {#if data.taskLines.length > 0}
          <ul>
            {#each data.taskLines as line (line)}
              <li class="least">{line}</li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="sec tip">
        <h3>一句话建议</h3>
        <p class="suggest">{data.suggestion}</p>
      </section>
    </div>

    <footer class="acts">
      <button class="btn ghost" onclick={onLater}>稍后</button>
      <button class="btn primary" onclick={onStart}>现在开始</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: var(--color-overlay);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    width: min(520px, 100%);
    max-height: min(680px, 90vh);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    overflow: hidden;
  }

  .head {
    flex-shrink: 0;
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .head h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .range {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sec h3 {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text-tertiary);
  }

  .sec p {
    margin: 0 0 2px;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .sec ul {
    margin: 0;
    padding-left: var(--space-4);
    font-size: var(--font-size-sm);
    line-height: 1.7;
    color: var(--color-text-secondary);
  }

  .empty {
    color: var(--color-text-tertiary);
  }

  .least {
    color: var(--color-warning);
  }

  /* 建议是整段的主角：给一层浅底，避免与统计行混在一起 */
  .tip {
    padding: var(--space-3);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-md);
  }

  .suggest {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    line-height: 1.6;
    color: var(--color-title);
  }

  .acts {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: var(--space-1) var(--space-4);
    font-size: var(--font-size-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .btn.primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .btn.primary:hover {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .btn.ghost {
    background: transparent;
    color: var(--color-text-secondary);
  }

  .btn.ghost:hover {
    background-color: var(--color-surface-alt);
  }
</style>
