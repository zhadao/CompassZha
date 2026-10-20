<script lang="ts">
  import { onMount } from "svelte";
  import Manual from "../manual/Manual.svelte";
  import ManualButton from "../manual/ManualButton.svelte";
  import { manual } from "../../stores/manual.svelte";
  import AuthorDialog from "./AuthorDialog.svelte";
  import AiConfigSection from "./AiConfigSection.svelte";
  import GitSyncSection from "./GitSyncSection.svelte";
  import DataSection from "./DataSection.svelte";
  import CalendarSlotSection from "./CalendarSlotSection.svelte";
  import TrackerSection from "./TrackerSection.svelte";
  import BriefingSection from "./BriefingSection.svelte";
  import SettingsToc from "./SettingsToc.svelte";
  import Segmented from "../common/Segmented.svelte";
  import { appearance } from "../../stores/appearance.svelte";
  import type { AccentColor, ColorMode } from "../../lib/theme";
  import {
    closeBehaviorGet,
    closeBehaviorSet,
    persist,
    type CloseBehavior,
  } from "../../lib/tauri-fs";

  /** 主题色四色卡（0% 基础色，出自 color.md 色卡） */
  const ACCENTS: Array<{ value: AccentColor; label: string; hex: string }> = [
    { value: "blue", label: "蓝", hex: "#1761b9" },
    { value: "red", label: "红", hex: "#f6beca" },
    { value: "yellow", label: "黄", hex: "#ebd014" },
    { value: "green", label: "绿", hex: "#5ab002" },
  ];

  const purpose =
    "软件开箱即用，不需要先配置。想让数据多设备同步、想用「隆中对」时，再来配（不内置任何账号、密钥或仓库地址）；完整教程见右上角「说明书」。";

  let authorOpen = $state(false);
  /** v4.22 §2.11-B：关闭窗口行为（ask=每次询问 / exit=退出 / tray=托盘驻留） */
  let closeBehavior = $state<CloseBehavior>("ask");

  onMount(async () => {
    if (!persist) return; // 浏览器预览：无 Tauri 后端，显示预览提示
    try {
      closeBehavior = await closeBehaviorGet();
    } catch {
      // 读取失败保持默认 ask
    }
  });

  /** v4.22 §2.11-B：切换关闭窗口行为（立即写 config.json）。 */
  async function setCloseBehavior(v: CloseBehavior) {
    const prev = closeBehavior;
    closeBehavior = v;
    try {
      await closeBehaviorSet(v);
    } catch (e) {
      closeBehavior = prev; // 写入失败回退显示，避免界面与配置不一致
      console.warn("[settings] 写入关闭行为失败（已静默）", e);
    }
  }
</script>

<div class="page">
  <div class="head">
    <p class="purpose">{purpose}</p>
    <ManualButton />
  </div>

  <div class="body">
    <!-- R-3：左侧目录（点击平滑跳转、滚动自动高亮当前区块） -->
    <SettingsToc />

    <div class="content">
      <div id="sec-git" class="anchor"><GitSyncSection /></div>

      <div id="sec-ai" class="anchor"><AiConfigSection /></div>

      <!-- 窗口（v4.22 §2.11-B）：关闭窗口行为 -->
      <div id="sec-window" class="anchor">
        <section class="card block">
          <h2 class="block-title">窗口</h2>

          <label class="field">
            <span class="label">关闭窗口时的行为</span>
            <select
              value={closeBehavior}
              disabled={!persist}
              onchange={(e) => void setCloseBehavior(e.currentTarget.value as CloseBehavior)}
            >
              <option value="ask">每次询问</option>
              <option value="exit">直接退出</option>
              <option value="tray">最小化到托盘</option>
            </select>
          </label>

          <p class="block-hint">选「最小化到托盘」后程序在后台驻留：托盘图标左键唤回、右键「显示主窗口 / 退出」。</p>
        </section>
      </div>

      <!-- 数据目录 / 导出总数据（v4.22 §3.1 / v4.25 §2.13） -->
      <div id="sec-data" class="anchor"><DataSection /></div>

      <!-- 外观（v4.17）：主题色 / 明暗模式 / 开屏动画，桌面与浏览器预览均可用 -->
      <div id="sec-appearance" class="anchor">
        <section class="card block">
          <h2 class="block-title">外观</h2>

          <div class="field">
            <span class="label">主题色</span>
            <div class="accent-row" role="radiogroup" aria-label="主题色">
              {#each ACCENTS as a (a.value)}
                <button
                  class="accent-dot"
                  class:active={appearance.prefs.accent === a.value}
                  style:background-color={a.hex}
                  title={a.label}
                  aria-label={a.label}
                  aria-checked={appearance.prefs.accent === a.value}
                  role="radio"
                  onclick={() => appearance.setAccent(a.value)}
                ></button>
              {/each}
            </div>
          </div>

          <div class="field">
            <span class="label">明暗模式</span>
            <Segmented
              ariaLabel="明暗模式"
              options={[
                { value: "light", label: "浅色" },
                { value: "dark", label: "深色" },
              ]}
              value={appearance.prefs.mode}
              onchange={(v) => appearance.setMode(v as ColorMode)}
            />
          </div>

          <label class="switch-row">
            <input
              type="checkbox"
              checked={appearance.prefs.splash}
              onchange={(e) => appearance.setSplash(e.currentTarget.checked)}
            />
            <span>启动时播放开屏动画（约 3.5 秒，可跳过；下次启动生效）</span>
          </label>
        </section>
      </div>

      <!-- 日历（阶段 1 · A-4）：时间轴常用时段 -->
      <div id="sec-calendar" class="anchor"><CalendarSlotSection /></div>

      <!-- 数据追踪（E-1 v4.41）：内置项显隐 + 自定义指标增删改 -->
      <div id="sec-tracker" class="anchor"><TrackerSection /></div>

      <!-- 每周罗盘简报（E-2 v4.44）：开关 + 周几 + 时间 + 立即预览 -->
      <div id="sec-briefing" class="anchor"><BriefingSection /></div>

      <!-- 底部角落：软件作者入口（v4.16） -->
      <div class="author-corner">
        <button class="btn-secondary author-btn" onclick={() => (authorOpen = true)}>软件作者</button>
      </div>
    </div>
  </div>

  {#if manual.open}
    <Manual onclose={() => manual.closeManual()} />
  {/if}
  {#if authorOpen}
    <AuthorDialog onclose={() => (authorOpen = false)} />
  {/if}
</div>

<style>
  .page {
    position: relative;
  }

  /* R-3：左目录 + 右内容两列；目录 sticky 常驻 */
  .body {
    display: flex;
    gap: var(--space-5);
    align-items: flex-start;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  /* 目录跳转落点：留一点上边距，避免区块贴住滚动区顶边 */
  .anchor {
    scroll-margin-top: var(--space-3);
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    max-width: 560px;
    margin-bottom: var(--space-2);
  }

  .purpose {
    flex: 1;
    min-width: 0; /* 允许说明文字先换行让位，别把右侧按钮挤成竖排 */
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin: 0;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 560px;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
  }

  .accent-row {
    display: flex;
    gap: var(--space-2);
  }

  .accent-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--color-surface);
    outline: 1px solid var(--color-border-strong);
    transition: outline-color var(--transition-fast), transform var(--transition-fast);
  }

  .accent-dot:hover {
    transform: scale(1.1);
  }

  .accent-dot.active {
    outline: 2px solid var(--color-text-primary);
    outline-offset: 1px;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .author-corner {
    display: flex;
    justify-content: flex-end;
    max-width: 560px;
    margin-top: var(--space-4);
  }

  .author-btn {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    opacity: 0.75;
  }

  .author-btn:hover {
    opacity: 1;
  }
</style>
