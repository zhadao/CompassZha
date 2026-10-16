/**
 * 纯工具与展示口径常量（真实数据源 = Tauri fs + Markdown 文件）。
 * 文件名保留（历史导入路径），当前职责仅剩：
 * - genId：内存 id 生成（任务/事件/专注记录的 UI 层关联）
 * - BOARD_ICONS：新建板块可选图标
 * - METRIC_LABELS / METRIC_UNITS：仪表盘与表单的指标口径文案
 * 浏览器预览（无 Tauri 运行时）时为空数据内存态。
 */

/** 简易 id 生成（UI 层关联用；磁盘文件不存 id，重载后重新生成） */
export function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 新建板块可选图标 */
export const BOARD_ICONS: string[] = [
  "🧭", "💼", "📚", "🎨", "🏃", "💡", "🌱", "🗺️",
  "🛠️", "📈", "❤️", "🔥", "🌊", "⭐", "🤝", "🎯",
];

/* ---- 仪表盘口径说明（静态文本） ---- */

export const METRIC_LABELS: Record<string, string> = {
  sleep_hours: "睡眠时长",
  sleep_quality: "睡眠质量",
  sleep_bedtime: "入睡时间",
  sleep_wake: "起床时间",
  weight_kg: "体重",
  spend_total: "当日支出",
  mood: "心情",
  focus_minutes: "专注时长",
  steps: "运动步数",
};

export const METRIC_UNITS: Record<string, string> = {
  sleep_hours: "小时",
  sleep_quality: "/5",
  sleep_bedtime: "",
  sleep_wake: "",
  weight_kg: "kg",
  spend_total: "元",
  mood: "/5",
  focus_minutes: "分钟",
  steps: "步",
};
