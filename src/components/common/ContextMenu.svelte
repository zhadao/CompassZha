<script lang="ts">
  /**
   * 通用右键菜单（v4.20 §2.9）：GitHub 式浮层（hover 左侧主题色竖条 + 底色微变）；
   * 屏幕坐标定位 + 视口边缘收敛；点击遮罩 / Esc 关闭。菜单由各功能区以 items 传入。
   */
  export interface MenuItem {
    label: string;
    danger?: boolean;
    action: () => void;
  }

  interface Props {
    x: number;
    y: number;
    title?: string;
    items: MenuItem[];
    onclose: () => void;
  }
  let { x, y, title = "", items, onclose }: Props = $props();

  const left = $derived(Math.min(x, window.innerWidth - 190));
  const top = $derived(Math.max(4, Math.min(y, window.innerHeight - (items.length * 34 + 64))));

  function run(item: MenuItem): void {
    item.action();
    onclose();
  }
</script>

<div
  class="menu-veil"
  role="presentation"
  onclick={onclose}
  oncontextmenu={(e) => {
    e.preventDefault();
    onclose();
  }}
>
  <div
    class="ctx-menu"
    style:left="{left}px"
    style:top="{top}px"
    role="menu"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    oncontextmenu={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      if (e.key === "Escape") onclose();
    }}
  >
    {#if title}
      <div class="ctx-title">{title}</div>
    {/if}
    {#each items as item, i (i)}
      <button role="menuitem" class:danger={item.danger} onclick={() => run(item)}>
        {item.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .menu-veil {
    position: fixed;
    inset: 0;
    z-index: 100;
  }

  .ctx-menu {
    position: fixed;
    min-width: 170px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
    padding: var(--space-1);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ctx-title {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: var(--space-1) var(--space-2);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctx-menu button {
    position: relative;
    text-align: left;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-1) calc(var(--space-2) + 3px);
    cursor: pointer;
  }

  /* GitHub 式悬停：左侧 3px 主题色竖条 + 底色微变 */
  .ctx-menu button::before {
    content: "";
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 3px;
    border-radius: 2px;
    background-color: transparent;
    transition: background-color var(--transition-fast);
  }

  .ctx-menu button:hover {
    background-color: var(--color-surface-alt);
  }

  .ctx-menu button:hover::before {
    background-color: var(--color-primary);
  }

  .ctx-menu button.danger {
    color: var(--color-danger);
  }

  .ctx-menu button.danger:hover::before {
    background-color: var(--color-danger);
  }
</style>
