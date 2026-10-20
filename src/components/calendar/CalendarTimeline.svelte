<script lang="ts">
  /**
   * 日历「时间轴」视图宿主（FullCalendar 挂载 + 缩放 / 刻度接线 + 右键菜单）。
   * 从 CalendarPage 抽出（CODE-003 ≤300 行）；由页面按视图模式 `{#if}` 挂载，
   * 组件卸载即销毁 FC 实例（切到「待办」模式不会再对隐藏容器做测量）。
   */
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
  import CalendarMenus from "./CalendarMenus.svelte";
  import { hitCalendar } from "../../lib/calendarHit";
  import {
    applyCalendarZoom,
    attachWheelZoom,
    stepPxPerHour,
    slotHeightPx,
  } from "../../lib/calendarZoom";
  import "./calendar-fc.css"; // FullCalendar 运行时 DOM 的视觉对齐（全局样式，见文件头说明）
  import type { EventItem } from "../../types/schema";

  let calEl: HTMLDivElement;
  let calendar: Calendar | null = null;

  /** A-4：HH:mm → FullCalendar 时刻串（补足秒） */
  function toFcTime(hhmm: string): string {
    return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  }

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
    app.selectDay(p.date); // R-2b：左侧「日程」栏跟随点选日期
    app.openCreateDraft(p.date, info.allDay, p.time ?? "09:00");
  }

  function onEventClick(info: EventClickArg): void {
    const ev = app.events.find((x) => x.id === info.event.id);
    if (ev) app.selectDay(ev.date); // R-2b：点事件也把左栏切到它所在的那天
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

  // v4.20 §2.9：右键菜单状态（事件上 → 编辑/删除事件；日期格 → 添加事件/添加循环事件；均含打开该日日记）
  let ctxMenu = $state<{ x: number; y: number; eventId: string | null; date: string | null } | null>(
    null,
  );

  onMount(() => {
    // A-5：先把行高 CSS 变量写好——FC 首次构建即按它测量格子，事件一次性贴合时间轴
    calEl.style.setProperty("--cal-slot-h", `${slotHeightPx(app.calendarPxPerHour)}px`);
    const cal = new Calendar(calEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: zhCnLocale,
      initialView: "timeGridWeek",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
      },
      height: "auto", // A-5：表高由内容（行数 × 行高）决定 → 缩小即变短，一屏放得下一天
      expandRows: false, // A-5：禁止 FC 把行高拉伸到容器高（否则缩放比例失真）
      slotMinTime: toFcTime(app.calendarSlotMin), // A-4：常用时段起点（config.calendar）
      slotMaxTime: toFcTime(app.calendarSlotMax), // A-4：常用时段终点
      slotDuration: "00:15:00", // A-5：时间格粒度固定 15 分钟（缩放只改「像素 / 时间比」，不改粒度）
      snapDuration: "00:05:00", // A-5：吸附粒度固定 5 分钟
      eventMinHeight: 0, // A-5：不设最小高度，否则粗档下短事件会破坏时间比例（贴轴）
      // A-5 / A-6：slotLabelInterval / slotLabelFormat / slotLabelContent / slotLaneClassNames
      // 由 applyCalendarZoom 统一接线（需随缩放档位与刻度规则反复重建函数引用）
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
    // A-5 / A-6：按当前缩放档位与刻度规则接线（行高变量已在上面写好）
    applyCalendarZoom(cal, calEl, {
      pxPerHour: app.calendarPxPerHour,
      slotMin: app.calendarSlotMin,
      ticks: app.calendarTicks,
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

    // A-5：Ctrl+滚轮缩放视图（仅 timeGrid 视图改档位；其他视图仍阻止 WebView2 整页缩放）
    const detachZoom = attachWheelZoom(calEl, (dir) => {
      if (cal.view.type.startsWith("timeGrid")) {
        app.setCalendarPxPerHour(stepPxPerHour(app.calendarPxPerHour, dir));
      }
    });

    // store 事件变化 → 重建事件源（数据源 = store 内存态，写回经 flush 落盘）
    return () => {
      detachZoom();
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
  // A-4：常用时段变化 → 更新 FullCalendar 时段范围（设置页保存后实时生效）
  $effect(() => {
    const min = app.calendarSlotMin;
    const max = app.calendarSlotMax;
    if (!calendar) return;
    calendar.setOption("slotMinTime", toFcTime(min));
    calendar.setOption("slotMaxTime", toFcTime(max));
  });
  // A-5 / A-6：缩放档位 / 刻度规则 / 时段起点变化 → 重新接线（行高、刻度线、刻度文字随之更新，
  // 并通过新建函数引用强制 FC 整视图重渲染 → 事件按新格距重新贴合时间轴）
  $effect(() => {
    const pxPerHour = app.calendarPxPerHour;
    const slotMin = app.calendarSlotMin;
    const ticks = app.calendarTicks;
    if (!calendar) return;
    applyCalendarZoom(calendar, calEl, { pxPerHour, slotMin, ticks });
  });
  // A-8：日程列收起 / 展开后，宽度过渡一结束就强制 FC 重测列宽。
  // FC 只监听 window resize，容器自身变宽不会触发重排 → 必须借「新建函数引用」整视图重渲染
  // （applyCalendarZoom 内部走 setOption 新引用；updateSize() 不可靠、不会重测格子）。
  let dailyInit = false; // 首次挂载本来就由上面的 $effect 接线，跳过这一轮免得多余重渲染
  $effect(() => {
    void app.calendarDailyVisible;
    if (!dailyInit) {
      dailyInit = true;
      return;
    }
    const timer = setTimeout(() => {
      if (!calendar) return;
      applyCalendarZoom(calendar, calEl, {
        pxPerHour: app.calendarPxPerHour,
        slotMin: app.calendarSlotMin,
        ticks: app.calendarTicks,
      });
    }, 280);
    return () => clearTimeout(timer);
  });
</script>

<div class="card cal-card" bind:this={calEl}></div>
<p class="tip">
  提示：左键点击空白处新建事件；<b>右键日期格 / 事件 = 添加、编辑或删除菜单</b>；拖拽事件调整时间；<b>Ctrl + 滚轮 = 时间缩放（缩小可一屏看完一整天）</b>。
</p>

<CalendarMenus {ctxMenu} onclose={() => (ctxMenu = null)} />

<style>
  /* A-4 / A-5：时间轴贴合视口（flex:1 + 内部滚动）；表高由行高变量决定，
     缩到最粗档时整天压进一屏、卡片下方留白，放大档则内部滚动。
     min-height 兜底：不让时间轴被压没。 */
  .cal-card {
    flex: 1;
    min-height: 240px;
    overflow: auto;
    padding: var(--space-3);
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
