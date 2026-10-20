<script lang="ts">
  /**
   * frontmatter 摘要（实时，逐项列出全部追踪项：内置 + 自定义）。
   * 从 MetricsForm 拆出（CODE-003：组件 ≤300 行）；E-1：改由 app.trackers 驱动。
   */
  import { app } from "../../stores/app.svelte";
  import { fmtTrackerValue } from "../../lib/trackers";

  const rows = $derived(
    app.trackers
      .filter((t) => !t.hidden)
      .map((t) => {
        const v = t.builtin
          ? (app.note.metrics as unknown as Record<string, number | string | null>)[t.key]
          : app.note.metricsExtra[t.key];
        return { key: t.key, name: t.name, value: fmtTrackerValue(t, v) };
      }),
  );
</script>

<section class="panel-block">
  <h3 class="panel-title">frontmatter 摘要</h3>
  <ul class="summary">
    {#each rows as r (r.key)}
      <li class:unset={r.value === "—"}>
        <span class="s-label">{r.name}</span>
        <span class="s-value">{r.value}</span>
      </li>
    {/each}
  </ul>
  <p class="tip">录入实时写入当日 Markdown 文件的 frontmatter（500ms 防抖落盘 + 本地 git 提交），仪表盘同步联动。</p>
</section>

<style>
  .panel-block {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }

  .summary li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .summary li.unset {
    color: var(--color-text-tertiary);
  }

  .s-label {
    color: var(--color-text-secondary);
  }

  .s-value {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
