<script lang="ts">
  /**
   * A-7 / R-2b：日历左侧「日程」栏内容（A-8 定宽 195px，由 CalendarPage 渲染）。
   * 显示**所选日期**（`app.selectedDate`）的当日内容：
   * - 「日程」段：当日事件按时间排序（全天置末），点击 → 打开该事件编辑；
   * - 「任务」段：当日任务 checklist（方形勾选框 + 完成划掉），勾选即写盘（`app.toggleTask`）；
   * 顶部「复制」输出与该日 daily 文件一致的 Markdown（`## 日程` + `## 今日清单`），便于贴给 AI。
   * 只读 store、不改数据语义；选中日由时间轴点击 / 待办视图点列回写（R-2b）。
   */
  import { app } from "../../stores/app.svelte";
  import { eventsToMarkdown } from "../../lib/markdown";
  import type { EventItem } from "../../types/schema";

  let copied = $state(false);

  const date = $derived(app.selectedDate);
  const tasks = $derived(app.peekNote(date).tasks);

  /** 当日事件：定时事件按开始时间升序，全天事件排最后（与落盘排序一致） */
  const events = $derived(
    app.events
      .filter((e) => e.date === date)
      .slice()
      .sort((a, b) => {
        if (a.start === null && b.start === null) return a.title.localeCompare(b.title);
        if (a.start === null) return 1;
        if (b.start === null) return -1;
        return a.start.localeCompare(b.start);
      }),
  );

  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const title = $derived.by(() => {
    const d = new Date(`${date}T00:00:00`);
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEK[d.getDay()]}`;
  });

  /** AI Native：与落盘格式一致（## 日程 + ## 今日清单） */
  const mdText = $derived(
    [
      eventsToMarkdown(date, app.events),
      "",
      "## 今日清单",
      ...tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`),
    ].join("\n"),
  );

  async function copyMd(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mdText);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // 无剪贴板权限环境静默失败
    }
  }

  /** 事件行的时间前缀（无开始时间 = 全天） */
  function timeLabel(e: EventItem): string {
    return e.start === null ? "全天" : e.start;
  }
</script>

<section class="card side-card">
  <div class="side-card-head">
    <h3 class="side-card-title">日程</h3>
    <button class="btn-secondary copy-btn" onclick={copyMd}>{copied ? "已复制" : "复制"}</button>
  </div>
  <p class="day-label">{title}</p>

  <h4 class="sec-title">日程</h4>
  {#if events.length === 0}
    <p class="empty">当日无日程</p>
  {:else}
    <ul class="ev-list">
      {#each events as e (e.id)}
        <li>
          <button class="ev-row" title={e.title} onclick={() => app.openEditDraft(e.id)}>
            <span class="ev-time">{timeLabel(e)}</span>
            <span class="ev-title">{e.title}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <h4 class="sec-title">任务</h4>
  {#if tasks.length === 0}
    <p class="empty">当日无任务</p>
  {:else}
    <ul class="tk-list">
      {#each tasks as t (t.id)}
        <li class="tk-item" class:done={t.done}>
          <button
            class="tk-check"
            title={t.done ? "标记为未完成" : "完成"}
            aria-label={t.done ? "标记为未完成" : "完成"}
            aria-pressed={t.done}
            onclick={() => app.toggleTask(date, t.id)}
          ></button>
          <span class="tk-text" title={t.text}>{t.text}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .side-card {
    padding: var(--space-2);
  }

  .side-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
  }

  .side-card-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .copy-btn {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--font-size-xs);
  }

  .day-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .sec-title {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    padding-bottom: 2px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-1);
  }

  .empty {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    opacity: 0.7;
    margin-bottom: var(--space-2);
  }

  .ev-list,
  .tk-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--space-2);
  }

  .ev-row,
  .tk-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    width: 100%;
    padding: 2px var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    text-align: left;
    font-size: var(--font-size-xs);
  }

  .ev-row {
    cursor: pointer;
  }

  .ev-row:hover {
    border-color: var(--color-border);
    background-color: var(--color-surface-alt);
  }

  .ev-time {
    flex-shrink: 0;
    white-space: nowrap;
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
  }

  .ev-title {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  /* 方形勾选框（checkpoint 观感，与待办视图一致） */
  .tk-check {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin-top: 2px;
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
    background-color: var(--color-surface);
    cursor: pointer;
  }

  .tk-item.done .tk-check {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .tk-text {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  .tk-item.done .tk-text {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }
</style>
