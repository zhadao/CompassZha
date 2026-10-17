<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import type { SectionId } from "../../types/schema";
  import FileTree from "./FileTree.svelte";
  import SidebarFoot from "./SidebarFoot.svelte";
  import Icon from "../common/Icon.svelte";

  const NAV: Array<{ id: SectionId; label: string; icon: string }> = [
    { id: "today", label: "今日", icon: "today" },
    { id: "calendar", label: "日历", icon: "calendar" },
    { id: "dashboard", label: "仪表盘", icon: "dashboard" },
    { id: "life", label: "人生板块", icon: "life" },
    { id: "pomodoro", label: "番茄钟", icon: "pomodoro" },
    { id: "chat", label: "隆中对", icon: "chat" },
    { id: "settings", label: "设置", icon: "settings" },
  ];
</script>

<aside class="sidebar" class:collapsed={app.sidebarCollapsed}>
  <button
    class="collapse-btn"
    title={app.sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
    aria-label={app.sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
    onclick={() => (app.sidebarCollapsed = !app.sidebarCollapsed)}
  >
    <Icon name="collapse" size={16} />
  </button>

  {#if !app.sidebarCollapsed}
    <div class="brand">
      <div class="app-name">
        <Icon name="logo" size={55} />
        <span>CompassZha</span>
      </div>
      <button class="today-btn" onclick={() => app.gotoSection("today")}>
        <Icon name="today" size={21} />
        今天 · 快速进入
      </button>
    </div>

    <nav class="nav">
      {#each NAV as item (item.id)}
        <button
          class="nav-item"
          class:active={app.section === item.id}
          onclick={() => app.gotoSection(item.id)}
        >
          <span class="nav-icon"><Icon name={item.icon} size={27} /></span>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </nav>

    <FileTree />
  {:else}
    <div class="brand-collapsed">
      <button class="today-btn icon-only" title="今天" onclick={() => app.gotoSection("today")}>
        <Icon name="today" size={27} />
      </button>
      {#each NAV as item (item.id)}
        <button
          class="nav-item icon-only"
          class:active={app.section === item.id}
          title={item.label}
          onclick={() => app.gotoSection(item.id)}
        >
          <Icon name={item.icon} size={27} />
        </button>
      {/each}
    </div>
  {/if}

  <SidebarFoot collapsed={app.sidebarCollapsed} />
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface);
    border-right: 1px solid var(--color-border);
    overflow-y: auto;
    position: relative;
    transition: width var(--transition-fast);
  }

  .sidebar.collapsed {
    width: var(--sidebar-width-collapsed);
  }

  /* v4.20：展开/收拢角标 = 用户自绘「箭头.svg」16px，文档流独立首行（chip 样式），
     与品牌 LOGO 清晰区隔不堆叠；收拢态镜像朝右（提示可展开） */
  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 28px;
    margin: var(--space-2) auto var(--space-1);
    padding: 0;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast), border-color var(--transition-fast);
  }

  .sidebar.collapsed .collapse-btn :global(svg) {
    transform: scaleX(-1);
  }

  .collapse-btn:hover {
    color: var(--color-text-primary);
    border-color: var(--color-primary);
  }

  .brand {
    padding: var(--space-4) var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .app-name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-title);
    margin-bottom: var(--space-2);
  }

  .today-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    text-align: left;
    background-color: var(--color-primary-light);
    color: var(--color-title);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    transition: background-color var(--transition-fast);
  }

  .today-btn:hover {
    background-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .nav {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-md);
    transition: all var(--transition-fast);
  }

  .nav-item:hover:not(.disabled):not(.active) {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .nav-item.active {
    background-color: var(--color-primary-light);
    color: var(--color-title);
    font-weight: 600;
  }

  .nav-icon {
    display: inline-flex;
    line-height: 0;
  }

  .brand-collapsed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding-top: var(--space-4);
  }

  .nav-item.icon-only,
  .today-btn.icon-only {
    justify-content: center;
    width: var(--space-4);
    padding: var(--space-1);
    text-align: center;
  }
</style>
