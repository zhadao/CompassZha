<script lang="ts">
  // 说明书入口（v4.30 §2.16）：设置页顶部「详细说明」按钮。
  // 常规按钮样式（v4.31 去掉书本翻页动效）；配色走设计变量 → 自动适配明暗双态与四主题色。
  import Icon from "../common/Icon.svelte";
  import { manual } from "../../stores/manual.svelte";

  interface Props {
    /** 可选：外部文案（默认「详细说明」） */
    label?: string;
  }
  let { label = "详细说明" }: Props = $props();
</script>

<button class="manual-btn" aria-label="打开说明书" onclick={() => manual.openManual()}>
  <Icon name="help" size={16} />
  <span>{label}</span>
</button>

<style>
  .manual-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    /* 窄容器下不允许被挤成「一字一行」：整块不参与收缩，文案不换行 */
    flex-shrink: 0;
    height: 34px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .manual-btn:hover {
    background: var(--color-surface-alt);
    border-color: var(--color-primary);
  }

  .manual-btn:focus-visible {
    outline: 2px solid var(--color-focus-ring, var(--color-primary));
    outline-offset: 2px;
  }
</style>
