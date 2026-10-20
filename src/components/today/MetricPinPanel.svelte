<script lang="ts">
  /**
   * 「常显」设置面板（从 MetricsForm 拆出，CODE-003）：
   * 勾选内置追踪项 → 直接显示在快速录入表单；其余收进「更多指标」。
   * 「常显」集合持久化到 config.metrics.pinned（D-1 v4.40）。
   */
  import { app } from "../../stores/app.svelte";

  let open = $state(false);
  const builtins = $derived(app.formTrackers.filter((t) => t.builtin));

  function toggle(key: string): void {
    const cur = app.metricPinned;
    app.setMetricPinned(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
  }
</script>

<button class="link-btn" type="button" aria-expanded={open} onclick={() => (open = !open)}>
  {open ? "收起常显设置" : "常显设置"}
</button>

{#if open}
  <div class="pin-box">
    <p class="pin-note">勾选后直接在表单里显示，其余收进「更多指标」。</p>
    <div class="pin-grid">
      {#each builtins as t (t.key)}
        <label class="pin-item">
          <input
            type="checkbox"
            checked={app.metricPinned.includes(t.key)}
            onchange={() => toggle(t.key)}
          />
          <span>{t.name}</span>
        </label>
      {/each}
    </div>
    <p class="pin-note">
      自定义追踪项请在
      <button class="link-btn" type="button" onclick={() => app.gotoSection("settings")}>
        设置 → 数据追踪
      </button>
      中管理。
    </p>
  </div>
{/if}

<style>
  .link-btn {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .pin-box {
    width: 100%;
    margin-top: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-alt);
  }

  .pin-note {
    margin-bottom: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .pin-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
  }

  .pin-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }
</style>
