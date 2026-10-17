/**
 * 同步调度器（v4.27 §2.15）。
 * 承担「打开软件时同步」与「定时同步」两个时机的调度，避免逻辑塞进组件与 store。
 * 一切失败静默（只 console.warn），不打断用户；错误回显只属于「立即同步」按钮。
 */

import { persist, gitSyncGetConfig, gitSyncOnStart, gitSyncTick } from "./tauri-fs";

/** 定时同步计时器（模块级单例，refresh 时先清旧再起新） */
let timer: ReturnType<typeof setInterval> | null = null;

/** 清掉既有定时器 */
function clearTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** 按 interval_min 起定时同步；0 或非法值表示关闭 */
function startTimer(intervalMin: number): void {
  clearTimer();
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) return;
  timer = setInterval(() => {
    void gitSyncTick().catch((e: unknown) => {
      console.warn("[git-sync] 定时同步失败（已静默）", e);
    });
  }, intervalMin * 60_000);
}

/**
 * 启动调度（App onMount 在数据装载完成后调用一次）。
 * 非 Tauri 环境直接返回；未配置仓库地址直接返回。
 */
export async function initSyncSchedule(): Promise<void> {
  if (!persist) return;
  try {
    const cfg = await gitSyncGetConfig();
    if (!cfg.remote) return;

    if (cfg.on_start) {
      void gitSyncOnStart().catch((e: unknown) => {
        console.warn("[git-sync] 启动同步失败（已静默）", e);
      });
    }
    startTimer(cfg.interval_min);
  } catch (e) {
    console.warn("[git-sync] 读取同步配置失败（已静默）", e);
  }
}

/** 保存同步设置后重新排程（先清旧定时器，再按新配置启动；不重复触发启动同步） */
export async function refreshSyncSchedule(): Promise<void> {
  if (!persist) return;
  clearTimer();
  try {
    const cfg = await gitSyncGetConfig();
    if (!cfg.remote) return;
    startTimer(cfg.interval_min);
  } catch (e) {
    console.warn("[git-sync] 重排同步定时器失败（已静默）", e);
  }
}
