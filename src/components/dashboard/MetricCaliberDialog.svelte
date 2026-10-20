<script lang="ts">
  /**
   * 指标口径说明弹窗（A-3）：原详情栏「指标口径说明」搬进仪表盘页顶部入口。
   * 列出 8 项内置指标的口径与单位（frontmatter 平铺键）。
   */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  /** 指标口径说明（v3.1：8 项，frontmatter 平铺键） */
  const DASHBOARD_CALIBERS: Array<[string, string]> = [
    ["睡眠时长", "frontmatter sleep_hours，单位小时"],
    ["入睡时间", "frontmatter sleep_bedtime，HH:mm"],
    ["起床时间", "frontmatter sleep_wake，HH:mm"],
    ["体重", "frontmatter weight_kg，单位 kg，晨起空腹"],
    ["当日支出", "frontmatter spend_total，单位元，含全部消费"],
    ["心情", "frontmatter mood，1-5 整数"],
    ["专注时长", "focus_minutes，番茄钟记录自动累加"],
    ["运动步数", "frontmatter steps，单位步"],
  ];
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<div
  class="overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onclose();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="指标口径说明">
    <div class="head">
      <h3 class="title">指标口径说明</h3>
      <button class="btn-secondary" onclick={onclose}>关闭</button>
    </div>
    <ul class="caliber-list">
      {#each DASHBOARD_CALIBERS as [name, desc] (name)}
        <li>
          <div class="c-name">{name}</div>
          <div class="c-desc">{desc}</div>
        </li>
      {/each}
    </ul>
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
    width: min(520px, 100%);
    max-height: min(80vh, 640px);
    overflow-y: auto;
    padding: var(--space-4);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .title {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .caliber-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .c-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .c-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: var(--space-1);
  }
</style>
