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
  import ContextMenu, { type MenuItem } from "../common/ContextMenu.svelte";
  import ConfirmDialog from "../common/ConfirmDialog.svelte";
  import EventEditor from "./EventEditor.svelte";
  import CalendarMdPreview from "./CalendarMdPreview.svelte";
  import { hitCalendar } from "../../lib/calendarHit";
  import type { EventItem } from "../../types/schema";

  let calEl: HTMLDivElement;
  let calendar: Calendar | null = null;

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
      // v4.20：contextmenu 拿不到 FC info，右键识别依赖 DOM 反查（dataset.eventId）
      eventDidMount: (info) => {
        info.el.dataset.eventId = info.event.id;
      },
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

    // v4.20 §2.9 + v4.21 修复：右键菜单——事件、日期格、时间槽任何位置。
    // timeGrid 槽行无 data-date 祖先，统一走 hitCalendar（X 坐标兜底反查日列）。
    const onContextMenu = (e: MouseEvent): void => {
      const hit = hitCalendar(calEl, e.target as HTMLElement, e.clientX);
      if (!hit) return;
      e.preventDefault();
      ctxMenu =
        hit.kind === "event"
          ? { x: e.clientX, y: e.clientY, eventId: hit.eventId, date: null }
          : { x: e.clientX, y: e.clientY, eventId: null, date: hit.date };
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

  // v4.20 §2.9：右键菜单状态（事件上 → 编辑/删除事件；日期格 → 添加事件/添加循环事件；均含打开该日日记）
  let ctxMenu = $state<{ x: number; y: number; eventId: string | null; date: string | null } | null>(
    null,
  );
  /** v4.21：待确认删除的事件 id（防误删，先弹「确认删除？」） */
  let confirmDel = $state<string | null>(null);
  /** v4.21：待确认删除的循环规则 id（删除整条循环，含已生成实例） */
  let confirmRule = $state<string | null>(null);
</script>

<div class="page">
  {#if inlineEditor}
    <div class="card inline-editor">
      <EventEditor />
    </div>
  {/if}
  <div class="card cal-card" bind:this={calEl}></div>
  <p class="tip">提示：左键点击空白处新建事件；<b>右键日期格 / 事件 = 添加、编辑或删除菜单</b>；拖拽事件调整时间。</p>

  <CalendarMdPreview />
</div>

{#if ctxMenu}
  {@const ev =
    ctxMenu.eventId ? app.events.find((e) => e.id === ctxMenu!.eventId) : null}
  {@const day = ctxMenu.date ?? ev?.date ?? null}
  {@const ruleId = ev?.ruleId ?? null}
  {@const calItems: MenuItem[] = [
    ...(ev ? [{ label: ruleId ? "编辑循环规则" : "编辑事件", action: () => app.openEditDraft(ev.id) }] : []),
    ...(ev && !ruleId ? [{ label: "删除事件", danger: true, action: () => (confirmDel = ev.id) }] : []),
    ...(ev && ruleId
      ? [
          { label: "删除本次", action: () => app.removeOccurrence(ruleId, ev.date) },
          { label: "删除整条循环", danger: true, action: () => (confirmRule = ruleId) },
        ]
      : []),
    ...(!ev && day
      ? [
          { label: "添加事件", action: () => app.openCreateDraft(day, false) },
          { label: "添加循环事件", action: () => app.openCreateDraft(day, false, "09:00", true) },
        ]
      : []),
    ...(day ? [{ label: "打开该日日记", action: () => app.openDaily(day) }] : []),
  ]}
  <ContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    title={ev ? ev.title : (day ?? "")}
    items={calItems}
    onclose={() => (ctxMenu = null)}
  />
{/if}

{#if confirmDel}
  <ConfirmDialog
    text="确认删除该事件？"
    confirmLabel="删除"
    onConfirm={() => {
      app.removeEvent(confirmDel!);
      confirmDel = null;
    }}
    onCancel={() => (confirmDel = null)}
  />
{/if}

{#if confirmRule}
  <ConfirmDialog
    text="确认删除整条循环？已生成的事件将一并清除。"
    confirmLabel="删除整条循环"
    onConfirm={() => {
      app.removeRecurRule(confirmRule!, true);
      confirmRule = null;
    }}
    onCancel={() => (confirmRule = null)}
  />
{/if}

<style>
  .page {
    position: relative;
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

  /* FullCalendar 与 memos 风格 tokens 对齐。
     v4.19 根因修复：FC 会把 fc 类加到 Calendar 挂载的容器元素本身（即 .cal-card 这个 div），
     所以 FC 变量必须声明在 .cal-card 上（CSS 自定义属性级联至全部 FC 后代）——
     旧写法 `.cal-card :global(.fc)` 要求 .fc 是 .cal-card 的后代，永不匹配，
     导致 FC 内置 --fc-page-bg-color:#fff（深色下顶栏白底）与默认黄橄榄今日列一直生效。 */
  .cal-card {
    --fc-border-color: var(--color-border);
    --fc-page-bg-color: var(--color-surface);
    --fc-neutral-bg-color: var(--color-surface-alt);
    --fc-today-bg-color: var(--color-primary-tint);
    --fc-highlight-color: var(--color-primary-tint);
    --fc-now-indicator-color: var(--color-danger);
  }

  .cal-card :global(.fc) {
    font-size: var(--font-size-sm);
  }

  /* 深色模式兜底：粘性表头（周视图顶部）与工具栏底色显式接 tokens，
     防 FullCalendar 内置 var 默认值 #fff 在深色下残留成白条 */
  .cal-card :global(.fc .fc-toolbar),
  .cal-card :global(.fc .fc-scrollgrid-section-sticky > *) {
    background-color: var(--color-surface);
  }

  .cal-card :global(.fc .fc-button-primary) {
    background-color: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .cal-card :global(.fc .fc-button-primary:not(:disabled).fc-button-active) {
    background-color: var(--color-primary);
    color: var(--color-primary-contrast);
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
    color: var(--color-primary-contrast);
  }

  /* 当日高亮列 = 用户所选主题色淡底（v4.19：独立 tint 变量，随主题色/明暗联动） */
  .cal-card :global(.fc .fc-day-today) {
    background-color: var(--color-primary-tint);
  }
</style>
