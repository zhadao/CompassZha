/**
 * 主题运行时（v4.17 · UI/美术大改）：
 * - 管理 <html data-color-mode="light|dark"> 与 data-accent="blue|red|yellow|green"；
 * - localStorage 持有同份偏好作「防闪白」快照（挂载前先应用，config.json 随后覆盖）；
 * - 浏览器预览（无 Tauri）以 localStorage 为唯一持久层。
 */

export type ColorMode = "light" | "dark";
export type AccentColor = "blue" | "red" | "yellow" | "green";

/** 外观偏好三键（与 config.json appearance 对象一致） */
export interface AppearancePrefs {
  accent: AccentColor;
  mode: ColorMode;
  splash: boolean;
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  accent: "blue",
  mode: "light",
  splash: true,
};

const LS_KEY = "compass-appearance";

/** 把外观应用到 DOM 根元素（tokens.css 按这两个属性选择器覆盖变量） */
export function applyAppearance(p: AppearancePrefs): void {
  const root = document.documentElement;
  root.dataset.colorMode = p.mode;
  root.dataset.accent = p.accent;
}

/** 任意来源（localStorage / invoke 返回）→ 合法偏好；非法/缺失字段回默认 */
export function coerceAppearance(v: unknown): AppearancePrefs {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    accent: isAccent(o.accent) ? o.accent : DEFAULT_APPEARANCE.accent,
    mode: isMode(o.mode) ? o.mode : DEFAULT_APPEARANCE.mode,
    splash: typeof o.splash === "boolean" ? o.splash : DEFAULT_APPEARANCE.splash,
  };
}

/** 读 localStorage 快照（防闪白；无记录/损坏回默认） */
export function readAppearanceLocal(): AppearancePrefs {
  try {
    return coerceAppearance(JSON.parse(localStorage.getItem(LS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** 写 localStorage 快照（隐私模式等写入失败静默忽略） */
export function writeAppearanceLocal(p: AppearancePrefs): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* 静默 */
  }
}

function isAccent(v: unknown): v is AccentColor {
  return v === "blue" || v === "red" || v === "yellow" || v === "green";
}

function isMode(v: unknown): v is ColorMode {
  return v === "light" || v === "dark";
}
