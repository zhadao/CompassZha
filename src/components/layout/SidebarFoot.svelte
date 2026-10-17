<script lang="ts">
  // v4.22 §3.1：侧栏底部两个全局入口（Git 状态 / 打开数据目录）。
  // 从 Sidebar.svelte 拆出（CODE-003 组件行数红线），兼顾展开态与收拢态两种版式。
  import { onMount } from "svelte";
  import {
    persist,
    gitSyncGetConfig,
    openUrlHttps,
    openDataRoot,
  } from "../../lib/tauri-fs";
  import Icon from "../common/Icon.svelte";

  let { collapsed = false }: { collapsed?: boolean } = $props();

  /** Git 状态（v4.18）：启动时读同步配置；已配置则点击经浏览器跳转用户仓库 */
  let gitRemote = $state("");

  onMount(async () => {
    if (!persist) return;
    try {
      const cfg = await gitSyncGetConfig();
      gitRemote = cfg.remote ?? "";
    } catch {
      gitRemote = "";
    }
  });

  async function openGitRepo(): Promise<void> {
    if (!gitRemote) return;
    const url = gitRemote.replace(/\.git$/, "");
    if (!persist) {
      window.open(url, "_blank", "noopener");
      return;
    }
    try {
      await openUrlHttps(url);
    } catch {
      // 打开失败静默（与 AuthorDialog 同策略）
    }
  }

  /** v4.22 §3.1：在资源管理器中打开数据目录。 */
  async function openDataDir(): Promise<void> {
    if (!persist) return;
    try {
      await openDataRoot();
    } catch {
      // 打开失败静默
    }
  }
</script>

{#if collapsed}
  <button
    class="git-status-collapsed"
    class:ready={!!gitRemote}
    title={gitRemote ? "打开仓库" : "GitHub 同步未配置"}
    onclick={() => void openGitRepo()}
  >
    <Icon name="github" size={21} />
  </button>

  <button
    class="git-status-collapsed data-dir"
    title="打开数据目录"
    onclick={() => void openDataDir()}
  >
    <Icon name="file" size={21} />
  </button>
{:else}
  <button
    class="git-status"
    class:ready={!!gitRemote}
    title={gitRemote
      ? `打开仓库：${gitRemote.replace(/\.git$/, "")}`
      : "GitHub 同步未配置（设置页可配置）"}
    onclick={() => void openGitRepo()}
  >
    <Icon name="github" size={21} />
    <span>{gitRemote ? "Git 已配置" : "Git 未配置"}</span>
  </button>

  <button
    class="git-status data-dir"
    title="在资源管理器中打开数据目录"
    onclick={() => void openDataDir()}
  >
    <Icon name="file" size={21} />
    <span>数据目录</span>
  </button>
{/if}

<style>
  .git-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    background: transparent;
    cursor: default;
  }

  .git-status.ready {
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .git-status.ready:hover {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .git-status-collapsed {
    display: flex;
    justify-content: center;
    padding: var(--space-2);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    background: transparent;
    cursor: default;
  }

  .git-status-collapsed.ready {
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .git-status-collapsed.ready:hover {
    background-color: var(--color-surface-alt);
  }

  /* v4.22 §3.1：「数据目录」入口永远可点 */
  .git-status.data-dir,
  .git-status-collapsed.data-dir {
    cursor: pointer;
  }

  .git-status.data-dir:hover,
  .git-status-collapsed.data-dir:hover {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  /* v4.19：GitHub 图标随明暗自适应（浅色近黑 / 深色近白），保证深色下清晰可见 */
  .git-status :global(.icon),
  .git-status-collapsed :global(.icon) {
    color: var(--color-text-primary);
  }
</style>
