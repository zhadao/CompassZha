<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "./stores/app.svelte";
  import { formatDateCN, todayKey } from "./lib/date";
  import Sidebar from "./components/layout/Sidebar.svelte";
  import DetailPanel from "./components/layout/DetailPanel.svelte";
  import TodayPage from "./components/today/TodayPage.svelte";
  import DailyEditor from "./components/today/DailyEditor.svelte";
  import CalendarPage from "./components/calendar/CalendarPage.svelte";
  import DashboardPage from "./components/dashboard/DashboardPage.svelte";
  import LifeBoardPage from "./components/life/LifeBoardPage.svelte";
  import PomodoroPage from "./components/pomodoro/PomodoroPage.svelte";
  import ChatPage from "./components/chat/ChatPage.svelte";
  import SettingsPage from "./components/settings/SettingsPage.svelte";

  // 阶段 1：挂载即从真实文件装载数据（ensureToday + 近文件扫描 + 板块扫描）
  onMount(() => {
    void app.loadAll();
  });

  // 三档响应式（总需求 §2.9），宽度监听在 store 中注册
  const tooNarrow = $derived(app.winWidth < 800);

  const SECTION_TITLES: Record<string, string> = {
    calendar: "日历",
    dashboard: "仪表盘",
    life: "人生板块",
    pomodoro: "番茄钟",
    chat: "语料对话",
    settings: "设置",
  };

  const title = $derived(
    app.section === "today"
      ? formatDateCN(app.selectedDate)
      : SECTION_TITLES[app.section],
  );

  const isToday = $derived(app.selectedDate === todayKey());
</script>

{#if tooNarrow}
  <div class="too-narrow">
    <p>窗口过窄</p>
    <p class="hint">请将窗口拉宽到 800px 以上使用 CompassZha（当前 {app.winWidth}px）</p>
  </div>
{:else}
  <div class="shell">
    <Sidebar />

    <main class="main">
      <header class="main-header">
        <h1 class="main-title">{title}</h1>
        {#if app.section === "today" && !isToday}
          <button class="btn-secondary back-today" onclick={() => app.gotoSection("today")}>
            回到今天
          </button>
        {/if}
        <button
          class="btn-secondary detail-toggle"
          title={app.detailHidden ? "展开详情栏" : "收起详情栏"}
          onclick={() => app.toggleDetail()}
        >
          {app.detailHidden ? "☰ 详情" : "✕ 详情"}
        </button>
      </header>

      <div class="main-body">
        {#if app.section === "today"}
          {#if app.editorMode}
            <DailyEditor />
          {:else}
            <TodayPage />
          {/if}
        {:else if app.section === "calendar"}
          <CalendarPage />
        {:else if app.section === "dashboard"}
          <DashboardPage />
        {:else if app.section === "life"}
          <LifeBoardPage />
        {:else if app.section === "pomodoro"}
          <PomodoroPage />
        {:else if app.section === "chat"}
          <ChatPage />
        {:else}
          <SettingsPage />
        {/if}
      </div>
    </main>

    {#if app.detailVisible}
      <DetailPanel />
    {/if}
  </div>
{/if}

<style>
  .shell {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .main-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-surface);
  }

  .main-title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .too-narrow {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
  }

  .too-narrow .hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
</style>
