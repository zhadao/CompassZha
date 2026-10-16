/**
 * Tauri fs 接缝层（前端侧）。
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

/** 本地 git 自动提交（保存动作防抖后触发，纯本地，不推送） */
export const gitAutoCommit = (msg: string): Promise<string> =>
  invoke<string>("git_auto_commit", { msg });

/** 每日文件相对路径：daily/yyyy/yyyy-mm-dd.md */
export function dailyRel(date: string): string {
  return `daily/${date.slice(0, 4)}/${date}.md`;
}

/** 板块默认文件相对路径：life/<板块名>/<板块名>.md */
export function boardDefaultRel(boardName: string): string {
  return `life/${boardName}/${boardName}.md`;
}
