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

/* ---- GitHub 私密仓同步（v4.10；PAT 只存系统凭据管理器，绝不回传前端） ---- */

/** git_sync_get_config 返回的同步配置（token_saved=true 表示密钥链已存 PAT） */
export interface GitSyncConfig {
  enabled: boolean;
  remote: string;
  branch: string;
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
  remote: string,
  branch: string,
  token: string | null,
): Promise<void> =>
  invoke<void>("git_sync_set_config", { enabled, remote, branch, token });

/** 立即同步（本地提交 + 推送 + 记 last_sync） */
export const gitSyncNow = (): Promise<string> =>
  invoke<string>("git_sync_now");

/** 用系统默认浏览器打开 https 链接（v4.16：「软件作者」弹窗外链）。 */
export const openUrlHttps = (url: string): Promise<void> =>
  invoke<void>("open_url_https", { url });
