<script lang="ts">
  /**
   * R-3 设置页目录（v4.45）：左侧 sticky 目录，与右侧 8 个设置区块一一对应。
   * - 点击 → 平滑滚到对应锚点；
   * - 滚动 → 取「最后一个已越过判定线的区块」为当前项并高亮（aria-current 同步）。
   * 新增设置区只需在 ITEMS 与 SettingsPage 的区块外壳各加一行。
   */
  import { onMount } from "svelte";

  interface Item {
    id: string;
    label: string;
  }

  const ITEMS: Item[] = [
    { id: "sec-git", label: "同步" },
    { id: "sec-ai", label: "AI 配置" },
    { id: "sec-window", label: "窗口" },
    { id: "sec-data", label: "数据" },
    { id: "sec-appearance", label: "外观" },
    { id: "sec-calendar", label: "日历" },
    { id: "sec-tracker", label: "数据追踪" },
    { id: "sec-briefing", label: "每周简报" },
  ];

  /** 判定线：区块顶边越过该位置即视为「已到达」 */
  const HIT_LINE = 120;

  let active = $state(ITEMS[0].id);

  function refresh() {
    let cur = ITEMS[0].id;
    for (const { id } of ITEMS) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= HIT_LINE) cur = id;
    }
    active = cur;
  }

  function jump(id: string) {
    active = id;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  onMount(() => {
    refresh();
    // 页面滚动发生在内层 .main-body 中，scroll 不冒泡 → 用捕获阶段统一接住
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  });
</script>

<nav class="toc" aria-label="设置目录">
  {#each ITEMS as it (it.id)}
    <button
      class="item"
      class:active={active === it.id}
      aria-current={active === it.id ? "true" : undefined}
      onclick={() => jump(it.id)}
    >
      {it.label}
    </button>
  {/each}
</nav>

<style>
  .toc {
    position: sticky;
    top: 0;
    align-self: flex-start;
    flex-shrink: 0;
    width: 124px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: var(--space-1);
  }

  .item {
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border-left: 2px solid transparent;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    background: transparent;
    transition: color var(--transition-fast), background-color var(--transition-fast);
  }

  .item:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }

  .item.active {
    color: var(--color-primary);
    background-color: var(--color-primary-tint);
    border-left-color: var(--color-primary);
    font-weight: 600;
  }
</style>
