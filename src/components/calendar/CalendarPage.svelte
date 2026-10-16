<script lang="ts">
  import { onMount } from "svelte";
  import {
    Calendar,
    type EventClickArg,
    type EventDropArg,
    type EventInput,
  } from "@fullcalendar/core";
  import dayGridPlugin from "@fullcalendar/daygrid";
  import timeGridPlugin from "@fullcalendar/timegrid";
  import listPlugin from "@fullcalendar/list";
  import interactionPlugin from "@fullcalendar/interaction";
  import type {
    DateClickArg,
    EventResizeDoneArg,
  } from "@fullcalendar/interaction";
  import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
  import { app } from "../../stores/app.svelte";
  import StaticBadge from "../layout/StaticBadge.svelte";
  import EventEditor from "./EventEditor.svelte";
  import { eventsToMarkdown } from "../../lib/markdown";
  import type { EventItem } from "../../types/schema";

  let calEl: HTMLDivElement;
  let calendar: Calendar | null = null;
  let copied = $state(false);

  const purpose =
    "干什么：日/周/月/清单视图排时间块；事件实时写入当日 Markdown 文件的「## 日程」章节（500ms 防抖落盘）——单文件即一天全貌，可直接喂给 AI 分析。";

  /** EventItem → FullCalendar 事件 */
  function toFcEvents(events: EventItem[]): EventInput[] {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start ? `${e.date}T${e.start}:00` : e.date,
      end: e.end ? `${e.date}T${e.end}:00` : undefined,
      allDay: e.start === null,
    }));
  }

  /** FullCalendar 日期串（"yyyy-mm-dd" 或 "yyyy-mm-ddTHH:mm:ss"）→ 日期 + HH:mm */
  function parseDateStr(s: string): { date: string; time: string | null } {
    if (s.includes("T")) {
      const [d, t] = s.split("T");
      return { date: d, time: t.slice(0, 5) };
    }
    return { date: s, time: null };
  }

  function onDateClick(info: DateClickArg): void {
    const p = parseDateStr(info.dateStr);
    app.openCreateDraft(p.date, info.allDay, p.time ?? "09:00");
  }

  function onEventClick(info: EventClickArg): void {
    app.openEditDraft(info.event.id);
  }

  function onEventChange(info: EventDropArg | EventResizeDoneArg): void {
    const start = parseDateStr(info.event.startStr);
    const end = info.event.endStr ? parseDateStr(info.event.endStr) : null;
    app.updateEvent(info.event.id, {
      date: start.date,
      start: info.event.allDay ? null : start.time,
      end: info.event.allDay ? null : end?.time ?? null,
    });
  }

  onMount(() => {
    const cal = new Calendar(calEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: zhCnLocale,
      initialView: "timeGridWeek",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
      },
      height: "auto",
      firstDay: 1,
      editable: true,
      selectable: false,
      nowIndicator: true,
      dayMaxEvents: true,
      events: toFcEvents(app.events),
      dateClick: onDateClick,
      eventClick: onEventClick,
      eventDrop: onEventChange,
      eventResize: onEventChange,
      buttonText: {
        today: "今天",
        day: "日",
        week: "周",
        month: "月",
        list: "清单",
      },
    });
    cal.render();
    calendar = cal;

    // v4.3：右键日期格 → 打开/创建该日日记（左键已用于新建日程，无冲突）
    const onContextMenu = (e: MouseEvent): void => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
      if (!cell?.dataset.date) return;
      e.preventDefault();
      app.openDaily(cell.dataset.date.slice(0, 10));
    };
    calEl.addEventListener("contextmenu", onContextMenu);

    // store 事件变化 → 重建事件源（数据源 = store 内存态，写回经 flush 落盘）
    return () => {
      calEl.removeEventListener("contextmenu", onContextMenu);
      cal.destroy();
    };
  });

  // 响应 store 中事件增删改
  $effect(() => {
    void app.events;
    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(toFcEvents(app.events));
    }
  });
  // 右栏不可见（800–1280 档自动收起 / 手动收起）时，编辑器内联显示在日历页上方，
  // 避免点击空白/事件后表单不可见导致「无响应」。
  const inlineEditor = $derived(!!app.calendarDraft && !app.detailVisible);

  // 当日事件 → Markdown（与写回当日文件「## 日程」章节的格式一致）
  const mdPreview = $derived(eventsToMarkdown(app.selectedDate, app.events));

  /** 复制预览文本（浏览器 clipboard API，无网络） */
  async function copyMd(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mdPreview);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // 无头 / 无剪贴板权限环境静默失败
    }
  }
</script>

<div class="page">
  <StaticBadge mode="live" />
  <p class="purpose">{purpose}</p>
  {#if inlineEditor}
    <div class="card inline-editor">
      <EventEditor />
    </div>
  {/if}
  <div class="card cal-card" bind:this={calEl}></div>
  <p class="tip">提示：左键点击空白处新建事件；<b>右键点击日期格 = 打开（或创建）该日日记</b>；拖拽事件调整时间。</p>

  <section class="card md-card">
    <div class="md-head">
      <h3 class="md-title">当日事件 · Markdown 预览（{app.selectedDate}）</h3>
      <button class="btn-secondary" onclick={copyMd}>{copied ? "已复制" : "复制"}</button>
    </div>
    <pre class="md-pre">{mdPreview}</pre>
    <p class="md-note">
      日历事件已实时以该格式写入当日文件的「## 日程」章节（新建/编辑/拖拽均防抖落盘 + 本地 git
      提交）——Markdown 对 AI 足够可读，单文件即一天全貌。
    </p>
  </section>
</div>

<style>
  .page {
    position: relative;
  }

  .purpose {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .cal-card {
    padding: var(--space-3);
  }

  .inline-editor {
    max-width: 420px;
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .md-card {
    margin-top: var(--space-3);
    padding: var(--space-3);
  }

  .md-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .md-title {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .md-pre {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    line-height: 1.8;
    color: var(--color-text-secondary);
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .md-note {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  /* FullCalendar 与 memos 风格 tokens 对齐 */
  .cal-card :global(.fc) {
    --fc-border-color: var(--color-border);
    --fc-page-bg-color: var(--color-surface);
    font-size: var(--font-size-sm);
  }

  .cal-card :global(.fc .fc-button-primary) {
    background-color: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .cal-card :global(.fc .fc-button-primary:not(:disabled).fc-button-active) {
    background-color: var(--color-primary);
    color: var(--color-surface);
    border-color: var(--color-primary);
  }

  .cal-card :global(.fc .fc-button-primary:disabled) {
    background-color: var(--color-surface-alt);
    color: var(--color-text-tertiary);
    border-color: var(--color-border);
  }

  .cal-card :global(.fc-event) {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    border: 1px solid var(--color-primary-light);
    cursor: pointer;
  }

  .cal-card :global(.fc-event:hover) {
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .cal-card :global(.fc .fc-today) {
    background-color: var(--color-surface-alt);
  }
</style>
