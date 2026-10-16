<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import type { SectionId } from "../../types/schema";
  import FileTree from "./FileTree.svelte";

  const NAV: Array<{ id: SectionId; label: string; icon: string }> = [
    { id: "today", label: "今日", icon: "📅" },
    { id: "calendar", label: "日历", icon: "📆" },
    { id: "dashboard", label: "仪表盘", icon: "📊" },
    { id: "life", label: "人生板块", icon: "🧭" },
    { id: "pomodoro", label: "番茄钟", icon: "🍅" },
    { id: "settings", label: "设置", icon: "⚙️" },
  ];
</script>

<aside class="sidebar" class:collapsed={app.sidebarCollapsed}>
  <button
    class="collapse-btn"
    title={app.sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
    onclick={() => (app.sidebarCollapsed = !app.sidebarCollapsed)}
  >
    {app.sidebarCollapsed ? "»" : "«"}
  </button>

  {#if !app.sidebarCollapsed}
    <div class="brand">
      <div class="app-name">CompassZha</div>
      <button class="today-btn" onclick={() => app.gotoSection("today")}>
        📅 今天 · 快速进入
      </button>
    </div>

    <nav class="nav">
      {#each NAV as item (item.id)}
        <button
          class="nav-item"
          class:active={app.section === item.id}
          onclick={() => app.gotoSection(item.id)}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
      <button class="nav-item disabled" disabled title="v2 才上线的 RAG 自我对话">
        <span class="nav-icon">💬</span>
        <span class="nav-label">语料对话</span>
        <span class="v2-tag">v2</span>
      </button>
    </nav>

    <FileTree />

    <div class="git-status">
      <span class="dot"></span>
      Git 未配置
    </div>
  {:else}
    <div class="brand-collapsed">
      <button class="today-btn icon-only" title="今天" onclick={() => app.gotoSection("today")}>
        📅
      </button>
      {#each NAV as item (item.id)}
        <button
          class="nav-item icon-only"
          class:active={app.section === item.id}
          title={item.label}
          onclick={() => app.gotoSection(item.id)}
        >
          {item.icon}
        </button>
      {/each}
      <button class="nav-item icon-only disabled" disabled title="语料对话（v2）">
        💬
      </button>
    </div>
    <div class="git-status-collapsed"><span class="dot"></span></div>
  {/if}
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

  .collapse-btn {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-md);
    padding: var(--space-1);
    z-index: 1;
  }

  .sidebar.collapsed .collapse-btn {
    right: 50%;
    transform: translateX(50%);
  }

  .collapse-btn:hover {
    color: var(--color-text-primary);
  }

  .brand {
    padding: var(--space-4) var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .app-name {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: var(--space-2);
  }

  .today-btn {
    width: 100%;
    text-align: left;
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    transition: background-color var(--transition-fast);
  }

  .today-btn:hover {
    background-color: var(--color-primary);
    color: var(--color-surface);
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
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-item.disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .v2-tag {
    margin-left: auto;
    font-size: var(--font-size-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    color: var(--color-text-tertiary);
  }

  .git-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .git-status .dot,
  .git-status-collapsed .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-muted);
  }

  .git-status-collapsed {
    display: flex;
    justify-content: center;
    padding: var(--space-2);
    border-top: 1px solid var(--color-border);
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
