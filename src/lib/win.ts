/**
 * v4.22 §2.11：窗口控制接缝（自定义标题栏三按钮 + 最大化态 + 关闭事件订阅）。
 * 唯一允许出现窗口 API 调用的前端位置；浏览器预览（无 Tauri 运行时）一律静默降级，
 * 便于 vite dev / preview 下独立调试界面。
 * 所有调用均吞掉异常：窗口 API 不可用或被 ACL 拒绝时只影响该按钮，不影响界面。
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { persist } from "./tauri-fs";

/** 最小化窗口 */
export async function winMinimize(): Promise<void> {
  if (!persist) return;
  try {
    await getCurrentWindow().minimize();
  } catch {
    // 静默
  }
}

/** 最大化 / 还原（同一按钮两态） */
export async function winToggleMaximize(): Promise<void> {
  if (!persist) return;
  try {
    await getCurrentWindow().toggleMaximize();
  } catch {
    // 静默
  }
}

/** 请求关闭 → Rust 侧拦截并按 close_behavior 分发（§2.11-B） */
export async function winRequestClose(): Promise<void> {
  if (!persist) return;
  try {
    await getCurrentWindow().close();
  } catch {
    // 静默
  }
}

/** 当前是否最大化（驱动 Header 按钮文案与 aria 状态） */
export async function winIsMaximized(): Promise<boolean> {
  if (!persist) return false;
  try {
    return await getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}

/**
 * 订阅 Rust 发来的「关闭意图」事件（close_behavior = ask 时触发）。
 * 返回取消订阅函数；浏览器预览下返回 null。
 */
export async function onCloseRequested(cb: () => void): Promise<UnlistenFn | null> {
  if (!persist) return null;
  try {
    return await listen("close-requested", () => cb());
  } catch {
    return null;
  }
}
