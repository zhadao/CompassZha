<script lang="ts">
  /**
   * 样稿角标（UI-006）。
   * mode="live"：功能已通分区（今日/日历），标注数据为原型内存态；
   * mode="static"：静态占位分区。
   */
  let { mode = "static" }: { mode?: "live" | "static" } = $props();

  const text = $derived(
    mode === "live" ? "原型 · 数据重启还原" : "样稿 · 静态展示",
  );
</script>

<span class="badge" class:live={mode === "live"}>{text}</span>

<style>
  .badge {
    position: absolute;
    top: var(--space-2);
    right: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 2px var(--space-2);
    pointer-events: none;
  }

  .badge.live {
    color: var(--color-primary);
    background-color: var(--color-primary-light);
    border-color: var(--color-primary-light);
  }
</style>
