/**
 * Tauri fs 接缝层（阶段 1 · 检查点 1.2 前端侧）。
 * 唯一允许出现 invoke 调用的地方；所有路径均为相对 dataRoot 的安全路径。
 * 浏览器环境（无 Tauri 运行时，vite preview）persist=false，
 * store 由此退化为纯内存态，便于前端独立预览。
 */

import { invoke } from "@tauri-apps/api/core";

/** 是否运行在 Tauri 桌面壳内（决定 store 是否走真实落盘） */
export const persist =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Rust fs_list_dir 返回的目录条目 */
export interface FsEntry {
  name: string;
  is_dir: boolean;
  size: number;
}

export const fsRead = (rel: string): Promise<string> =>
  invoke<string>("fs_read", { rel });

export const fsWrite = (rel: string, content: string): Promise<void> =>
  invoke<void>("fs_write", { rel, content });

export const fsAppend = (rel: string, content: string): Promise<void> =>
  invoke<void>("fs_append", { rel, content });

export const fsListDir = (rel: string): Promise<FsEntry[]> =>
  invoke<FsEntry[]>("fs_list_dir", { rel });

export const fsMkdir = (rel: string): Promise<void> =>
  invoke<void>("fs_mkdir", { rel });

export const fsDelete = (rel: string): Promise<void> =>
  invoke<void>("fs_delete", { rel });

export const fsExists = (rel: string): Promise<boolean> =>
  invoke<boolean>("fs_exists", { rel });

export const fsRename = (from: string, to: string): Promise<void> =>
  invoke<void>("fs_rename", { from, to });

/** 资源管理器定位选中文件（v4.20 文件树右键「定位文件位置」，§2.9） */
export const fsReveal = (rel: string): Promise<void> =>
  invoke<void>("fs_reveal", { rel });

/** 本地 git 自动提交（保存动作 debounce 后触发；v4.10 起同步已启用时自动接推送） */
export const gitAutoCommit = (msg: string): Promise<string> =>
  invoke<string>("git_auto_commit", { msg });

/** 每日文件相对路径：daily/yyyy/yyyy-mm-dd.md（§3.1） */
export function dailyRel(date: string): string {
  return `daily/${date.slice(0, 4)}/${date}.md`;
}

/** 板块默认文件相对路径：life/<板块名>/<板块名>.md */
export function boardDefaultRel(boardName: string): string {
  return `life/${boardName}/${boardName}.md`;
}

/* ---- GitHub / Gitee 私密仓同步（v4.10 起；v4.27 加平台与同步时机；令牌只存系统凭据管理器） ---- */

/** 同步平台：github / gitee（v4.27） */
export type GitPlatform = "github" | "gitee";

/** 认证方式（v4.29）：auto = 交给本机 git（凭据管理器 / SSH 密钥，免输入）；token = 注入私人令牌 */
export type GitAuth = "auto" | "token";

/** git_sync_get_config 返回的同步配置（token_saved=true 表示密钥链已存令牌） */
export interface GitSyncConfig {
  platform: GitPlatform;
  /** 认证方式：auto（默认）/ token（v4.29） */
  auth: GitAuth;
  remote: string;
  branch: string;
  /** 打开软件时对比变更并提交推送一次（v4.27 默认时机） */
  on_start: boolean;
  /** 每次保存后同步（v4.10 原默认行为，v4.27 起改为用户设置项，默认关） */
  enabled: boolean;
  /** 定时同步间隔（分钟，0 = 关闭；仅支持 5/15/30/60） */
  interval_min: number;
  token_saved: boolean;
  last_sync: number | null;
  data_root: string;
}

/** 读取同步配置 */
export const gitSyncGetConfig = (): Promise<GitSyncConfig> =>
  invoke<GitSyncConfig>("git_sync_get_config");

/** 保存同步设置；token 语义：非空 = 写入密钥链 / 空串 = 清除 / null = 保持不动 */
export const gitSyncSetConfig = (
  enabled: boolean,
  platform: GitPlatform,
  auth: GitAuth,
  onStart: boolean,
  intervalMin: number,
  remote: string,
  branch: string,
  token: string | null,
): Promise<void> =>
  invoke<void>("git_sync_set_config", {
    enabled,
    platform,
    auth,
    onStart,
    intervalMin,
    remote,
    branch,
    token,
  });

/** 立即同步（本地提交 + 推送 + 记 last_sync） */
export const gitSyncNow = (): Promise<string> =>
  invoke<string>("git_sync_now");

/** 打开软件时同步（v4.27 默认时机）：未开启/未配置/无令牌 → "skipped" */
export const gitSyncOnStart = (): Promise<string> =>
  invoke<string>("git_sync_on_start");

/** 定时同步一次（由前端调度器按 interval_min 触发） */
export const gitSyncTick = (): Promise<string> =>
  invoke<string>("git_sync_tick");

/** git_ssh_generate_key 返回（v4.40 C-2）：created=false 表示本机已有密钥、已直接复用 */
export interface SshKeyResult {
  created: boolean;
  public_key: string;
}

/** 生成 SSH 密钥（v4.40 C-2；已有密钥绝不覆盖，直接复用并回传公钥） */
export const gitSshGenerateKey = (): Promise<SshKeyResult> =>
  invoke<SshKeyResult>("git_ssh_generate_key");

/** 测试同步连通性（v4.40 C-2；只读 ls-remote，不改动任何数据） */
export const gitTestConnection = (): Promise<string> =>
  invoke<string>("git_test_connection");

/** 用系统默认浏览器打开 https 链接（v4.16：「软件作者」弹窗外链）。 */
export const openUrlHttps = (url: string): Promise<void> =>
  invoke<void>("open_url_https", { url });

/* ---- 外观偏好（v4.17；非敏感，config.json appearance 对象） ---- */

/** appearance_get 返回的外观偏好（Rust 侧已规范化三键） */
export interface AppearanceConfig {
  accent: string;
  mode: string;
  splash: boolean;
}

/** 读取外观偏好 */
export const appearanceGet = (): Promise<AppearanceConfig> =>
  invoke<AppearanceConfig>("appearance_get");

/** 保存外观偏好（整组替换写回） */
export const appearanceSet = (prefs: AppearanceConfig): Promise<void> =>
  invoke<void>("appearance_set", { appearance: prefs });

/* ---- 界面偏好（阶段 1 · A-4 日历时段 / A-3 详情栏记忆；config.json calendar / ui 对象） ---- */

/** A-6：刻度规则（config.json calendar.ticks） */
export interface CalendarTicksConfig {
  /** 每 N 小时一条横线；0 = 取消 */
  every_hours: number;
  /** 指定时刻 HH:mm 列表；空 = 取消 */
  times: string[];
}

/** 日历偏好（config.json calendar；缺省 06:00–24:00 / 1 小时 175px / 每 1 小时一横线） */
export interface CalendarConfig {
  slot_min: string;
  slot_max: string;
  /** A-5：缩放档位 = 1 小时占多少像素 */
  px_per_hour: number;
  /** A-6：刻度规则 */
  ticks: CalendarTicksConfig;
}

/** 读取日历偏好（老 config 缺该键由 Rust serde 默认值兜底） */
export const calendarGetConfig = (): Promise<CalendarConfig> =>
  invoke<CalendarConfig>("calendar_get_config");

/** 保存日历偏好（设置页一次性提交：时段 + 缩放档位 + 刻度规则） */
export const calendarSetConfig = (
  slotMin: string,
  slotMax: string,
  pxPerHour: number,
  ticks: CalendarTicksConfig,
): Promise<void> =>
  invoke<void>("calendar_set_config", { slotMin, slotMax, pxPerHour, ticks });

/** A-5：仅保存缩放档位（日历页 ± / Ctrl+滚轮快速保存；其余日历偏好保留） */
export const calendarSetPxPerHour = (pxPerHour: number): Promise<void> =>
  invoke<void>("calendar_set_px_per_hour", { pxPerHour });

/** 界面偏好（config.json ui；A-3 详情栏按分区记忆 / A-7 日程预览列显隐） */
export interface UiConfig {
  detail_by_section: Partial<Record<string, boolean>>;
  /** A-7：日历左侧「日程预览列」是否显示（窄窗下仍可强制开） */
  calendar_daily_visible?: boolean;
  /** D-4b：日历视图模式 `timeline`（时间轴）/ `todo`（待办卡片） */
  calendar_view_mode?: "timeline" | "todo";
  /** D-8②：隆中对首开引导是否已看过（缺省 false = 未看过） */
  chat_guide_seen?: boolean;
}

/** 读取界面偏好 */
export const uiGetConfig = (): Promise<UiConfig> => invoke<UiConfig>("ui_get_config");

/** 写入某分区详情栏显隐（合并写回，保留其他分区） */
export const uiSetDetailSection = (section: string, visible: boolean): Promise<void> =>
  invoke<void>("ui_set_detail_section", { section, visible });

/** A-7：写入日历「日程预览列」显隐（合并写回，保留其他 ui 字段） */
export const uiSetCalendarDaily = (visible: boolean): Promise<void> =>
  invoke<void>("ui_set_calendar_daily", { visible });

/** D-4b：写入日历视图模式（合并写回，保留其他 ui 字段） */
export const uiSetCalendarViewMode = (mode: "timeline" | "todo"): Promise<void> =>
  invoke<void>("ui_set_calendar_view_mode", { mode });

/** D-8②：写入隆中对首开引导「已看过」标记（合并写回，保留其他 ui 字段） */
export const uiSetChatGuideSeen = (seen: boolean): Promise<void> =>
  invoke<void>("ui_set_chat_guide_seen", { seen });

/* ---- 每周罗盘简报（E-2：config.json briefing 对象） ---- */

/** E-2：每周简报设置（缺省 enabled:false / 周日 / 20:00） */
export interface BriefingCfg {
  /** 是否启用每周简报 */
  enabled: boolean;
  /** 周日 = 0 … 周六 = 6 */
  weekday: number;
  /** 触发时刻 HH:mm */
  time: string;
  /** 上次弹出时刻（ISO 本地 `YYYY-MM-DDTHH:mm`；未弹出过 = null） */
  last_shown: string | null;
}

/** E-2：读取每周简报设置 */
export const briefingGetConfig = (): Promise<BriefingCfg> =>
  invoke<BriefingCfg>("briefing_get_config");

/** E-2：保存每周简报设置（合并写回；不改 `last_shown`） */
export const briefingSetConfig = (enabled: boolean, weekday: number, time: string): Promise<void> =>
  invoke<void>("briefing_set_config", { enabled, weekday, time });

/** E-2：记录上次简报弹出时刻（启动补发判定用；传 null 清空） */
export const briefingSetLastShown = (lastShown: string | null): Promise<void> =>
  invoke<void>("briefing_set_last_shown", { lastShown });

/* ---- 指标表单偏好（v4.40 D-1：config.json metrics 对象） ---- */

/** 指标「常显」集合（缺省 = 7 项全部常显，Rust 侧已规范化） */
export interface MetricsConfig {
  /** 常显字段 key 列表（顺序与 Rust 字段表一致） */
  pinned: string[];
}

/** 读取指标「常显」偏好 */
export const metricsGetConfig = (): Promise<MetricsConfig> =>
  invoke<MetricsConfig>("metrics_get_config");

/** 写入指标「常显」集合（合并写回，保留其他顶层字段） */
export const metricsSetPinned = (pinned: string[]): Promise<void> =>
  invoke<void>("metrics_set_pinned", { pinned });

/* ---- 数据追踪项（E-1：config.json trackers 数组） ---- */

/** 追踪项定义（与 types/schema TrackerDef 同型；内置项由代码常量表提供） */
export interface TrackerCfg {
  key: string;
  name: string;
  unit: string;
  kind: "number" | "level" | "bool" | "time";
  direction: "up" | "down";
  max?: number;
  step?: string;
  decimals?: number;
  builtin?: boolean;
  hidden: boolean;
}

/** 读取追踪项配置（缺键 = 只有内置项） */
export const trackersGetConfig = (): Promise<{ trackers: TrackerCfg[] }> =>
  invoke<{ trackers: TrackerCfg[] }>("trackers_get_config");

/** 写入追踪项配置（整组替换；Rust 侧校验键前缀 / 唯一性） */
export const trackersSetConfig = (trackers: TrackerCfg[]): Promise<void> =>
  invoke<void>("trackers_set_config", { trackers });

/* ---- 仪表盘编排（D-5：config.json dashboard 对象） ---- */

/** 仪表盘编排（order / hidden 元素 = 追踪项 key；R-1b 增 view_mode；R-1d 增 heatmap_order） */
export interface DashboardCfg {
  order: string[];
  hidden: string[];
  view_mode: "data" | "heatmap";
  heatmap_order: string[];
}

/** 读取仪表盘编排（缺键 = 默认序 / 全显 / 数据屏 / 热力图按目录序） */
export const dashboardGetConfig = (): Promise<DashboardCfg> =>
  invoke<DashboardCfg>("dashboard_get_config");

/** 写入仪表盘编排（合并写回，保留其他顶层字段） */
export const dashboardSetConfig = (cfg: DashboardCfg): Promise<void> =>
  invoke<void>("dashboard_set_config", {
    order: cfg.order,
    hidden: cfg.hidden,
    viewMode: cfg.view_mode,
    heatmapOrder: cfg.heatmap_order,
  });

/* ---- 数据目录与窗口生命周期（v4.22 §2.11 / §3.1） ---- */

/** 在资源管理器中打开数据根目录（设置页 / 侧栏「打开数据目录」） */
export const openDataRoot = (): Promise<void> =>
  invoke<void>("open_data_root");

/** 关闭行为偏好取值：ask=首次询问 / exit=直接退出 / tray=最小化到托盘（§2.11-B） */
export type CloseBehavior = "ask" | "exit" | "tray";

/** 读取关闭行为偏好（非法/缺失回落 ask，Rust 侧已规范化） */
export const closeBehaviorGet = (): Promise<CloseBehavior> =>
  invoke<CloseBehavior>("close_behavior_get");

/** 写入关闭行为偏好 */
export const closeBehaviorSet = (behavior: CloseBehavior): Promise<void> =>
  invoke<void>("close_behavior_set", { behavior });

/** 退出应用（绕过 Rust 关闭拦截） */
export const appExit = (): Promise<void> => invoke<void>("app_exit");

/** 隐藏主窗口到系统托盘（进程驻留，会话不丢） */
export const hideToTray = (): Promise<void> => invoke<void>("hide_to_tray");

/* ---- 数据一键导出（v4.25 §2.13） ---- */

/** 导出文件名时间戳：yyyy-mm-dd_hh-mm（本地时间；服务端再过滤非法字符） */
export function exportStamp(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}`;
}

/** 一键导出：整个数据根打包为 zip 落「下载」文件夹，返回 zip 完整路径 */
export const exportDataZip = (stamp: string): Promise<string> =>
  invoke<string>("export_data_zip", { stamp });

/** 在资源管理器中定位任意绝对路径文件（导出结果「打开所在文件夹」） */
export const revealPath = (path: string): Promise<void> =>
  invoke<void>("reveal_path", { path });

