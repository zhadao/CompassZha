/**
 * 全局 store（Svelte 5 runes）。「换数据源不换组件」的唯一接缝：
 * 数据源 = Tauri fs + Markdown 文件（daily/yyyy/yyyy-mm-dd.md 与 life/<板块>/），
 * 组件层对此无感知，仍然只调用本 store 的方法。
 *
 * 写路径：每个 UI 操作标记 dirty 章节 → 500ms 防抖 →
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
  SectionId,
  TimerState,
} from "../types/schema";
import { emptyMetrics } from "../types/schema";
import { genId } from "../mock/preview";
import { addHours, offsetDays, todayKey } from "../lib/date";
import {
  type ParsedDaily,
  parseDaily,
  buildDailyFile,
  writeMetrics,
  writeTasks,
  writeNotes,
  writeReview,
  writeFocusLog,
  writeSchedules,
  schedulesToEvents,
} from "../lib/markdown";
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
  /** 窗口宽度（响应式三档：≥1280 / 800–1280 / <800） */
  winWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1280);
  /** 右栏当前是否可见（1280 档手动开关 + 自动画出） */
  detailVisible = $state(true);
  /** 当前编辑日（文件树 / 今日入口联动） */
  selectedDate = $state(todayKey());

  /* ---- 数据（启动 loadAll 从真实文件载入；浏览器预览为空态） ---- */
  dailyNotes = $state<Record<string, DailyNote>>({});
  /** 日历事件（v4.4 已接真：写回当日 ## 日程 章节） */
  events = $state<EventItem[]>([]);

  /* ---- 人生板块（板块 = life/ 下子文件夹；v4.5：文件夹内含多 Markdown 文件） ---- */
  lifeBoards = $state<LifeBoard[]>([]);
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
   * 1) 确保当天文件存在：缺失则按模板创建（不覆盖已有）；
   * 2) daily/：全量扫描各年份目录（保证旧文件在编辑时不会因未装载而丢内容；
   *    近 90 天窗口只影响仪表盘默认展示）；
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
        let icon = "🧭";
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

  /** 点击日历空白处：打开新建草稿 */
  openCreateDraft(date: string, allDay: boolean, startHHmm = "09:00"): void {
    this.calendarDraft = {
      mode: "create",
      title: "",
      date,
      allDay,
      start: allDay ? "" : startHHmm,
      end: allDay ? "" : addHours(startHHmm, 1),
    };
    this.selectedEventId = null;
  }

  /** 点击已有事件：打开编辑草稿 */
  openEditDraft(id: string): void {
    const e = this.events.find((x) => x.id === id);
    if (!e) return;
    this.selectedEventId = id;
    this.calendarDraft = {
      mode: "edit",
      id,
      title: e.title,
      date: e.date,
      allDay: e.start === null,
      start: e.start ?? "",
      end: e.end ?? "",
    };
  }

  closeDraft(): void {
    this.calendarDraft = null;
  }

  saveDraft(): void {
    const d = this.calendarDraft;
    if (!d || !d.title.trim()) return;
    const item = {
      title: d.title.trim(),
      date: d.date,
      start: d.allDay ? null : d.start,
      end: d.allDay ? null : d.end,
    };
    if (d.mode === "create") {
      this.addEvent({ ...item, source: "manual" });
    } else if (d.id) {
      this.updateEvent(d.id, item);
    }
    this.calendarDraft = null;
  }

  deleteSelected(): void {
    if (this.selectedEventId) this.removeEvent(this.selectedEventId);
    this.calendarDraft = null;
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

  deleteBoard(id: string): void {
    const b = this.lifeBoards.find((x) => x.id === id);
    this.lifeBoards = this.lifeBoards.filter((x) => x.id !== id);
    if (this.selectedLifeBoardId === id) this.selectedLifeBoardId = null;
    if (this.openedLifeBoardId === id) {
      this.openedLifeBoardId = null;
      this.openedBoardFileId = null;
    }
    if (persist && b) {
      void (async () => {
        try {
          await fsDelete(`life/${b.name}`);
          await gitAutoCommit(`删除人生板块：${b.name} · ${nowHHmm()}`);
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
   * 磁盘不存在 → 按模板落盘 + git 提交；
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
}

export const app = new AppState();

// 模块加载时按真实窗口宽度校正三档响应式初始态
app.syncWinWidth();
window.addEventListener("resize", () => app.syncWinWidth());
