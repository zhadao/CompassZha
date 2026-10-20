<script lang="ts">
  /**
   * E-2：每周罗盘简报设置（开关 + 周几 + 时间 + 立即预览）。
   * 写入 `config.briefing`；`last_shown` 不在本区维护（由简报弹出时单独写）。
   */
  import { app } from "../../stores/app.svelte";
  import { persist } from "../../lib/tauri-fs";

  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
</script>

<section class="card block">
  <h2 class="block-title">每周罗盘简报</h2>

  <label class="switch-row">
    <input
      type="checkbox"
      checked={app.briefingEnabled}
      disabled={!persist}
      onchange={(e) =>
        void app.setBriefing(e.currentTarget.checked, app.briefingWeekday, app.briefingTime)}
    />
    <span>每周固定时间给我一份简报（也可以随时手动打开）</span>
  </label>

  <div class="field">
    <span class="label">触发时间</span>
    <div class="row">
      <select
        value={app.briefingWeekday}
        disabled={!persist || !app.briefingEnabled}
        aria-label="简报触发周几"
        onchange={(e) =>
          void app.setBriefing(app.briefingEnabled, Number(e.currentTarget.value), app.briefingTime)}
      >
        {#each WEEKDAYS as w, i (w)}
          <option value={i}>{w}</option>
        {/each}
      </select>
      <input
        class="time"
        type="time"
        aria-label="简报触发时刻"
        value={app.briefingTime}
        disabled={!persist || !app.briefingEnabled}
        onchange={(e) =>
          void app.setBriefing(app.briefingEnabled, app.briefingWeekday, e.currentTarget.value)}
      />
    </div>
  </div>

  <p class="block-hint">
    简报只看本周自己的数据：指标变化、各板块留痕、专注合计、还没做的事，最后给一句话建议。错过时间点会在下次打开软件时补上。
  </p>

  <div>
    <button class="btn-secondary" disabled={!persist} onclick={() => app.previewBriefing()}>
      立即预览
    </button>
  </div>
</section>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 560px;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .row {
    display: flex;
    gap: var(--space-2);
  }

  .time {
    max-width: 140px;
  }
</style>
