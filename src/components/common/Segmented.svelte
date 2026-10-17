<script lang="ts">
  /**
   * 通用分段选择器（v4.17）：灰轨 + 白/深滑块 + 选中加粗。
   * 交互形态参考 uiverse.io（radio-inputs）与 GitHub Primer，配色全走 tokens。
   * 用处：趋势 7/30/90、编辑器模式、番茄钟双模式、外观明暗选择。
   */
  export interface SegmentedOption {
    value: string;
    label: string;
  }

  let {
    options,
    value,
    onchange,
    ariaLabel,
  }: {
    options: SegmentedOption[];
    value: string;
    onchange: (v: string) => void;
    ariaLabel?: string;
  } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={ariaLabel}>
  {#each options as opt (opt.value)}
    <button
      class="seg-item"
      class:active={value === opt.value}
      role="radio"
      aria-checked={value === opt.value}
      onclick={() => onchange(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: 2px;
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 2px;
  }

  .seg-item {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border-radius: calc(var(--radius-sm) - 1px);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .seg-item:hover:not(.active) {
    color: var(--color-text-primary);
  }

  .seg-item.active {
    background-color: var(--color-surface);
    color: var(--color-title);
    font-weight: 600;
    box-shadow: var(--shadow-1);
  }
</style>
