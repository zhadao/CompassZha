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
} from "../types/schema";
import { emptyMetrics } from "../types/schema";
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
} from "../lib/tauri-fs";
import {
  conversationRel,
  slugTitle,
  toConversationMd,
  type ChatBubble,
} from "../lib/chat-export";

/** 当前时刻 HH:mm（番茄钟开始时刻 / 提交信息用） */
function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 模块级句柄（store 单例生命周期 = 应用生命周期） */
let tickHandle: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

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

class AppState {
  /* ---- 布局状态 ---- */
  section = $state<SectionId>("today");
  sidebarCollapsed = $state(false);
  detailHidden = $state(false);
  /** 窗口宽度（响应式三档：≥1280 / 800–1280 / <800，总需求 §2.9） */
  winWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1280);
  /** 右栏当前是否可见（1280 档手动开关 + 自动画出） */
  detailVisible = $state(true);
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

  /* ---- 落盘状态（非响应式内部记账） ---- */
  /** date → 待写回章节集合 */
  private dirtyDaily = new Map<string, Set<DailyAspect>>();
  /** 板块文件 rel 路径（life/<板块>/<文件>）→ 待写回（内容以内存态为准，v4.5 由 boardId 改为文件级） */
  private dirtyBoards = new Set<string>();
  /** 启动扫描完成标志（防止启动竞态期间误写空数据） */
  loaded = false;

  /* ---- 派生 ---- */
  get selectedEvent(): EventItem | null {
    return this.events.find((e) => e.id === this.selectedEventId) ?? null;
  }

  get note(): DailyNote {
    return this.peekNote(this.selectedDate);
  }

  /* ---- 数据装载（App onMount 调用一次） ---- */

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
          notes[date] = { date, tasks: p.tasks, notes: p.notes, review: p.review, metrics: p.metrics };
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
        if (!d.is_dir) continue;
        let icon = "svg:点子";
        const files: BoardFile[] = [];
        const entries = await fsListDir(`life/${d.name}`).catch(() => []);
        for (const e of entries) {
          if (e.is_dir || !e.name.toLowerCase().endsWith(".md")) continue;
          const text = await fsRead(`life/${d.name}/${e.name}`).catch(() => null);
          if (text === null) continue;
          // 图标约定：默认文件 <板块名>.md 的 frontmatter `icon:` 字段
          if (e.name === `${d.name}.md`) {
            const m = /^icon:[ \t]*(.+)$/m.exec(text);
            if (m) icon = m[1].trim();
          }
          files.push({ id: genId("file"), name: e.name, content: text });
        }
        files.sort((a, b) => a.name.localeCompare(b.name, "zh"));
        boards.push({ id: genId("life"), name: d.name, icon, files });
      }
      this.lifeBoards = boards;
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
      this.loaded = true;
    } catch (err) {
      console.error("[loadAll] 数据装载失败", err);
      this.loaded = true; // 失败也要放开写入（避免永久空转）
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
        if (text === null) text = buildDailyFile(date, note.metrics);
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
        if (aspects.has("metrics")) text = writeMetrics(text, note.metrics, date);
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
  setMetrics(date: string, patch: Partial<DailyMetrics>): void {
    const n = this.getNote(date);
    n.metrics = { ...n.metrics, ...patch };
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

  /** 窗口 resize：更新宽度并同步右栏可见性（≥1280 跟随手动开关；<1280 自动收起） */
  syncWinWidth(): void {
    this.winWidth = window.innerWidth;
    this.detailVisible = this.winWidth >= 1280 && !this.detailHidden;
  }

  toggleDetail(): void {
    this.detailHidden = !this.detailHidden;
    this.detailVisible = this.winWidth >= 1280 && !this.detailHidden;
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
