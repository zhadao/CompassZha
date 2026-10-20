/**
 * 全局 store（Svelte 5 runes）。「换数据源不换组件」的唯一接缝（SPEC-011）已兑现：
 * 阶段 1 起数据源 = Tauri fs + Markdown 文件（daily/yyyy/yyyy-mm-dd.md 与 life/<板块>/），
 * 组件层对此无感知，仍然只调用本 store 的方法。
 *
 * 写路径（检查点 1.4/1.5/1.6）：每个 UI 操作标记 dirty 章节 → 500ms debounce →
 * 章节级手术写回（lib/markdown.ts，未修改章节字节级保留）→ 本地 git 自动提交。
 * 浏览器环境（无 Tauri 运行时，persist=false）退化为纯内存态，便于 vite 预览。
 */

import type {
  ArchivedBoard,
  BoardFile,
  CalendarDraft,
  DailyMetrics,
  DailyNote,
  EventItem,
  FocusSession,
  LifeBoard,
  RecurRule,
  SectionId,
  TimerState,
  TrackerDef,
} from "../types/schema";
import { emptyMetrics, emptyMetricsExtra } from "../types/schema";
import { genId } from "../mock/preview";
import { addHours, fromDateKey, offsetDays, todayKey } from "../lib/date";
import {
  type ParsedDaily,
  type GoalStats,
  parseDaily,
  buildDailyFile,
  writeMetrics,
  writeTasks,
  writeNotes,
  writeReview,
  writeFocusLog,
  writeSchedules,
  writeFrontmatterKey,
  schedulesToEvents,
  hasGoalTag,
  stripGoalTag,
  renameGoalTag,
  parseGoalStats,
  buildGoalStats,
  parseRecurringRules,
  buildRecurringRules,
} from "../lib/markdown";
import { addMonthsKey, occurrencesBetween } from "../lib/recurrence";
import {
  persist,
  fsRead,
  fsWrite,
  fsListDir,
  fsMkdir,
  fsDelete,
  fsExists,
  fsRename,
  gitAutoCommit,
  dailyRel,
  boardDefaultRel,
  calendarGetConfig,
  calendarSetConfig,
  calendarSetPxPerHour,
  uiGetConfig,
  uiSetDetailSection,
  uiSetCalendarDaily,
  uiSetCalendarViewMode,
  metricsGetConfig,
  metricsSetPinned,
  trackersGetConfig,
  trackersSetConfig,
  dashboardGetConfig,
  dashboardSetConfig,
  briefingGetConfig,
  briefingSetConfig,
  briefingSetLastShown,
  type TrackerCfg,
  type DashboardCfg,
} from "../lib/tauri-fs";
import { buildBriefing, isBriefingDue, stamp, type BriefingResult } from "../lib/briefing";
import { pickFocus, focusClosing } from "../lib/pick-focus";
import { aiGetConfig, dataAnalyzeAsk } from "../lib/ai";
import {
  clampPxPerHour,
  DEFAULT_PX_PER_HOUR,
  DEFAULT_TICKS,
  type CalendarTicks,
} from "../lib/calendarZoom";
import {
  ALL_BUILTIN_TRACKERS,
  BUILTIN_TRACKERS,
  DEFAULT_LEVEL_MAX,
} from "../lib/trackers";
import {
  conversationRel,
  slugTitle,
  toConversationMd,
  type ChatBubble,
} from "../lib/chat-export";

/** D-6：封存盒目录（`_` 前缀不参与常规板块扫描）与封存标记键 */
const ARCHIVE_DIR = "life/_archived";
const ARCHIVED_KEY = "archived";
/** D-6：板块「停滞」判定阈值（天） */
const STALL_DAYS = 14;

/** 当前时刻 HH:mm（番茄钟开始时刻 / 提交信息用） */
function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 模块级句柄（store 单例生命周期 = 应用生命周期） */
let tickHandle: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** A-5：缩放档位写盘防抖句柄（± 按钮 / Ctrl+滚轮连点合并为一次写） */
let zoomSaveTimer: ReturnType<typeof setTimeout> | null = null;
/** E-2：简报到点检查定时器（页面级，60s 一次；应用常驻期间可靠） */
let briefingTimer: ReturnType<typeof setInterval> | null = null;

/** 每日文件可被 UI 修改的章节 */
type DailyAspect = "metrics" | "tasks" | "notes" | "review" | "focus" | "schedules";

const ASPECT_LABEL: Record<DailyAspect, string> = {
  metrics: "指标",
  tasks: "清单",
  notes: "记录",
  review: "收尾",
  focus: "专注",
  schedules: "日程",
};

/** A-3：支持详情栏的分区（今日 / 日历 / 仪表盘 / 人生板块；其余页面不显示详情栏，也不显示「详情 / 收起详情」按钮） */
const DETAIL_SECTIONS: readonly SectionId[] = ["today", "calendar", "life"];

/** D-1 / E-1（v4.41）：可折叠的指标字段（与 Rust METRIC_FIELDS 一致；缺省 8 项全部常显） */
const METRIC_FIELDS: readonly string[] = [
  "sleep_hours",
  "sleep_quality",
  "sleep_bedtime",
  "sleep_wake",
  "weight_kg",
  "spend_total",
  "mood",
  "steps",
];

/** HH:mm 合法性（允许 24:00 作为结束时刻） */
function validHHmm(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) || s === "24:00";
}

/** E-2：简报时刻归一（非法 → 20:00；不接受 24:00 这种日界写法） */
function briefTime(s: string): string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : "20:00";
}

/** E-2：周几归一（0–6，非法回落周日） */
function briefWeekday(n: number): number {
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0;
}

/** E-1：config.trackers 条目 → 追踪项（自定义项；内置项以代码常量表为准） */
function cfgToTrackerDef(c: TrackerCfg): TrackerDef {
  return {
    key: c.key,
    name: c.name,
    unit: c.unit,
    kind: c.kind,
    direction: c.direction,
    max: c.max,
    step: c.step,
    decimals: c.decimals,
    builtin: false,
    hidden: c.hidden,
  };
}

/** E-1：追踪项 → config.trackers 条目（缺省 level 上限补 5） */
function trackerDefToCfg(t: TrackerDef): TrackerCfg {
  return {
    key: t.key,
    name: t.name,
    unit: t.unit,
    kind: t.kind,
    direction: t.direction,
    max: t.kind === "level" ? (t.max ?? DEFAULT_LEVEL_MAX) : undefined,
    step: t.step,
    decimals: t.decimals,
    builtin: false,
    hidden: t.hidden,
  };
}

class AppState {
  /* ---- 布局状态 ---- */
  section = $state<SectionId>("today");
  sidebarCollapsed = $state(false);
  /** 窗口宽度（响应式三档：≥1280 / 800–1280 / <800，总需求 §2.9） */
  winWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1280);
  /** A-3：详情栏显隐按分区各自记忆（单一数据源，禁止各页面各存一份） */
  detailVisibleBySection = $state<Record<SectionId, boolean>>({
    today: true,
    calendar: true,
    dashboard: true,
    life: true,
    pomodoro: false,
    chat: false,
    settings: false,
  });
  /** A-4：日历时间轴常用时段（config.calendar 驱动；缺省 06:00–24:00） */
  calendarSlotMin = $state("06:00");
  calendarSlotMax = $state("24:00");
  /** A-5：日历缩放档位 = 1 小时占多少像素（config.calendar.px_per_hour；缺省 175） */
  calendarPxPerHour = $state(DEFAULT_PX_PER_HOUR);
  /** A-6：日历刻度规则（config.calendar.ticks；缺省每 1 小时一横线） */
  calendarTicks = $state<CalendarTicks>({ ...DEFAULT_TICKS, times: [] });
  /** A-7：日历左侧「日程预览列」显隐（config.ui.calendar_daily_visible；缺省显示） */
  calendarDailyVisible = $state(true);
  /** D-4b：日历视图模式（config.ui.calendar_view_mode；缺省时间轴） */
  calendarViewMode = $state<"timeline" | "todo">("timeline");
  /** D-1：指标表单「常显」字段（config.metrics.pinned；缺省 8 项全部常显） */
  metricPinned = $state<string[]>([...METRIC_FIELDS]);
  /** E-1：自定义追踪项（config.trackers 里 builtin=false 的条目） */
  customTrackers = $state<TrackerDef[]>([]);
  /** E-1：被隐藏的内置追踪项键（config.trackers 里 builtin=true 的条目） */
  hiddenBuiltins = $state<string[]>([]);
  /** D-5：仪表盘编排序（config.dashboard.order；空 = 前端出默认序） */
  dashboardOrder = $state<string[]>([]);
  /** D-5：仪表盘隐藏的卡片键（config.dashboard.hidden；数据保留，仅不呈现） */
  dashboardHidden = $state<string[]>([]);
  /** R-1b：仪表盘视图模式（config.dashboard.view_mode；缺省「数据」屏） */
  dashboardViewMode = $state<"data" | "heatmap">("data");
  /** R-1d：热力图屏的板块顺序（config.dashboard.heatmap_order；空 = 按 life 目录序） */
  dashboardHeatmapOrder = $state<string[]>([]);
  /** 当前编辑日（文件树 / 今日入口联动） */
  selectedDate = $state(todayKey());

  /* ---- 数据（阶段 1：启动 loadAll 从真实文件载入；浏览器预览为空态） ---- */
  dailyNotes = $state<Record<string, DailyNote>>({});
  /** 日历事件（v4.4 已接真：写回当日 ## 日程 章节） */
  events = $state<EventItem[]>([]);
  /** 循环事件规则（v4.21 §2.10：events/循环事件.md，规则驱动懒物化） */
  recurRules = $state<RecurRule[]>([]);

  /* ---- 人生板块（板块 = life/ 下子文件夹；v4.5：文件夹内含多 Markdown 文件） ---- */
  lifeBoards = $state<LifeBoard[]>([]);
  /** 座右铭（v4.20 §2.5）：life/座右铭.md，每行一条；life/ 根下散文件，板块扫描「仅子文件夹」自动跳过 */
  mottos = $state<string[]>([]);
  /** 板块投入历史存档（v4.9：life/goal-stats.md；仅改过名/删过的板块有记录） */
  goalStats = $state<GoalStats>({});
  /** 板块删除后的提示横幅（v4.9：告知历史数据保留位置；null = 不显示） */
  boardNotice = $state<string | null>(null);
  /** D-6：封存盒条目（life/_archived/ 下的板块目录；不参与常规网格渲染） */
  archivedBoards = $state<ArchivedBoard[]>([]);
  /** 当前打开（文件夹视图）的板块 id；null = 网格 / 空态 */
  openedLifeBoardId = $state<string | null>(null);
  /** 文件夹视图内当前打开的文件 id（右侧编辑器显示对象）；null = 未选 */
  openedBoardFileId = $state<string | null>(null);
  /** 右栏摘要联动：网格态选中的板块 */
  selectedLifeBoardId = $state<string | null>(null);

  /** 仪表盘趋势时间范围（近 7 / 30 / 90 天，右栏 radio 真切换；v4.1 时间线拉长） */
  trendRange = $state<7 | 30 | 90>(7);

  /* ---- 番茄钟（store 层全局计时，切分区继续走） ---- */
  timer = $state<TimerState>({
    mode: null,
    phase: "idle",
    targetMin: 25,
    elapsedSec: 0,
    startedHHmm: "",
    title: "",
  });
  focusSessions = $state<FocusSession[]>([]);

  /* ---- 日历选中事件 ---- */
  selectedEventId = $state<string | null>(null);

  /* ---- 日历编辑器草稿（新建 / 编辑共用） ---- */
  calendarDraft = $state<CalendarDraft | null>(null);

  /* ---- 编辑器模式（v4.4：GUI/编辑器双模式，仅今日分区） ---- */
  /** true = 今日分区主区切换为所见即所得 Markdown 编辑器（右栏按钮切换） */
  editorMode = $state(false);
  /** 编辑器正文缓冲（frontmatter 之外；进入模式时从磁盘现读，保存时与 fm 合并） */
  dailyRaw = $state("");

  /* ---- 日记收藏（v4.6）：状态由磁盘文件名 star- 前缀派生，Set 存日期键 yyyy-mm-dd ---- */
  starredDates = $state<Set<string>>(new Set());

  /* ---- E-2：每周罗盘简报（config.briefing；缺省关闭） ---- */
  /** 是否启用每周简报 */
  briefingEnabled = $state(false);
  /** 触发周几（0 = 周日 … 6 = 周六） */
  briefingWeekday = $state(0);
  /** 触发时刻 HH:mm */
  briefingTime = $state("20:00");
  /** 上次弹出时刻（ISO 本地戳；启动补发判定用） */
  briefingLastShown = $state<string | null>(null);
  /** 简报弹层是否打开 */
  briefingOpen = $state(false);
  /** 当前简报内容（打开时现算） */
  briefingData = $state<BriefingResult | null>(null);

  /* ---- E-3：首页「此刻最该动的一件事」提示（无候选时给结束语） ---- */
  focusPickNotice = $state<string | null>(null);

  /* ---- 落盘状态（非响应式内部记账） ---- */
  /** date → 待写回章节集合 */
  private dirtyDaily = new Map<string, Set<DailyAspect>>();
  /** 板块文件 rel 路径（life/<板块>/<文件>）→ 待写回（内容以内存态为准，v4.5 由 boardId 改为文件级） */
  private dirtyBoards = new Set<string>();
  /** 启动扫描完成标志（防止启动竞态期间误写空数据） */
  loaded = false;

  /* ---- 派生 ---- */

  /**
   * E-1：全部追踪项 = 内置（8 项可录 + 专注时长，含隐藏覆盖）+ 自定义项。
   * 今日表单 / 仪表盘卡片 / 趋势图统一由此派生，新增自定义指标全程零改代码。
   * 纯读，勿在此改 state。
   */
  get trackers(): TrackerDef[] {
    const hidden = this.hiddenBuiltins;
    const builtins = ALL_BUILTIN_TRACKERS.map((t) =>
      hidden.includes(t.key) ? { ...t, hidden: true } : t,
    );
    return [...builtins, ...this.customTrackers];
  }

  /** E-1：表单可录项（内置 8 项按 pinned 折叠；自定义项一律列出，hidden 除外）——纯读 */
  get formTrackers(): TrackerDef[] {
    return this.trackers.filter((t) =>
      t.builtin ? BUILTIN_TRACKERS.some((b) => b.key === t.key) : !t.hidden,
    );
  }

  /**
   * D-5：仪表盘有效编排序 = 已存 order（忽略失效键，如已删的自定义项）
   * ∪ 新出现的追踪项（追加末尾）。纯读，勿在此改 state。
   * R-1b：数据屏的指标卡与趋势曲线共用此序（热力图已独立成屏，伪键 `heatmaps` 退场）。
   */
  get effDashboardOrder(): string[] {
    const all = this.trackers.map((t) => t.key);
    const saved = this.dashboardOrder.filter((k) => all.includes(k));
    const rest = all.filter((k) => !saved.includes(k));
    return [...saved, ...rest];
  }

  get selectedEvent(): EventItem | null {
    return this.events.find((e) => e.id === this.selectedEventId) ?? null;
  }

  get note(): DailyNote {
    return this.peekNote(this.selectedDate);
  }

  /** A-3：当前分区是否支持详情栏（不支持则不渲染详情栏与切换按钮）——纯读，勿在此改 state */
  get detailSupported(): boolean {
    return DETAIL_SECTIONS.includes(this.section);
  }

  /** A-3：当前分区详情栏是否可见（按 section 读取记忆 + 宽屏阈值）——纯读，勿在此改 state */
  get detailVisible(): boolean {
    return (
      DETAIL_SECTIONS.includes(this.section) &&
      this.detailVisibleBySection[this.section] &&
      this.winWidth >= 1280
    );
  }

  /* ---- 数据装载（App onMount 调用一次） ---- */

  /** D-6：读单个板块目录（life/<名>/）为内存态 LifeBoard；同时被 loadAll 与重启复用 */
  private async readBoard(dirName: string): Promise<LifeBoard> {
    let icon = "svg:点子";
    const files: BoardFile[] = [];
    const entries = await fsListDir(`life/${dirName}`).catch(() => []);
    for (const e of entries) {
      if (e.is_dir || !e.name.toLowerCase().endsWith(".md")) continue;
      const text = await fsRead(`life/${dirName}/${e.name}`).catch(() => null);
      if (text === null) continue;
      // 图标约定：默认文件 <板块名>.md 的 frontmatter `icon:` 字段
      if (e.name === `${dirName}.md`) {
        const m = /^icon:[ \t]*(.+)$/m.exec(text);
        if (m) icon = m[1].trim();
      }
      files.push({ id: genId("file"), name: e.name, content: text });
    }
    files.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    return { id: genId("life"), name: dirName, icon, files };
  }

  /**
   * 扫描真实文件装载内存态：
   * 1) ensureToday：今天文件缺失则按 §3.2 模板创建（不覆盖已有）；
   * 2) daily/：全量扫描各年份目录（保证旧文件在编辑时不会因未装载而丢内容；
   *    近 90 天窗口只影响仪表盘默认展示，阶段 3 SQLite 索引接手查询）；
   * 3) life/：一级子文件夹 = 板块，默认文档 frontmatter 的 icon 为图标。
   */
  async loadAll(): Promise<void> {
    if (!persist) return; // 浏览器预览：内存态兜底
    try {
      const today = todayKey();
      // v4.6：今天若已收藏（star- 前缀）不重复建未收藏文件
      const plainRel = dailyRel(today);
      const starRel = `daily/${today.slice(0, 4)}/star-${today}.md`;
      if (
        !(await fsExists(plainRel).catch(() => false)) &&
        !(await fsExists(starRel).catch(() => false))
      ) {
        await fsWrite(plainRel, buildDailyFile(today));
      }

      const notes: Record<string, DailyNote> = {};
      const sessions: FocusSession[] = [];
      const events: EventItem[] = [];
      const starred = new Set<string>();
      const years = (await fsListDir("daily").catch(() => [])).filter((e) => e.is_dir);
      for (const y of years) {
        const files = await fsListDir(`daily/${y.name}`).catch(() => []);
        for (const f of files) {
          // v4.6：收藏日记文件名带 star- 前缀（star-yyyy-mm-dd.md）
          if (f.is_dir || !/^(star-)?\d{4}-\d{2}-\d{2}\.md$/.test(f.name)) continue;
          const date = f.name.replace(/^star-/, "").slice(0, 10);
          if (f.name.startsWith("star-")) starred.add(date);
          const text = await fsRead(`daily/${y.name}/${f.name}`).catch(() => null);
          if (!text) continue;
          const p = parseDaily(text, date);
          notes[date] = { date, tasks: p.tasks, notes: p.notes, review: p.review, metrics: p.metrics, metricsExtra: p.metricsExtra };
          sessions.push(...p.focusLog);
          events.push(...schedulesToEvents(p.schedules, date));
        }
      }
      this.dailyNotes = notes;
      this.starredDates = starred;
      this.focusSessions = sessions;
      this.events = events;

      const boards: LifeBoard[] = [];
      const dirs = await fsListDir("life").catch(() => []);
      for (const d of dirs) {
        // D-6：跳过 `_` 前缀目录（life/_archived 等内部目录不参与常规板块扫描）
        if (!d.is_dir || d.name.startsWith("_")) continue;
        boards.push(await this.readBoard(d.name));
      }
      this.lifeBoards = boards;
      // D-6：封存盒（life/_archived/<名>/；archived 标记取自默认文档 frontmatter）
      const archived: ArchivedBoard[] = [];
      const archDirs = await fsListDir(ARCHIVE_DIR).catch(() => []);
      for (const d of archDirs) {
        if (!d.is_dir || d.name.startsWith("_")) continue;
        const text = await fsRead(`${ARCHIVE_DIR}/${d.name}/${d.name}.md`).catch(() => null);
        const m = text ? /^archived:[ \t]*(.+)$/m.exec(text) : null;
        const raw = m ? m[1].trim() : "";
        archived.push({ name: d.name, archivedAt: raw && raw !== "null" ? raw : null });
      }
      this.archivedBoards = archived;
      // v4.9：板块投入历史存档（文件缺失 = 尚无板块改名/删除过，空表起步）
      const statsText = await fsRead("life/goal-stats.md").catch(() => null);
      this.goalStats = statsText ? parseGoalStats(statsText) : {};
      // v4.20：座右铭（life/座右铭.md 每行一条；缺文件 = 空态起步）
      const mottoText = await fsRead("life/座右铭.md").catch(() => null);
      this.mottos = mottoText
        ? mottoText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
        : [];
      // v4.21：循环事件规则库（events/循环事件.md；缺文件 = 无规则）→ 懒物化窗口内实例
      const ruleText = await fsRead("events/循环事件.md").catch(() => null);
      this.recurRules = ruleText ? parseRecurringRules(ruleText) : [];
      this.materializeRecurrences();
      // A-3 / A-4：界面偏好（config.json ui / calendar；缺键用默认值兜底）
      await this.loadPrefs();
      this.loaded = true;
      // E-2：起页面级定时器（驻留期间每 60s 比对一次）+ 启动补发
      this.startBriefingWatch();
    } catch (err) {
      console.error("[loadAll] 数据装载失败", err);
      this.loaded = true; // 失败也要放开写入（避免永久空转）
      this.startBriefingWatch();
    }
  }

  /**
   * 装载界面偏好（A-3 详情栏按分区记忆 / A-4 日历常用时段）。
   * 读取失败保持默认值，不影响主流程（老 config 缺键由 Rust serde 默认值兜底）。
   */
  private async loadPrefs(): Promise<void> {
    try {
      const ui = await uiGetConfig();
      const merged: Record<SectionId, boolean> = { ...this.detailVisibleBySection };
      for (const s of DETAIL_SECTIONS) {
        const v = ui.detail_by_section?.[s];
        if (typeof v === "boolean") merged[s] = v;
      }
      this.detailVisibleBySection = merged;
      if (typeof ui.calendar_daily_visible === "boolean") {
        this.calendarDailyVisible = ui.calendar_daily_visible;
      }
      if (ui.calendar_view_mode === "todo") this.calendarViewMode = "todo";
      else if (ui.calendar_view_mode === "timeline") this.calendarViewMode = "timeline";
    } catch (err) {
      console.error("[loadPrefs] 读取界面偏好失败（用默认值）", err);
    }
    try {
      const cal = await calendarGetConfig();
      this.calendarSlotMin = cal.slot_min;
      this.calendarSlotMax = cal.slot_max;
      this.calendarPxPerHour = clampPxPerHour(cal.px_per_hour);
      this.calendarTicks = {
        everyHours: cal.ticks.every_hours,
        times: [...cal.ticks.times],
      };
    } catch (err) {
      console.error("[loadPrefs] 读取日历偏好失败（用默认值）", err);
    }
    try {
      const mc = await metricsGetConfig();
      this.metricPinned = METRIC_FIELDS.filter((k) => mc.pinned.includes(k));
    } catch (err) {
      console.error("[loadPrefs] 读取指标常显偏好失败（用默认值）", err);
    }
    try {
      const tc = await trackersGetConfig();
      this.customTrackers = tc.trackers.filter((t) => !t.builtin).map(cfgToTrackerDef);
      this.hiddenBuiltins = tc.trackers
        .filter((t) => t.builtin && t.hidden)
        .map((t) => t.key);
    } catch (err) {
      console.error("[loadPrefs] 读取数据追踪项失败（用默认值）", err);
    }
    try {
      const dc = await dashboardGetConfig();
      this.dashboardOrder = [...dc.order];
      this.dashboardHidden = [...dc.hidden];
      this.dashboardViewMode = dc.view_mode === "heatmap" ? "heatmap" : "data";
      this.dashboardHeatmapOrder = [...dc.heatmap_order];
    } catch (err) {
      console.error("[loadPrefs] 读取仪表盘编排失败（用默认值）", err);
    }
    try {
      const bc = await briefingGetConfig();
      this.briefingEnabled = bc.enabled;
      this.briefingWeekday = bc.weekday;
      this.briefingTime = briefTime(bc.time);
      this.briefingLastShown = bc.last_shown;
    } catch (err) {
      console.error("[loadPrefs] 读取每周简报设置失败（用默认值）", err);
    }
  }

  /** A-3：写入当前分区详情栏显隐记忆（非支持分区忽略） */
  toggleDetail(): void {
    const s = this.section;
    if (!DETAIL_SECTIONS.includes(s)) return;
    const next = !this.detailVisibleBySection[s];
    this.detailVisibleBySection[s] = next;
    void this.saveDetailSection(s, next);
  }

  /** A-3：持久化某分区详情栏记忆（失败仅日志，不阻断交互） */
  private async saveDetailSection(section: SectionId, visible: boolean): Promise<void> {
    if (!persist) return;
    try {
      await uiSetDetailSection(section, visible);
    } catch (err) {
      console.error("[saveDetailSection] 保存详情栏记忆失败", err);
    }
  }

  /** A-4 / A-5 / A-6：保存日历偏好（时段 + 缩放档位 + 刻度规则；成功后更新内存态） */
  async setCalendarSlots(
    min: string,
    max: string,
    pxPerHour: number,
    ticks: CalendarTicks,
  ): Promise<void> {
    const m = min.trim();
    const x = max.trim();
    if (!validHHmm(m) || !validHHmm(x) || m >= x) {
      throw new Error("时段不合法：请填 HH:mm（如 06:00 / 24:00），且结束时间晚于开始时间");
    }
    const ph = clampPxPerHour(pxPerHour);
    const tk: CalendarTicks = { everyHours: ticks.everyHours, times: [...ticks.times] };
    await calendarSetConfig(m, x, ph, { every_hours: tk.everyHours, times: tk.times });
    this.calendarSlotMin = m;
    this.calendarSlotMax = x;
    this.calendarPxPerHour = ph;
    this.calendarTicks = tk;
  }

  /** A-5：更新缩放档位（夹到最近档位 → 立即改内存态 → 400ms 防抖写盘） */
  setCalendarPxPerHour(n: number): void {
    const ph = clampPxPerHour(n);
    if (ph === this.calendarPxPerHour) return;
    this.calendarPxPerHour = ph;
    if (!persist) return;
    if (zoomSaveTimer !== null) clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(() => {
      zoomSaveTimer = null;
      calendarSetPxPerHour(ph).catch((err) =>
        console.error("[setCalendarPxPerHour] 保存缩放档位失败", err),
      );
    }, 400);
  }

  /** A-7：翻转日历「日程预览列」显隐并持久化（浏览器预览仅改内存态） */
  toggleCalendarDaily(): void {
    const next = !this.calendarDailyVisible;
    this.calendarDailyVisible = next;
    if (!persist) return;
    uiSetCalendarDaily(next).catch((err) =>
      console.error("[toggleCalendarDaily] 保存日程列记忆失败", err),
    );
  }

  /** D-4b：切换日历视图模式（时间轴 / 待办卡片）并持久化 */
  setCalendarViewMode(mode: "timeline" | "todo"): void {
    this.calendarViewMode = mode;
    if (!persist) return;
    uiSetCalendarViewMode(mode).catch((err) =>
      console.error("[setCalendarViewMode] 保存日历视图模式失败", err),
    );
  }

  /**
   * D-1：更新指标「常显」字段（立即改内存态 → 写盘；失败仅日志，不阻断勾选）。
   * 入参会按 METRIC_FIELDS 顺序归一化；空数组合法（= 全部收进「更多指标」）。
   */
  setMetricPinned(keys: string[]): void {
    const next = METRIC_FIELDS.filter((k) => keys.includes(k));
    this.metricPinned = next;
    if (!persist) return;
    metricsSetPinned(next).catch((err) =>
      console.error("[setMetricPinned] 保存常显设置失败", err),
    );
  }

  /* ---- D-5：仪表盘编排（顺序 / 显隐 / R-1b 视图模式 / R-1d 热力图顺序；立即改内存态 → 写盘） ---- */

  /** D-5：写入卡片顺序（R-1b：数据屏的指标卡与趋势曲线共用此序） */
  setDashboardOrder(order: string[]): void {
    this.dashboardOrder = [...order];
    void this.saveDashboard();
  }

  /** D-5：写入隐藏卡片键集合（数据保留，仅不呈现） */
  setDashboardHidden(hidden: string[]): void {
    this.dashboardHidden = [...hidden];
    void this.saveDashboard();
  }

  /** R-1b：切换仪表盘视图（数据屏 / 热力图屏） */
  setDashboardViewMode(mode: "data" | "heatmap"): void {
    this.dashboardViewMode = mode;
    void this.saveDashboard();
  }

  /** R-1d：写入热力图屏的板块顺序（板块 id 列表；空 = 按 life 目录序） */
  setDashboardHeatmapOrder(ids: string[]): void {
    this.dashboardHeatmapOrder = [...ids];
    void this.saveDashboard();
  }

  /** R-1d：拖动排序——把 `from` 落到 `to` 处（往下拖 = 插到其后，往上拖 = 插到其前） */
  moveDashboardKey(from: string, to: string): void {
    const list = [...this.effDashboardOrder];
    const i = list.indexOf(from);
    const j = list.indexOf(to);
    if (i < 0 || j < 0 || i === j) return;
    list.splice(i, 1);
    // 移除后目标的新下标：i<j → j-1（插到其后即原 j 处）；i>j → j（插到其前）
    list.splice(j, 0, from);
    this.setDashboardOrder(list);
  }

  /** D-5：恢复默认编排（清空顺序 / 显隐 / 热力图顺序；视图模式属浏览偏好，不重置） */
  resetDashboard(): void {
    this.dashboardOrder = [];
    this.dashboardHidden = [];
    this.dashboardHeatmapOrder = [];
    void this.saveDashboard();
  }

  /** D-5：持久化仪表盘编排（失败仅日志，不阻断交互） */
  private async saveDashboard(): Promise<void> {
    if (!persist) return;
    try {
      const cfg: DashboardCfg = {
        order: this.dashboardOrder,
        hidden: this.dashboardHidden,
        view_mode: this.dashboardViewMode,
        heatmap_order: this.dashboardHeatmapOrder,
      };
      await dashboardSetConfig(cfg);
    } catch (err) {
      console.error("[saveDashboard] 保存仪表盘编排失败", err);
    }
  }

  /* ---- E-1：数据追踪项增删改（自定义项 + 内置项隐藏覆盖） ---- */

  /** 新建自定义追踪项；键已被占用时返回错误文案（不落盘） */
  addTracker(def: TrackerDef): string | null {
    if (this.trackers.some((t) => t.key === def.key)) return "该英文键名已被占用";
    this.customTrackers = [...this.customTrackers, { ...def, builtin: false }];
    void this.saveTrackers();
    return null;
  }

  /** 更新自定义追踪项（改名 / 单位 / 类型 / 方向） */
  updateTracker(key: string, patch: Partial<TrackerDef>): void {
    this.customTrackers = this.customTrackers.map((t) =>
      t.key === key ? { ...t, ...patch, key: t.key, builtin: false } : t,
    );
    void this.saveTrackers();
  }

  /**
   * 删除自定义追踪项：仅从追踪表移除，**不删日记文件里的历史数据**
   * （`x_` 键在既有文件中原样保留，重新新建同名键即恢复图表）。
   */
  removeTracker(key: string): void {
    this.customTrackers = this.customTrackers.filter((t) => t.key !== key);
    void this.saveTrackers();
  }

  /** 隐藏 / 显示某追踪项（内置项落 hiddenBuiltins，自定义项改 def.hidden） */
  setTrackerHidden(key: string, hidden: boolean): void {
    if (ALL_BUILTIN_TRACKERS.some((t) => t.key === key)) {
      this.hiddenBuiltins = hidden
        ? [...new Set([...this.hiddenBuiltins, key])]
        : this.hiddenBuiltins.filter((k) => k !== key);
    } else {
      this.updateTracker(key, { hidden });
      return;
    }
    void this.saveTrackers();
  }

  private async saveTrackers(): Promise<void> {
    if (!persist) return;
    try {
      const list: TrackerCfg[] = [
        ...this.hiddenBuiltins.map((key) => ({
          key,
          name: "",
          unit: "",
          kind: "number" as const,
          direction: "up" as const,
          builtin: true,
          hidden: true,
        })),
        ...this.customTrackers.map(trackerDefToCfg),
      ];
      await trackersSetConfig(list);
    } catch (err) {
      console.error("[saveTrackers] 写入数据追踪项失败", err);
    }
  }

  /* ---- 落盘通道：dirty → debounce → 章节级写回 + git 提交 ---- */

  /** 标记某日某章节待写回（合并 500ms 内的多次操作） */
  private markDirty(date: string, aspect: DailyAspect): void {
    if (!persist) return;
    let set = this.dirtyDaily.get(date);
    if (!set) {
      set = new Set();
      this.dirtyDaily.set(date, set);
    }
    set.add(aspect);
    this.scheduleFlush();
  }

  private markBoardDirty(boardId: string): void {
    if (!persist) return;
    this.dirtyBoards.add(boardId);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (flushTimer === null) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void app.flush();
      }, 500);
    }
  }

  /** 批量写回：只重写 dirty 章节（base = 磁盘现文；文件不存在则按模板新建） */
  private async flush(): Promise<void> {
    if (!persist) return;
    const daily = this.dirtyDaily;
    const boards = this.dirtyBoards;
    this.dirtyDaily = new Map();
    this.dirtyBoards = new Set();
    if (daily.size === 0 && boards.size === 0) return;
    const actions: string[] = [];
    try {
      for (const [date, aspects] of daily) {
        const note = this.getNote(date);
        const rel = this.dailyPath(date);
        let text: string | null = await fsRead(rel).catch(() => null);
        if (text === null) text = buildDailyFile(date, note.metrics, note.metricsExtra);
        if (aspects.has("tasks")) text = writeTasks(text, note.tasks);
        if (aspects.has("notes")) text = writeNotes(text, note.notes);
        if (aspects.has("review")) text = writeReview(text, note.review);
        if (aspects.has("focus")) {
          text = writeFocusLog(
            text,
            this.focusSessions.filter((s) => s.date === date),
          );
        }
        if (aspects.has("schedules")) {
          text = writeSchedules(text, date, this.events);
        }
        if (aspects.has("metrics")) text = writeMetrics(text, note.metrics, note.metricsExtra, date);
        await fsWrite(rel, text);
        actions.push(`${date}（${[...aspects].map((a) => ASPECT_LABEL[a]).join("、")}）`);
      }
      for (const rel of boards) {
        // rel = life/<板块名>/<文件名>：定位板块与文件，内容以内存态为准
        const parts = rel.split("/");
        if (parts.length !== 3) continue;
        const b = this.lifeBoards.find((x) => x.name === parts[1]);
        const f = b?.files.find((x) => x.name === parts[2]);
        if (!b || !f) continue;
        await fsWrite(rel, f.content);
        actions.push(`人生板块 ${b.name}/${f.name}`);
      }
      if (actions.length > 0) {
        await gitAutoCommit(`数据更新：${actions.join("；")} · ${nowHHmm()}`);
      }
    } catch (err) {
      console.error("[flush] 写盘失败", err);
    }
  }

  /* ---- 日记（每日一条） ---- */

  /** 纯读（渲染路径安全）：缺则返回临时空 note，不写 state——避免 Svelte 5 state_unsafe_mutation */
  peekNote(date: string): DailyNote {
    return (
      this.dailyNotes[date] ?? {
        date,
        tasks: [],
        notes: "",
        review: "",
        metrics: emptyMetrics(),
        metricsExtra: emptyMetricsExtra(),
      }
    );
  }

  /** 惰性创建（仅事件 / 异步路径调用：用户操作时才落容器） */
  getNote(date: string): DailyNote {
    if (!this.dailyNotes[date]) {
      this.dailyNotes[date] = {
        date,
        tasks: [],
        notes: "",
        review: "",
        metrics: emptyMetrics(),
        metricsExtra: emptyMetricsExtra(),
      };
    }
    return this.dailyNotes[date];
  }

  /* ---- 今日清单操作 ---- */
  addTask(date: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.getNote(date).tasks.push({ id: genId("task"), text: trimmed, done: false });
    this.markDirty(date, "tasks");
  }

  toggleTask(date: string, taskId: string): void {
    const t = this.getNote(date).tasks.find((x) => x.id === taskId);
    if (t) t.done = !t.done;
    this.markDirty(date, "tasks");
  }

  removeTask(date: string, taskId: string): void {
    const n = this.getNote(date);
    n.tasks = n.tasks.filter((x) => x.id !== taskId);
    this.markDirty(date, "tasks");
  }

  editTask(date: string, taskId: string, text: string): void {
    const t = this.getNote(date).tasks.find((x) => x.id === taskId);
    if (t && text.trim()) t.text = text.trim();
    this.markDirty(date, "tasks");
  }

  /** 顺延到明天（lifeos 晚间闭环） */
  deferTask(date: string, taskId: string): void {
    const n = this.getNote(date);
    const t = n.tasks.find((x) => x.id === taskId);
    if (!t) return;
    n.tasks = n.tasks.filter((x) => x.id !== taskId);
    const tomorrow = offsetDays(date, 1);
    this.getNote(tomorrow).tasks.push({
      id: genId("task"),
      text: t.text,
      done: false,
      deferredFrom: date,
    });
    this.markDirty(date, "tasks");
    this.markDirty(tomorrow, "tasks");
  }

  /** D-4b：清除某日某章节的「待写回」标记（立即写盘后调用，避免 debounce 到期重复写） */
  private clearDirty(date: string, aspect: DailyAspect): void {
    const set = this.dirtyDaily.get(date);
    if (!set) return;
    set.delete(aspect);
    if (set.size === 0) this.dirtyDaily.delete(date);
  }

  /** D-4b：立即写回某日「任务清单」章节（不参与 debounce；跨天搬任务需两侧即时一致） */
  private async writeTasksOnly(date: string): Promise<void> {
    const note = this.getNote(date);
    const rel = this.dailyPath(date);
    let text: string | null = await fsRead(rel).catch(() => null);
    if (text === null) text = buildDailyFile(date, note.metrics, note.metricsExtra);
    text = writeTasks(text, note.tasks);
    await fsWrite(rel, text);
  }

  /**
   * D-4b：把某任务从 fromDate 搬到 toDate（跨天改期）。
   * 内存先行 + 立即双写（不走 debounce，保证两侧磁盘一致）；写盘失败则内存回滚并返回错误文案。
   * 返回 null = 成功；返回字符串 = 失败原因（由视图内联展示）。
   */
  async moveTask(fromDate: string, taskId: string, toDate: string): Promise<string | null> {
    if (fromDate === toDate) return null;
    const src = this.getNote(fromDate);
    const moved = src.tasks.find((x) => x.id === taskId);
    if (!moved) return "任务不存在（可能已被删除）";
    const hadDst = !!this.dailyNotes[toDate];
    const snapshotFrom = [...src.tasks];
    const dst = this.getNote(toDate);
    const snapshotTo = [...dst.tasks];
    // 内存先行：源删除、目标追加（保留完成态；deferredFrom 记为来源日）
    src.tasks = src.tasks.filter((x) => x.id !== taskId);
    dst.tasks.push({
      id: genId("task"),
      text: moved.text,
      done: moved.done,
      deferredFrom: fromDate,
    });
    this.clearDirty(fromDate, "tasks");
    this.clearDirty(toDate, "tasks");
    if (!persist) return null;
    try {
      await this.writeTasksOnly(fromDate);
      await this.writeTasksOnly(toDate);
      await gitAutoCommit(`任务改期：${fromDate} → ${toDate} · ${nowHHmm()}`);
      return null;
    } catch (err) {
      console.error("[moveTask] 写盘失败，已回滚内存", err);
      src.tasks = snapshotFrom;
      if (hadDst) dst.tasks = snapshotTo;
      else delete this.dailyNotes[toDate];
      // 尽力把源文件写回原状（可能已写入一半）
      try {
        await this.writeTasksOnly(fromDate);
      } catch {
        /* 回滚写盘失败仅日志（内存已恢复） */
      }
      return "改期失败：数据写入出错，已恢复原状态";
    }
  }

  /** 任务右键关联/取消关联板块（v4.9 GUI）：勾选 = 追加 `#goal/<板块名>`，取消 = 移除标签 */
  toggleTaskGoal(date: string, taskId: string, boardName: string, linked: boolean): void {
    const t = this.getNote(date).tasks.find((x) => x.id === taskId);
    if (!t) return;
    const has = hasGoalTag(t.text, boardName);
    if (has === linked) return; // 无变化（并发点击防重复追加）
    t.text = linked ? `${t.text} #goal/${boardName}`.trim() : stripGoalTag(t.text, boardName);
    this.markDirty(date, "tasks");
  }

  /** 临时记录 / 今日收尾 */
  setNotes(date: string, notes: string): void {
    this.getNote(date).notes = notes;
    this.markDirty(date, "notes");
  }
  setReview(date: string, review: string): void {
    this.getNote(date).review = review;
    this.markDirty(date, "review");
  }

  /* ---- 量化指标 ---- */

  /**
   * 写入量化指标（内置 9 键走 patch；E-1 自定义指标走 extraPatch，键为 `x_<slug>`）。
   * 语义：`null` 清除该项；`undefined`（键缺省）不动该项。
   */
  setMetrics(
    date: string,
    patch: Partial<DailyMetrics>,
    extraPatch?: Record<string, number | string | null>,
  ): void {
    const n = this.getNote(date);
    n.metrics = { ...n.metrics, ...patch };
    if (extraPatch) {
      const next: Record<string, number | string | null> = { ...n.metricsExtra };
      for (const [k, v] of Object.entries(extraPatch)) {
        if (v === null || v === undefined) delete next[k];
        else next[k] = v;
      }
      n.metricsExtra = next;
    }
    this.markDirty(date, "metrics");
  }

  /* ---- 日历事件（v4.4 落盘：写回当日 ## 日程 章节） ---- */
  addEvent(e: Omit<EventItem, "id">): EventItem {
    const item: EventItem = { ...e, id: genId("evt") };
    this.events.push(item);
    this.selectedEventId = item.id;
    this.markDirty(item.date, "schedules");
    return item;
  }

  updateEvent(id: string, patch: Partial<EventItem>): void {
    const e = this.events.find((x) => x.id === id);
    if (!e) return;
    const oldDate = e.date;
    Object.assign(e, patch);
    this.markDirty(oldDate, "schedules");
    if (patch.date && patch.date !== oldDate) this.markDirty(patch.date, "schedules");
  }

  removeEvent(id: string): void {
    const target = this.events.find((x) => x.id === id);
    this.events = this.events.filter((x) => x.id !== id);
    if (this.selectedEventId === id) this.selectedEventId = null;
    if (target) this.markDirty(target.date, "schedules");
  }

  /** 今日任务排程：以任务标题在指定日期创建事件（lifeos「关键任务上日历」） */
  scheduleTask(date: string, taskId: string): void {
    const t = this.getNote(date).tasks.find((x) => x.id === taskId);
    if (!t) return;
    this.addEvent({
      title: t.text.replace(/#goal\/\S+/g, "").trim() || t.text,
      date,
      start: null,
      end: null,
      source: "scheduled",
      relatedTaskId: t.id,
    });
  }

  selectEvent(id: string | null): void {
    this.selectedEventId = id;
  }

  /* ---- 日历编辑器草稿操作 ---- */

  /** 点击日历空白处 / 右键「添加事件」「添加循环事件」：打开新建草稿 */
  openCreateDraft(date: string, allDay: boolean, startHHmm = "09:00", repeat = false): void {
    this.calendarDraft = {
      mode: "create",
      title: "",
      date,
      allDay,
      start: allDay ? "" : startHHmm,
      end: allDay ? "" : addHours(startHHmm, 1),
      repeat: repeat
        ? { freq: "weekly", interval: 1, weekdays: [fromDateKey(date).getDay()], endDate: null }
        : null,
    };
    this.selectedEventId = null;
  }

  /** 点击已有事件：打开编辑草稿（循环实例 → 载入其规则，「重复」区默认开启） */
  openEditDraft(id: string): void {
    const e = this.events.find((x) => x.id === id);
    if (!e) return;
    this.selectedEventId = id;
    const rule = e.ruleId ? this.recurRules.find((r) => r.id === e.ruleId) : undefined;
    this.calendarDraft = {
      mode: "edit",
      id,
      title: e.title,
      date: rule ? rule.start_date : e.date,
      allDay: e.start === null,
      start: e.start ?? "",
      end: e.end ?? "",
      repeat: rule
        ? {
            ruleId: rule.id,
            freq: rule.freq,
            interval: rule.interval,
            weekdays: [...rule.weekdays],
            endDate: rule.end_date,
          }
        : null,
    };
  }

  /** 循环事件管理弹窗「编辑」：按规则 id 打开编辑草稿（复用事件编辑器「重复」区） */
  openEditRuleDraft(ruleId: string): void {
    const r = this.recurRules.find((x) => x.id === ruleId);
    if (!r) return;
    this.selectedEventId = null;
    this.calendarDraft = {
      mode: "edit",
      title: r.title,
      date: r.start_date,
      allDay: r.start === null,
      start: r.start ?? "",
      end: r.end ?? "",
      repeat: {
        ruleId: r.id,
        freq: r.freq,
        interval: r.interval,
        weekdays: [...r.weekdays],
        endDate: r.end_date,
      },
    };
  }

  closeDraft(): void {
    this.calendarDraft = null;
  }

  saveDraft(): void {
    const d = this.calendarDraft;
    if (!d || !d.title.trim()) return;
    const title = d.title.trim();
    // 重复区开启 → 保存「规则」（并按懒物化补齐窗口内实例），不落单次事件
    if (d.repeat) {
      const prev = d.repeat.ruleId ? this.recurRules.find((r) => r.id === d.repeat?.ruleId) : undefined;
      this.upsertRecurRule({
        id: d.repeat.ruleId ?? genId("r"),
        title,
        freq: d.repeat.freq,
        interval: Math.max(1, Math.floor(d.repeat.interval || 1)),
        weekdays: d.repeat.freq === "weekly" ? [...d.repeat.weekdays].sort((a, b) => a - b) : [],
        start_date: d.date,
        end_date: d.repeat.endDate,
        start: d.allDay ? null : d.start,
        end: d.allDay ? null : d.end,
        except: prev ? [...prev.except] : [],
        materialized: [],
      });
      this.calendarDraft = null;
      return;
    }
    const item = {
      title,
      date: d.date,
      start: d.allDay ? null : d.start,
      end: d.allDay ? null : d.end,
    };
    if (d.mode === "create") {
      this.addEvent({ ...item, source: "manual" });
    } else if (d.id) {
      const existing = this.events.find((e) => e.id === d.id);
      // 原本是循环实例、用户关掉了「重复」→ 删除该规则，实例全部转为普通单次事件
      if (existing?.ruleId) this.removeRecurRule(existing.ruleId, false);
      this.updateEvent(d.id, item);
    }
    this.calendarDraft = null;
  }

  deleteSelected(): void {
    const d = this.calendarDraft;
    // 编辑器「删除」作用在规则上时 → 删除整条循环（含已生成实例）
    if (d?.repeat?.ruleId) {
      this.removeRecurRule(d.repeat.ruleId, true);
      this.calendarDraft = null;
      return;
    }
    if (this.selectedEventId) this.removeEvent(this.selectedEventId);
    this.calendarDraft = null;
  }

  /* ---- 循环事件（v4.21 §2.10：规则驱动懒物化，不污染远期磁盘） ---- */

  /** 规则库落盘 + 本地提交（规则增删改后调用） */
  private async saveRecurRulesFile(msg: string): Promise<void> {
    if (!persist) return;
    try {
      await fsWrite("events/循环事件.md", buildRecurringRules(this.recurRules));
      await gitAutoCommit(msg);
    } catch (err) {
      console.error("[saveRecurRules] 落盘失败", err);
    }
  }

  /**
   * 懒物化：窗口 = [今天, 今天 + 3 个月]。只生成窗口内、不在 except、尚无同名实例的日期；
   * 同步清理窗口内已不属于新规则的旧实例（规则改动 / 窗口向前滚动）。远期日期不创建任何文件。
   */
  materializeRecurrences(): void {
    const today = todayKey();
    const winEnd = addMonthsKey(today, 3);
    let changed = false;
    for (const rule of this.recurRules) {
      const occ = occurrencesBetween(rule, today, winEnd);
      const occSet = new Set(occ);
      // 1) 清理不再属于本规则窗口的已生成实例
      for (const e of [...this.events]) {
        if (e.ruleId !== rule.id || e.date < today || occSet.has(e.date)) continue;
        this.events = this.events.filter((x) => x.id !== e.id);
        if (this.selectedEventId === e.id) this.selectedEventId = null;
        this.markDirty(e.date, "schedules");
        changed = true;
      }
      // 2) 同步窗口内实例：已有 → 跟随规则更新标题/时间；缺失 → 补齐（跳过 except / 同名手工事件）
      for (const date of occ) {
        if (rule.except.includes(date)) continue;
        const existing = this.events.find((e) => e.date === date && e.ruleId === rule.id);
        if (existing) {
          if (existing.title !== rule.title || existing.start !== rule.start || existing.end !== rule.end) {
            existing.title = rule.title;
            existing.start = rule.start;
            existing.end = rule.end;
            this.markDirty(date, "schedules");
            changed = true;
          }
          continue;
        }
        if (this.events.some((e) => e.date === date && e.title === rule.title)) continue;
        this.events.push({
          id: genId("evt"),
          title: rule.title,
          date,
          start: rule.start,
          end: rule.end,
          source: "manual",
          ruleId: rule.id,
        });
        this.markDirty(date, "schedules");
        changed = true;
      }
      rule.materialized = [...occ].sort();
    }
    if (changed) this.events = [...this.events]; // 整体重赋触发日历事件源重建
  }

  /** 新建 / 更新一条规则（编辑器「重复」区保存、管理弹窗编辑），并立即物化 + 落盘 */
  upsertRecurRule(rule: RecurRule): void {
    const i = this.recurRules.findIndex((r) => r.id === rule.id);
    if (i >= 0) this.recurRules[i] = rule;
    else this.recurRules.push(rule);
    this.materializeRecurrences();
    void this.saveRecurRulesFile(`更新循环事件规则：${rule.title} · ${nowHHmm()}`);
  }

  /**
   * 删除规则。deleteInstances=true → 已生成实例一并删除；
   * false → 实例保留并转为普通单次事件（剥离 ruleId，下次落盘即去掉机器后缀）。
   */
  removeRecurRule(id: string, deleteInstances: boolean): void {
    const rule = this.recurRules.find((r) => r.id === id);
    this.recurRules = this.recurRules.filter((r) => r.id !== id);
    const kept: EventItem[] = [];
    const affected = new Set<string>();
    for (const e of this.events) {
      if (e.ruleId !== id) {
        kept.push(e);
        continue;
      }
      affected.add(e.date);
      if (deleteInstances) {
        if (this.selectedEventId === e.id) this.selectedEventId = null;
      } else {
        const copy: EventItem = { ...e };
        delete copy.ruleId;
        kept.push(copy);
      }
    }
    this.events = kept;
    for (const d of affected) this.markDirty(d, "schedules");
    if (this.calendarDraft?.repeat?.ruleId === id) this.calendarDraft = null;
    void this.saveRecurRulesFile(
      `${deleteInstances ? "删除循环事件规则及已生成实例" : "删除循环事件规则（保留已生成实例）"}：${rule?.title ?? id} · ${nowHHmm()}`,
    );
  }

  /** 右键循环实例「删除本次」：删除该日实例并记入 except（重生成时跳过） */
  removeOccurrence(ruleId: string, date: string): void {
    const target = this.events.find((e) => e.ruleId === ruleId && e.date === date);
    if (target) this.removeEvent(target.id);
    const rule = this.recurRules.find((r) => r.id === ruleId);
    if (rule && !rule.except.includes(date)) rule.except.push(date);
    void this.saveRecurRulesFile(`删除循环事件本次：${rule?.title ?? ruleId} ${date} · ${nowHHmm()}`);
  }

  /* ---- 人生板块操作（板块 = life/<板块名>/ 文件夹，内含多 Markdown 文件，v4.5） ---- */

  /** 新建板块 = life/ 下创建子文件夹 + 默认文档（frontmatter 存图标）；创建后直接进入文件夹视图 */
  createBoard(name: string, icon: string): void {
    // 文件夹名安全化：剔除 Windows 非法字符（板块名即文件夹名）
    const trimmed = name
      .trim()
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!trimmed) return;
    if (this.lifeBoards.some((b) => b.name === trimmed)) return;
    const defaultName = `${trimmed}.md`;
    const defaultContent = `---\nicon: ${icon}\n---\n\n# ${trimmed}\n\n`;
    const board: LifeBoard = {
      id: genId("life"),
      name: trimmed,
      icon,
      files: [{ id: genId("file"), name: defaultName, content: defaultContent }],
    };
    this.lifeBoards.push(board);
    this.openedLifeBoardId = board.id;
    this.openedBoardFileId = board.files[0].id;
    this.selectedLifeBoardId = board.id;
    if (persist) {
      void (async () => {
        try {
          await fsMkdir(`life/${trimmed}`);
          await fsWrite(boardDefaultRel(trimmed), defaultContent);
          await gitAutoCommit(`新建人生板块：${trimmed} · ${nowHHmm()}`);
        } catch (err) {
          console.error("[createBoard] 落盘失败", err);
        }
      })();
    }
  }

  /** 打开板块文件夹视图（主区网格 ↔ 文件夹视图切换）；自动选中默认文档 */
  openBoard(id: string): void {
    this.openedLifeBoardId = id;
    this.selectedLifeBoardId = id;
    const b = this.lifeBoards.find((x) => x.id === id);
    if (b) {
      const def = b.files.find((f) => f.name === `${b.name}.md`) ?? b.files[0];
      this.openedBoardFileId = def?.id ?? null;
    }
  }

  closeBoard(): void {
    this.openedLifeBoardId = null;
    this.openedBoardFileId = null;
  }

  /** 文件夹视图内选中文件（右侧编辑器随之切换） */
  openBoardFile(fileId: string): void {
    this.openedBoardFileId = fileId;
  }

  /** 取消文件选中（右侧显示空提示） */
  closeBoardFile(): void {
    this.openedBoardFileId = null;
  }

  /** 板块重命名（v4.9 修订）：文件夹 + 默认文档改名；任务词条同步更名；热力图历史转记新名 */
  renameBoard(boardId: string, newName: string): void {
    const b = this.lifeBoards.find((x) => x.id === boardId);
    const raw = newName.trim();
    if (!b || !raw || raw === b.name) return;
    if (this.lifeBoards.some((x) => x.name === raw)) return; // 与现存板块重名拒绝
    const old = b.name;
    // 1) 热力图历史转记新名（过去某天：存档 ?? 实时 → 固化进存档）
    this.archiveBoardStats(old, raw);
    // 2) 内存改名：板块名 + 默认文档名 + 待写回 rel 路径
    b.name = raw;
    const def = b.files.find((f) => f.name === `${old}.md`);
    if (def) def.name = `${raw}.md`;
    b.files.sort((a, x) => a.name.localeCompare(x.name, "zh"));
    for (const rel of [...this.dirtyBoards]) {
      const parts = rel.split("/");
      if (parts.length !== 3 || parts[1] !== old) continue;
      const file = parts[2] === `${old}.md` ? `${raw}.md` : parts[2];
      this.dirtyBoards.delete(rel);
      this.dirtyBoards.add(`life/${raw}/${file}`);
    }
    // 3) 全部日记任务词条同步更名（v4.9 修订：关联保留；历史统计已由 1) 固化双保险）
    this.renameGoalTagsEverywhere(old, raw);
    if (persist) {
      void (async () => {
        try {
          await fsRename(`life/${old}`, `life/${raw}`);
          if (def) await fsRename(`life/${raw}/${old}.md`, `life/${raw}/${raw}.md`).catch(() => {});
          await this.saveGoalStats();
          await gitAutoCommit(`板块改名：${old} → ${raw}（任务标签已同步更名，热力图历史保留） · ${nowHHmm()}`);
        } catch (err) {
          console.error("[renameBoard] 落盘失败", err);
        }
      })();
    }
  }

  /* ---- 板块投入历史（v4.9 热力图「存档 ?? 实时」，§2.4） ---- */

  /** 热力图取数：过去某天读存档优先（无存档则实时聚合），今天永远实时 */
  boardCountOn(boardName: string, date: string): number {
    if (date < todayKey()) {
      const archived = this.goalStats[boardName]?.[date];
      if (archived !== undefined) return archived;
    }
    const note = this.dailyNotes[date];
    if (!note) return 0;
    return note.tasks.filter((t) => hasGoalTag(t.text, boardName)).length;
  }

  /** 固化某板块历史到存档（改名转记 targetName / 删除+保留原地留存）：过去某天 = 存档 ?? 实时，0 不记 */
  private archiveBoardStats(name: string, targetName: string): void {
    const today = todayKey();
    const rec: Record<string, number> = { ...(this.goalStats[targetName] ?? {}) };
    const archived = this.goalStats[name] ?? {};
    for (const [date, count] of Object.entries(archived)) {
      if (count > 0) rec[date] ??= count;
    }
    for (const [date, note] of Object.entries(this.dailyNotes)) {
      if (date >= today) continue; // 今天保持实时，不固化
      const live = note.tasks.filter((t) => hasGoalTag(t.text, name)).length;
      const v = archived[date] ?? live;
      if (v > 0) rec[date] = v;
    }
    this.goalStats[targetName] = rec;
    if (targetName !== name) delete this.goalStats[name];
  }

  /** 全部日记任务词条移除某板块标签（删除+不保留用；内存改 + dirty 落盘） */
  private stripGoalTagsEverywhere(boardName: string): void {
    for (const [date, note] of Object.entries(this.dailyNotes)) {
      if (!note.tasks.some((t) => hasGoalTag(t.text, boardName))) continue;
      note.tasks = note.tasks.map((t) => ({ ...t, text: stripGoalTag(t.text, boardName) }));
      this.markDirty(date, "tasks");
    }
  }

  /** 全部日记任务词条同步改板块标签名（v4.9 修订：改名保留关联；任务已含新名标签时仅移除旧标签防重复） */
  private renameGoalTagsEverywhere(from: string, to: string): void {
    for (const [date, note] of Object.entries(this.dailyNotes)) {
      if (!note.tasks.some((t) => hasGoalTag(t.text, from))) continue;
      note.tasks = note.tasks.map((t) => ({
        ...t,
        text: hasGoalTag(t.text, to) ? stripGoalTag(t.text, from) : renameGoalTag(t.text, from, to),
      }));
      this.markDirty(date, "tasks");
    }
  }

  /** 存档落盘（改名/删除时调用；随数据仓 git 提交） */
  private async saveGoalStats(): Promise<void> {
    if (!persist) return;
    await fsWrite("life/goal-stats.md", buildGoalStats(this.goalStats));
  }

  /** 保存座右铭（v4.20 §2.5）：每行一条落盘 life/座右铭.md（内存先行；浏览器预览仅内存态） */
  async saveMottos(list: string[]): Promise<void> {
    this.mottos = list;
    if (!persist) return;
    await fsWrite("life/座右铭.md", list.length > 0 ? list.join("\n") + "\n" : "");
  }

  /** 新建板块内 Markdown 文件（自动补 .md 后缀；同名拒绝；创建后选中） */
  createBoardFile(boardId: string, fileName: string): void {
    const b = this.lifeBoards.find((x) => x.id === boardId);
    if (!b) return;
    const raw = fileName.trim();
    if (!raw) return;
    const name = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
    if (b.files.some((f) => f.name === name)) return;
    const file: BoardFile = {
      id: genId("file"),
      name,
      content: `# ${name.slice(0, -3)}\n\n`,
    };
    b.files.push(file);
    b.files.sort((a, x) => a.name.localeCompare(x.name, "zh"));
    this.openedBoardFileId = file.id;
    if (persist) {
      void (async () => {
        try {
          await fsWrite(`life/${b.name}/${name}`, file.content);
          await gitAutoCommit(`新建板块文档：${b.name}/${name} · ${nowHHmm()}`);
        } catch (err) {
          console.error("[createBoardFile] 落盘失败", err);
        }
      })();
    }
  }

  /** 重命名板块内文件（fs_rename 原子改名；同板块内查重，冲突拒绝） */
  renameBoardFile(boardId: string, fileId: string, newName: string): void {
    const b = this.lifeBoards.find((x) => x.id === boardId);
    const f = b?.files.find((x) => x.id === fileId);
    if (!b || !f) return;
    const raw = newName.trim();
    if (!raw) return;
    const name = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
    if (name === f.name) return;
    if (b.files.some((x) => x.name === name)) return;
    const oldName = f.name;
    const oldRel = `life/${b.name}/${oldName}`;
    const newRel = `life/${b.name}/${name}`;
    f.name = name;
    b.files.sort((a, x) => a.name.localeCompare(x.name, "zh"));
    // dirty 集合里的旧 rel 同步改名，避免 flush 写回旧路径
    if (this.dirtyBoards.has(oldRel)) {
      this.dirtyBoards.delete(oldRel);
      this.dirtyBoards.add(newRel);
    }
    if (persist) {
      void (async () => {
        try {
          await fsRename(oldRel, newRel);
          await gitAutoCommit(`重命名板块文档：${b.name}/${oldName} → ${name} · ${nowHHmm()}`);
        } catch (err) {
          f.name = oldName; // 落盘失败回滚内存名
          console.error("[renameBoardFile] 落盘失败", err);
        }
      })();
    }
  }

  /** 删除板块内文件（至少保留一个文件，防止板块空文件夹化） */
  deleteBoardFile(boardId: string, fileId: string): void {
    const b = this.lifeBoards.find((x) => x.id === boardId);
    if (!b || b.files.length <= 1) return;
    const f = b.files.find((x) => x.id === fileId);
    b.files = b.files.filter((x) => x.id !== fileId);
    if (this.openedBoardFileId === fileId) {
      this.openedBoardFileId = b.files[0]?.id ?? null;
    }
    if (f) this.dirtyBoards.delete(`life/${b.name}/${f.name}`);
    if (persist && f) {
      void (async () => {
        try {
          await fsDelete(`life/${b.name}/${f.name}`);
          await gitAutoCommit(`删除板块文档：${b.name}/${f.name} · ${nowHHmm()}`);
        } catch (err) {
          console.error("[deleteBoardFile] 落盘失败", err);
        }
      })();
    }
  }

  /** 编辑实时写回（无保存按钮；debounce 落盘到板块内对应文件） */
  updateBoardFile(boardId: string, fileId: string, content: string): void {
    const b = this.lifeBoards.find((x) => x.id === boardId);
    const f = b?.files.find((x) => x.id === fileId);
    if (!b || !f) return;
    f.content = content;
    this.markBoardDirty(`life/${b.name}/${f.name}`);
  }

  /** 删除板块（v4.9）：keepStats=true → 热力图历史存档 life/goal-stats.md；false → 连任务标签一并清除 */
  deleteBoard(id: string, keepStats: boolean): void {
    const b = this.lifeBoards.find((x) => x.id === id);
    this.lifeBoards = this.lifeBoards.filter((x) => x.id !== id);
    if (this.selectedLifeBoardId === id) this.selectedLifeBoardId = null;
    if (this.openedLifeBoardId === id) {
      this.openedLifeBoardId = null;
      this.openedBoardFileId = null;
    }
    if (!b) return;
    // v4.9：向用户指出历史数据保留位置（LifeBoardPage 顶部横幅展示）
    this.boardNotice = keepStats
      ? `板块「${b.name}」已删除；热力图历史数据（每天被任务关联的次数）已保留在 life/goal-stats.md。`
      : `板块「${b.name}」已删除；历史数据与所有日记任务中的该板块标签已全部清除。`;
    if (persist) {
      void (async () => {
        try {
          if (keepStats) {
            this.archiveBoardStats(b.name, b.name); // 过去实时值固化进存档（任务标签原样保留，历史日记不篡改）
          } else {
            delete this.goalStats[b.name];
          }
          await this.saveGoalStats();
          if (!keepStats) this.stripGoalTagsEverywhere(b.name); // 清任务标签（内存 + flush）
          await fsDelete(`life/${b.name}`);
          await gitAutoCommit(
            keepStats
              ? `删除人生板块：${b.name}（热力图历史已存档 life/goal-stats.md） · ${nowHHmm()}`
              : `删除人生板块：${b.name}（历史数据与任务标签已清除） · ${nowHHmm()}`,
          );
        } catch (err) {
          console.error("[deleteBoard] 落盘失败", err);
        }
      })();
    }
  }

  /* ---- D-6：封存盒（life/_archived/）+ 重启 + 留痕 / 停滞 ---- */

  /** 最近留痕日期：该板块出现在日记任务标签里的最大日期（存档历史也算）；null = 尚无痕迹 */
  boardLastTrace(boardName: string): string | null {
    let last: string | null = null;
    for (const [date, note] of Object.entries(this.dailyNotes)) {
      if (note.tasks.some((t) => hasGoalTag(t.text, boardName))) {
        if (!last || date > last) last = date;
      }
    }
    const arch = this.goalStats[boardName];
    if (arch) {
      for (const [date, count] of Object.entries(arch)) {
        if (count > 0 && (!last || date > last)) last = date;
      }
    }
    return last;
  }

  /** 距最近留痕的天数（无痕迹 = null） */
  boardDaysSinceTrace(boardName: string): number | null {
    const last = this.boardLastTrace(boardName);
    if (!last) return null;
    const ms = fromDateKey(todayKey()).getTime() - fromDateKey(last).getTime();
    return Math.max(0, Math.round(ms / 86400000));
  }

  /** 是否停滞：≥14 天无留痕（无痕迹不判停滞，避免新建板块被误标） */
  boardStalled(boardName: string): boolean {
    const d = this.boardDaysSinceTrace(boardName);
    return d !== null && d >= STALL_DAYS;
  }

  /**
   * D-6：封存板块 = life/<名>/ → life/_archived/<名>/（内存先行，UI 即时）。
   * 热力图历史先固化进 life/goal-stats.md（不删）；默认文档 frontmatter 写 `archived: <日期>`。
   */
  archiveBoard(id: string): void {
    const b = this.lifeBoards.find((x) => x.id === id);
    if (!b) return;
    const name = b.name;
    const date = todayKey();
    this.lifeBoards = this.lifeBoards.filter((x) => x.id !== id);
    this.archivedBoards = [...this.archivedBoards, { name, archivedAt: date }];
    if (this.selectedLifeBoardId === id) this.selectedLifeBoardId = null;
    if (this.openedLifeBoardId === id) {
      this.openedLifeBoardId = null;
      this.openedBoardFileId = null;
    }
    this.archiveBoardStats(name, name);
    for (const rel of [...this.dirtyBoards]) {
      if (rel.startsWith(`life/${name}/`)) this.dirtyBoards.delete(rel);
    }
    this.boardNotice = `板块「${name}」已封存到 life/_archived/；热力图历史保留在 life/goal-stats.md。`;
    if (persist) {
      void (async () => {
        try {
          await this.saveGoalStats();
          await fsMkdir(ARCHIVE_DIR);
          await fsRename(`life/${name}`, `${ARCHIVE_DIR}/${name}`);
          const defRel = `${ARCHIVE_DIR}/${name}/${name}.md`;
          const text = await fsRead(defRel).catch(() => null);
          if (text !== null) await fsWrite(defRel, writeFrontmatterKey(text, ARCHIVED_KEY, date));
          await gitAutoCommit(
            `封存人生板块：${name}（文件移至 life/_archived/，热力图历史保留） · ${nowHHmm()}`,
          );
        } catch (err) {
          console.error("[archiveBoard] 落盘失败", err);
        }
      })();
    }
  }

  /**
   * D-6：重启封存板块 = life/_archived/<名>/ → life/<名>/（默认文档 `archived:` 清为 null）。
   * 返回错误文案（null = 成功）；life/ 下已有同名板块时拒绝。
   */
  async restoreBoard(name: string): Promise<string | null> {
    if (this.lifeBoards.some((b) => b.name === name)) {
      return `已存在同名板块「${name}」，请先为其改名或删除，再重启该封存板块`;
    }
    if (!this.archivedBoards.some((a) => a.name === name)) return `封存盒中没有「${name}」`;
    let board: LifeBoard;
    if (persist) {
      try {
        await fsRename(`${ARCHIVE_DIR}/${name}`, `life/${name}`);
        const defRel = `life/${name}/${name}.md`;
        const text = await fsRead(defRel).catch(() => null);
        if (text !== null) await fsWrite(defRel, writeFrontmatterKey(text, ARCHIVED_KEY, null));
        await gitAutoCommit(`重启人生板块：${name}（从 life/_archived/ 恢复） · ${nowHHmm()}`);
        board = await this.readBoard(name);
      } catch (err) {
        console.error("[restoreBoard] 落盘失败", err);
        return `恢复失败：${String(err)}`;
      }
    } else {
      board = { id: genId("life"), name, icon: "svg:点子", files: [] };
    }
    this.archivedBoards = this.archivedBoards.filter((a) => a.name !== name);
    this.lifeBoards = [...this.lifeBoards, board];
    this.boardNotice = `板块「${name}」已从封存盒重启。`;
    return null;
  }

  /* ---- 番茄钟计时（双模式；倒计时到点自动记录，正计时停表即记录） ---- */

  /** 倒计时开始（自定义分钟数 + 标题） */
  startCountdown(min: number, title: string): void {
    if (min < 1) return;
    this.timer = {
      mode: "countdown",
      phase: "running",
      targetMin: min,
      elapsedSec: 0,
      startedHHmm: nowHHmm(),
      title: title.trim(),
    };
    this.ensureTick();
  }

  /** 正计时开始（停表那一刻即结束并记录） */
  startStopwatch(title: string): void {
    this.timer = {
      mode: "stopwatch",
      phase: "running",
      targetMin: 0,
      elapsedSec: 0,
      startedHHmm: nowHHmm(),
      title: title.trim(),
    };
    this.ensureTick();
  }

  pauseTimer(): void {
    if (this.timer.phase === "running") this.timer.phase = "paused";
  }

  resumeTimer(): void {
    if (this.timer.phase === "paused") this.timer.phase = "running";
  }

  /** 放弃本次：不记录，回到空闲 */
  resetTimer(): void {
    this.timer = { ...this.timer, mode: null, phase: "idle", elapsedSec: 0, title: "" };
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  /**
   * 结束并记录：正计时「停表」；倒计时可提前结束（记录实际已专注时长）。
   * 记录 = 开始时刻 + 分钟数 + 标题 + 模式；不足 1 分钟不记录。
   */
  stopAndRecord(): void {
    if (this.timer.mode === null) return;
    const minutes = Math.floor(this.timer.elapsedSec / 60);
    if (minutes >= 1) this.recordFocus(minutes);
    this.resetTimer();
  }

  /** 内部：写入专注记录（内存 + ## 专注记录 章节落盘）并累加今日 focus_minutes */
  private recordFocus(minutes: number): void {
    this.focusSessions.push({
      id: genId("fs"),
      date: todayKey(),
      startHHmm: this.timer.startedHHmm,
      minutes,
      task: this.timer.title,
      mode: this.timer.mode === "countdown" ? "countdown" : "stopwatch",
    });
    const today = this.getNote(todayKey()).metrics.focus_minutes ?? 0;
    this.markDirty(todayKey(), "focus");
    this.setMetrics(todayKey(), { focus_minutes: today + minutes });
  }

  /**
   * D-3(a) / E-4：删除一条专注记录。
   * 该日 focus_minutes 必须**整日重算**（记录是「加」，删除不能简单做减法），
   * 删完若当日已无记录则回落 null；同时写回 ## 专注记录 与 frontmatter 两个章节。
   */
  removeFocusSession(id: string): void {
    const target = this.focusSessions.find((x) => x.id === id);
    if (!target) return;
    const date = target.date;
    this.focusSessions = this.focusSessions.filter((x) => x.id !== id);
    const total = this.focusSessions
      .filter((x) => x.date === date)
      .reduce((acc, x) => acc + x.minutes, 0);
    this.markDirty(date, "focus");
    this.setMetrics(date, { focus_minutes: total > 0 ? total : null });
  }

  /** 每秒 tick：仅在 running 时推进；倒计时到 0 自动记录 */
  private ensureTick(): void {
    if (tickHandle !== null) return;
    tickHandle = setInterval(() => {
      if (app.timer.phase !== "running") return;
      app.timer.elapsedSec += 1;
      if (app.timer.mode === "countdown" && app.timer.elapsedSec >= app.timer.targetMin * 60) {
        app.recordFocus(app.timer.targetMin);
        app.resetTimer();
      }
    }, 1000);
  }

  /* ---- 导航 ---- */
  gotoSection(s: SectionId): void {
    this.section = s;
    if (s === "today") this.selectedDate = todayKey();
    // E-2：刚在设置页打开简报开关时，离开设置页立即补一次判定（不必干等 60s 定时器）
    if (s !== "settings" && s !== "chat") this.checkBriefingDue();
  }

  /**
   * R-2b：把某天设为「日历选中日」，供左侧「日程」栏联动（不切分区）。
   * 磁盘已有该日记而内存未载（应用运行期外部写入）→ 解析装载，避免左栏误显空态；
   * 磁盘尚不存在该日记 → 保持空态、**不代用户落盘**（只是看一眼，不该写出文件）。
   */
  selectDay(date: string): void {
    this.selectedDate = date;
    if (persist && !this.dailyNotes[date]) {
      void (async () => {
        try {
          const text = await fsRead(this.dailyPath(date)).catch(() => null);
          if (text === null) return;
          const p = parseDaily(text, date);
          this.dailyNotes[date] = {
            date,
            tasks: p.tasks,
            notes: p.notes,
            review: p.review,
            metrics: p.metrics,
            metricsExtra: p.metricsExtra,
          };
        } catch (err) {
          console.error("[selectDay] 装载日记失败", err);
        }
      })();
    }
  }

  /* ---- E-2 / E-3：每周罗盘简报 + 此刻最该动的一件事 ---- */

  /** E-2：起页面级定时器（只起一次）并立即做一次到点 / 补发判定 */
  startBriefingWatch(): void {
    if (briefingTimer === null) {
      briefingTimer = setInterval(() => this.checkBriefingDue(), 60_000);
    }
    this.checkBriefingDue();
  }

  /** E-2：保存简报设置（合并写回 config.briefing；不改 `last_shown`，避免设置页误清补发状态） */
  async setBriefing(enabled: boolean, weekday: number, time: string): Promise<void> {
    this.briefingEnabled = enabled;
    this.briefingWeekday = briefWeekday(weekday);
    this.briefingTime = briefTime(time);
    try {
      await briefingSetConfig(this.briefingEnabled, this.briefingWeekday, this.briefingTime);
    } catch (err) {
      console.error("[setBriefing] 保存失败", err);
    }
    // 刚打开开关且本周时刻已过 → 立刻补发一次（否则要等到下周）
    this.checkBriefingDue();
  }

  /** E-2：本地聚合本周数据 → 简报内容（纯本地，不调 AI、不落盘） */
  buildBriefing(): BriefingResult {
    return buildBriefing({
      notes: this.dailyNotes,
      focus: this.focusSessions,
      boards: this.lifeBoards.map((b) => ({
        name: b.name,
        daysSinceTrace: this.boardDaysSinceTrace(b.name),
      })),
      today: todayKey(),
    });
  }

  /** E-2：打开简报弹层（现算内容；有数据 AI Key 时异步替换建议为 AI 结论） */
  openBriefing(): void {
    this.briefingData = this.buildBriefing();
    this.briefingOpen = true;
    void this.refreshBriefingAi();
  }

  /** E-2：预览简报（设置页「立即预览」用，不改 last_shown） */
  previewBriefing(): void {
    this.openBriefing();
  }

  /** E-2：有 key 时让数据 AI 给一句话结论覆盖规则模板（失败静默，保留模板） */
  private async refreshBriefingAi(): Promise<void> {
    if (!persist) return;
    try {
      const cfg = await aiGetConfig();
      if (!cfg.data_key_saved && !cfg.key_saved) return;
      const d = this.briefingData;
      if (!d) return;
      const text = [
        `本周区间：${d.dateRange}`,
        "关键指标：",
        ...d.metricLines.map((l) => `- ${l}`),
        "板块痕迹：",
        ...d.boardLines.map((l) => `- ${l}`),
        d.focusLine,
        d.taskLine,
        "请用一句话给出本周最该调整的一件事（不超过 40 字，直接给建议，不要客套）。",
      ].join("\n");
      const answer = await dataAnalyzeAsk(
        [{ role: "user", content: text }],
        text,
      );
      const one = answer.trim().split("\n").filter(Boolean)[0]?.trim();
      if (one && this.briefingData) {
        this.briefingData = { ...this.briefingData, suggestion: one };
      }
    } catch (err) {
      console.error("[refreshBriefingAi] AI 建议失败（保留规则模板）", err);
    }
  }

  /** E-2：到点 / 启动补发判定（loadAll 后、设置变更后、页面级定时器调用） */
  checkBriefingDue(): void {
    if (this.briefingOpen) return;
    const s = this.section;
    // 在设置页浏览时不弹（离开后下一分钟仍会补上）；编辑日记 / 隆中对时也不打断
    if (s === "settings" || s === "chat") return;
    if (isBriefingDue(new Date(), this.briefingEnabled, this.briefingWeekday, this.briefingTime, this.briefingLastShown)) {
      this.openBriefing();
    }
  }

  /** E-2：关闭简报并记录弹出时刻（[现在开始] 与 [稍后] 都走这里，避免重启后重复弹） */
  async dismissBriefing(): Promise<void> {
    this.briefingOpen = false;
    this.briefingLastShown = stamp(new Date());
    if (!persist) return;
    try {
      await briefingSetLastShown(this.briefingLastShown);
    } catch (err) {
      console.error("[dismissBriefing] 记录弹出时刻失败", err);
    }
  }

  /**
   * E-3：首页「此刻最该动的一件事」——一次点击即挑一条并开正计时。
   * 候选：停滞板块（≥14 天无痕迹）优先、按停滞天数降序取一条；否则今日未完成清单第一条。
   * 都没有 → 只显示结束语（不报错、不跳转）。
   */
  pickAndStartFocus(): void {
    const today = todayKey();
    const boards = this.lifeBoards.map((b) => ({
      name: b.name,
      daysSinceTrace: this.boardDaysSinceTrace(b.name),
    }));
    const tasks = this.peekNote(today).tasks;
    const pick = pickFocus(boards, tasks);
    if (!pick) {
      this.focusPickNotice = focusClosing();
      return;
    }
    this.focusPickNotice = null;
    if (this.timer.phase === "idle") {
      this.startStopwatch(pick.title);
      this.gotoSection("pomodoro");
    } else {
      // 已有计时在跑：不打断，跳到番茄钟让用户看到当前计时
      this.gotoSection("pomodoro");
    }
  }

  /* ---- 日记路径（v4.6）：收藏后为 star-yyyy-mm-dd.md ---- */
  private dailyPath(date: string): string {
    return `daily/${date.slice(0, 4)}/${this.starredDates.has(date) ? "star-" : ""}${date}.md`;
  }

  /**
   * 打开某日期记：切到今日分区 + 选中该日期；
   * 磁盘不存在 → 按 §3.2 模板落盘 + git 提交；
   * 磁盘已有但内存未载（应用运行期外部写入）→ 解析装载，避免内存空态覆盖手写内容。
   */
  openDaily(date: string): void {
    this.selectedDate = date;
    this.section = "today";
    if (persist && !this.dailyNotes[date]) {
      void (async () => {
        try {
          const rel = this.dailyPath(date);
          const text = await fsRead(rel).catch(() => null);
          if (text === null) {
            await fsWrite(rel, buildDailyFile(date));
            this.getNote(date);
            await gitAutoCommit(`创建日记：${date} · ${nowHHmm()}`);
          } else {
            const p = parseDaily(text, date);
            this.dailyNotes[date] = {
              date,
              tasks: p.tasks,
              notes: p.notes,
              review: p.review,
              metrics: p.metrics,
              metricsExtra: p.metricsExtra,
            };
            // 同步装载该日日程（替换式：以磁盘现文为准，避免运行期重复装载）
            this.events = [
              ...this.events.filter((e) => e.date !== date),
              ...schedulesToEvents(p.schedules, date),
            ];
          }
        } catch (err) {
          console.error("[openDaily] 打开日记失败", err);
        }
      })();
    }
  }

  /* ---- 日记日历操作（v4.6：Zditor 式——收藏改名 / 删除） ---- */

  /** 收藏/取消收藏：文件原子改名 star-yyyy-mm-dd.md ↔ yyyy-mm-dd.md（状态由文件名派生，重启不丢） */
  toggleStarDaily(date: string): void {
    if (!persist || !this.dailyNotes[date]) return;
    const starred = this.starredDates.has(date);
    const from = this.dailyPath(date);
    const to = `daily/${date.slice(0, 4)}/${starred ? "" : "star-"}${date}.md`;
    void (async () => {
      try {
        await fsRename(from, to);
        const next = new Set(this.starredDates);
        if (starred) next.delete(date);
        else next.add(date);
        this.starredDates = next;
        await gitAutoCommit(`${starred ? "取消收藏" : "收藏"}日记：${date} · ${nowHHmm()}`);
      } catch (err) {
        console.error("[toggleStarDaily] 改名失败", err);
      }
    })();
  }

  /** 删除某日日记（二次确认由 UI 负责）；删除当前打开日则跳回今天 */
  deleteDaily(date: string): void {
    if (!persist || !this.dailyNotes[date]) return;
    const rel = this.dailyPath(date);
    delete this.dailyNotes[date];
    if (this.starredDates.has(date)) {
      const next = new Set(this.starredDates);
      next.delete(date);
      this.starredDates = next;
    }
    this.dirtyDaily.delete(date);
    if (this.selectedDate === date) this.openDaily(todayKey());
    void (async () => {
      try {
        await fsDelete(rel);
        await gitAutoCommit(`删除日记：${date} · ${nowHHmm()}`);
      } catch (err) {
        console.error("[deleteDaily] 删除失败", err);
      }
    })();
  }

  /* ---- 编辑器模式（v4.4） ---- */

  /** 立即写回全部待落盘内容（进入编辑器模式前调用，保证正文缓冲基于最新磁盘） */
  async flushNow(): Promise<void> {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await this.flush();
  }

  /** 切换 GUI / 编辑器模式（仅今日分区有效；退出时组件 onDestroy 强制落盘一次） */
  toggleEditorMode(): void {
    this.editorMode = !this.editorMode;
  }

  /** 编辑器保存后按解析结果刷新内存（清单/记录/指标/日程/专注，均为该日替换式） */
  refreshDailyFromParse(date: string, p: ParsedDaily): void {
    this.dailyNotes[date] = {
      date,
      tasks: p.tasks,
      notes: p.notes,
      review: p.review,
      metrics: p.metrics,
      metricsExtra: p.metricsExtra,
    };
    this.events = [
      ...this.events.filter((e) => e.date !== date),
      ...schedulesToEvents(p.schedules, date),
    ];
    this.focusSessions = [
      ...this.focusSessions.filter((s) => s.date !== date),
      ...p.focusLog,
    ];
  }

  /** 窗口 resize：更新宽度（详情栏可见性由 detailVisible 派生，按分区记忆 + 宽屏阈值） */
  syncWinWidth(): void {
    this.winWidth = window.innerWidth;
  }

  /**
   * v4.22 §2.12：把隆中对本轮对话归档为 Markdown（conversations/yyyy-mm-dd_hh-mm_标题.md）。
   * 返回落盘相对路径（ChatPage 提示 +「打开所在文件夹」用）；浏览器预览态或无消息返回 null。
   */
  async saveConversation(bubbles: ChatBubble[], model: string): Promise<string | null> {
    if (!persist || bubbles.length === 0) return null;
    const at = new Date();
    const title = slugTitle(bubbles);
    const rel = conversationRel(title, at);
    await fsWrite(rel, toConversationMd(bubbles, model, at));
    await gitAutoCommit(`保存对话：${title} · ${nowHHmm()}`);
    return rel;
  }
}

export const app = new AppState();

// 模块加载时按真实窗口宽度校正三档响应式初始态
app.syncWinWidth();
window.addEventListener("resize", () => app.syncWinWidth());
