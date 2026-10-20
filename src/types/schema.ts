/**
 * 数据 schema 类型定义。
 * 与《CompassZha 总需求文档 v3.1》§3.2（frontmatter 模板）、
 * §3.6（SQLite 索引 schema）同型。
 * SPEC-011：mock 数据与真实数据共用本文件类型，
 * 保证阶段一「换数据源不换组件」。
 */

/** 每日量化指标（对应每日文件 frontmatter，UI-004：字段名一一对应；v3.1 调整） */
export interface DailyMetrics {
  /** 睡眠时长（小时） */
  sleep_hours: number | null;
  /** 睡眠质量 1-5 */
  sleep_quality: number | null;
  /** 入睡时间 HH:mm */
  sleep_bedtime: string | null;
  /** 起床时间 HH:mm */
  sleep_wake: string | null;
  /** 体重（kg） */
  weight_kg: number | null;
  /** 当日支出总额（元） */
  spend_total: number | null;
  /** 心情 1-5 */
  mood: number | null;
  /** 专注分钟数（番茄钟累计，原型期由计时真累加） */
  focus_minutes: number | null;
  /** 运动步数 */
  steps: number | null;
}

/**
 * 数据追踪项定义（E-1：内置与自定义走同一套机制）。
 * 内置项以 `lib/trackers.ts` 的代码常量表为准（不落 config）；
 * 自定义项落 `config.trackers`，键为 `x_<slug>`。
 */
export interface TrackerDef {
  /** frontmatter 键：内置 = 固定键之一；自定义 = `x_<slug>` */
  key: string;
  /** 显示名 */
  name: string;
  /** 单位（可空） */
  unit: string;
  /** 录入类型：数值 / 档位 / 是·否 / 时刻 */
  kind: "number" | "level" | "bool" | "time";
  /** 目标方向（仅展示语义：越高越好 / 越低越好） */
  direction: "up" | "down";
  /** 档位型上限（kind="level"；缺省 5） */
  max?: number;
  /** 数值型步长（供 <input type="number" step>） */
  step?: string;
  /** 小数位（展示用；缺省按类推断） */
  decimals?: number;
  /** 是否内置（内置以代码常量表为准；自定义项落 config） */
  builtin: boolean;
  /** 是否隐藏（隐藏 = 表单/卡片/图表收起，日记文件里的数据保留） */
  hidden: boolean;
}

/** 今日清单任务 */
export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  /** 顺延标记：从某天顺延而来 */
  deferredFrom?: string;
}

/** 日历事件 */
export interface EventItem {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm，null 表示全天事件 */
  start: string | null;
  /** HH:mm，null 表示全天事件 */
  end: string | null;
  /** 来源：手动新建 / 从今日任务排程而来 */
  source: "manual" | "scheduled";
  /** 若为排程来源，关联的任务 id */
  relatedTaskId?: string;
  /** v4.21：循环实例来源规则 id（有值 = 由循环规则懒物化生成） */
  ruleId?: string;
}

/** 循环频率（v4.21 §2.10） */
export type RecurFreq = "daily" | "weekly" | "monthly" | "yearly";

/** 循环事件规则（v4.21 §2.10；存 events/循环事件.md，规则驱动懒物化） */
export interface RecurRule {
  id: string;
  title: string;
  freq: RecurFreq;
  /** 每隔 N 天/周/月/年 */
  interval: number;
  /** 仅 weekly 使用：0=周日 … 6=周六 */
  weekdays: number[];
  /** 从此日开始循环（yyyy-mm-dd） */
  start_date: string;
  /** null = 永久循环；否则为含端点的结束日期 */
  end_date: string | null;
  /** HH:mm；null = 全天事件 */
  start: string | null;
  end: string | null;
  /** 用户删除过的单次实例日期（重生成时跳过） */
  except: string[];
  /** 已生成实例日期（保存时清理早于今天的记录） */
  materialized: string[];
}

/** 编辑器「重复」区规则草稿（v4.21） */
export interface RecurDraft {
  /** 编辑既有规则时其 id；新建时缺省 */
  ruleId?: string;
  freq: RecurFreq;
  interval: number;
  /** 仅 weekly：0=周日 … 6=周六 */
  weekdays: number[];
  /** 重复结束日期；null = 永久 */
  endDate: string | null;
}

/** 一天的完整记录（对应 daily/yyyy/yyyy-mm-dd.md 的内存形态） */
export interface DailyNote {
  /** yyyy-mm-dd */
  date: string;
  tasks: TaskItem[];
  /** 临时记录（自由文本区） */
  notes: string;
  /** 今日收尾（一句对今天的判断） */
  review: string;
  metrics: DailyMetrics;
  /** E-1：自定义指标（frontmatter `x_<slug>` 键；number / HH:mm 字符串 / null） */
  metricsExtra: Record<string, number | string | null>;
}

/** 板块内的一个 Markdown 文件（v4.5：板块 = 文件夹，含多文件） */
export interface BoardFile {
  id: string;
  /** 文件名（含 .md 后缀） */
  name: string;
  /** 文件全文（内存态编辑实时生效） */
  content: string;
}

/** 人生板块（v4.5：卡片 = life/ 下子文件夹，files = 文件夹内全部 Markdown 文件） */
export interface LifeBoard {
  id: string;
  name: string;
  /** 图标（emoji，存于默认文件 <板块名>.md 的 frontmatter） */
  icon: string;
  /** 板块文件夹内的 Markdown 文件列表（按文件名排序） */
  files: BoardFile[];
}

/** D-6 封存盒条目：life/_archived/<名>/（archivedAt 取自默认文档 frontmatter 的 archived:） */
export interface ArchivedBoard {
  /** 板块名（= 目录名） */
  name: string;
  /** 封存日期 yyyy-mm-dd；null = 未标记 */
  archivedAt: string | null;
}

/** 一次专注记录（番茄钟双模式产生） */
export interface FocusSession {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  /** 开始时刻 HH:mm */
  startHHmm: string;
  /** 专注分钟数 */
  minutes: number;
  /** 任务标题 */
  task: string;
  /** 模式：倒计时 / 正计时 */
  mode: "countdown" | "stopwatch";
}

/** 番茄钟计时器状态（store 全局，切分区继续走） */
export interface TimerState {
  /** null = 未启用任何模式 */
  mode: "countdown" | "stopwatch" | null;
  /** idle 未运行 / running 走表 / paused 暂停 */
  phase: "idle" | "running" | "paused";
  /** 倒计时目标分钟数（正计时忽略） */
  targetMin: number;
  /** 已走秒数 */
  elapsedSec: number;
  /** 本次开始时刻 HH:mm */
  startedHHmm: string;
  /** 任务标题 */
  title: string;
}

/** 日历编辑器草稿（新建 / 编辑共用） */
export interface CalendarDraft {
  mode: "create" | "edit";
  /** 编辑时对应的事件 id */
  id?: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** 全天事件：无起止时间 */
  allDay: boolean;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  /** v4.21：重复区草稿；null = 单次事件，否则保存为循环规则 */
  repeat: RecurDraft | null;
}

/** 主导航分区 */
export type SectionId =
  | "today"
  | "calendar"
  | "dashboard"
  | "life"
  | "pomodoro"
  | "chat"
  | "settings";

/** 空指标（所有字段 null） */
export function emptyMetrics(): DailyMetrics {
  return {
    sleep_hours: null,
    sleep_quality: null,
    sleep_bedtime: null,
    sleep_wake: null,
    weight_kg: null,
    spend_total: null,
    mood: null,
    focus_minutes: null,
    steps: null,
  };
}

/** E-1：空的自定义指标集合（自定义追踪的 frontmatter `x_` 键） */
export function emptyMetricsExtra(): Record<string, number | string | null> {
  return {};
}
