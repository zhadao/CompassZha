/**
 * E-3「此刻最该动的一件事」候选打分（纯函数 · TEST-001）。
 *
 * 只做「挑一条」的判断，不碰 store、不碰 DOM，便于单测：
 *   1) 停滞板块（≥14 天无留痕，与 D-6 同一口径）优先，多条时取**停滞天数最大**的一条；
 *   2) 其次为今日未完成清单的**第一条**（保持用户自己排的先后）；
 *   3) 两者皆无 → 返回 null，由调用方给出结束语（不报错、不出现「没有可做的」死路）。
 */

import { stripAllGoalTags } from "./markdown";

/** 停滞判定阈值（天），与 store 的 STALL_DAYS / D-6 一致 */
export const STALL_MIN_DAYS = 14;

/** 候选输入：一个板块（`daysSinceTrace` 为 null = 从未留痕，无痕迹不判停滞） */
export interface FocusBoardInput {
  name: string;
  daysSinceTrace: number | null;
}

/** 候选输入：一条今日任务 */
export interface FocusTaskInput {
  text: string;
  done: boolean;
}

/** 挑出的一条：`kind` 用于外面决定文案，`title` 直接作为正计时标题 */
export interface FocusPick {
  kind: "board" | "task";
  /** 正计时标题（板块名 / 去标签后的任务文本） */
  title: string;
  /** 一句话理由（展示给用户） */
  reason: string;
}

/** 都没有可做时的结束语（不报错、不引导继续找） */
export function focusClosing(): string {
  return "今天没有非做不可的事，休息也是一种推进。";
}

/**
 * 选一条「此刻最该动的」：停滞板块 → 今日未完成任务 → null。
 * 纯函数：同输入同输出，不读时间、不读 store（调用方把今天算好的数据传进来）。
 */
export function pickFocus(
  boards: FocusBoardInput[],
  tasks: FocusTaskInput[],
): FocusPick | null {
  let bestName = "";
  let bestDays = -1;
  for (const b of boards) {
    const d = b.daysSinceTrace;
    if (d === null || d < STALL_MIN_DAYS) continue;
    if (d > bestDays) {
      bestDays = d;
      bestName = b.name;
    }
  }
  if (bestName) {
    return {
      kind: "board",
      title: bestName,
      reason: `「${bestName}」已经 ${bestDays} 天没有痕迹了`,
    };
  }

  const first = tasks.find((t) => !t.done);
  if (first) {
    const text = stripAllGoalTags(first.text).trim();
    if (text) {
      return {
        kind: "task",
        title: text,
        reason: "今日清单里还没动的一条，先开个头",
      };
    }
  }
  return null;
}
