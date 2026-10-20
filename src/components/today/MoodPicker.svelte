<script lang="ts">
  /**
   * 档位选择器（默认 1-5；再次点击已选档位可清除）。
   * v4.31：以自绘 SVG 图标替换原 emoji 下拉。从 MetricsForm 拆出（CODE-003：组件 ≤300 行）。
   * E-1：泛化为可传 `max`——≤5 档用自带心情图标，>5 档退化为数字档位按钮。
   */
  import Icon from "../common/Icon.svelte";

  interface Props {
    /** 当前档位（字符串态，"" = 未选；与 frontmatter 字段同型） */
    value?: string;
    /** 字段标题 */
    label?: string;
    /** 档位上限（缺省 5；E-1 自定义档位型指标可自定） */
    max?: number;
  }
  let { value = $bindable(""), label = "心情（1-5）", max = 5 }: Props = $props();

  /** 档位枚举 1..max（上限钳到 2..10，图标最多 5 档） */
  const levels = $derived(
    Array.from({ length: Math.min(Math.max(Math.round(max) || 5, 2), 10) }, (_, i) => i + 1),
  );
  const useIcons = $derived(levels.length <= 5);
</script>

<div class="field">
  <span class="label">{label}</span>
  <div class="mood-row" role="group" aria-label={label}>
    {#each levels as m (m)}
      <button
        type="button"
        class="mood-btn"
        class:active={value === String(m)}
        class:plain={!useIcons}
        aria-pressed={value === String(m)}
        aria-label={`${label} ${m}`}
        title={`${label} ${m}（再次点击可清除）`}
        onclick={() => (value = value === String(m) ? "" : String(m))}
      >
        {#if useIcons}
          <Icon name={`mood-${m}`} size={30} />
        {:else}
          <span class="pill-num">{m}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .mood-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .mood-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    opacity: 0.4;
    cursor: pointer;
    transition:
      opacity var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .mood-btn.plain {
    opacity: 0.6;
    border-color: var(--color-border);
  }

  .pill-num {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .mood-btn:hover {
    opacity: 0.8;
    background: var(--color-surface-alt);
  }

  .mood-btn.active {
    opacity: 1;
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .mood-btn.active .pill-num {
    color: var(--color-primary);
    font-weight: 600;
  }

  .mood-btn:focus-visible {
    outline: 2px solid var(--color-focus-ring, var(--color-primary));
    outline-offset: 2px;
  }
</style>
