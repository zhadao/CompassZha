/**
 * 外观状态（v4.17）：accent / mode / splash 三键，变更即时写 DOM + 持久化。
 * - 桌面：写 config.json（Rust appearance_set，异步静默）；
 * - 浏览器预览：退化为 localStorage；
 * - 启动时 init() 以 config.json 覆盖 localStorage 快照（后者已由 main.ts 预应用防闪白）。
 */

import {
  applyAppearance,
  coerceAppearance,
  DEFAULT_APPEARANCE,
  readAppearanceLocal,
  writeAppearanceLocal,
  type AccentColor,
  type AppearancePrefs,
  type ColorMode,
} from "../lib/theme";
import { appearanceGet, appearanceSet, persist } from "../lib/tauri-fs";

class AppearanceStore {
  prefs = $state<AppearancePrefs>({ ...DEFAULT_APPEARANCE });

  /** 启动装载：桌面以 config.json 为准；浏览器预览用 localStorage 快照 */
  async init(): Promise<void> {
    if (persist) {
      try {
        const cfg = await appearanceGet();
        this.prefs = coerceAppearance(cfg);
      } catch {
        this.prefs = readAppearanceLocal();
      }
    } else {
      this.prefs = readAppearanceLocal();
    }
    applyAppearance(this.prefs);
    writeAppearanceLocal(this.prefs);
  }

  /** 更新任意子集：即时生效 + 双写（DOM、localStorage、config.json） */
  async update(patch: Partial<AppearancePrefs>): Promise<void> {
    this.prefs = { ...this.prefs, ...patch };
    applyAppearance(this.prefs);
    writeAppearanceLocal(this.prefs);
    if (persist) {
      try {
        await appearanceSet(this.prefs);
      } catch {
        /* 配置写失败静默：界面已生效，下次成功保存补写 */
      }
    }
  }

  setAccent(accent: AccentColor): Promise<void> {
    return this.update({ accent });
  }

  setMode(mode: ColorMode): Promise<void> {
    return this.update({ mode });
  }

  setSplash(splash: boolean): Promise<void> {
    return this.update({ splash });
  }
}

export const appearance = new AppearanceStore();
