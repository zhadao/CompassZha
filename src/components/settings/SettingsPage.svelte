<script lang="ts">
  import { onMount } from "svelte";
  import SettingsHelp from "./SettingsHelp.svelte";
  import AuthorDialog from "./AuthorDialog.svelte";
  import AiConfigSection from "./AiConfigSection.svelte";
  import GitSyncSection from "./GitSyncSection.svelte";
  import Segmented from "../common/Segmented.svelte";
  import Icon from "../common/Icon.svelte";
  import { appearance } from "../../stores/appearance.svelte";
  import type { AccentColor, ColorMode } from "../../lib/theme";
  import {
    gitSyncGetConfig,
    openDataRoot,
    closeBehaviorGet,
    closeBehaviorSet,
    persist,
    exportDataZip,
    exportStamp,
    revealPath,
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
    "配置你自己的 GitHub / Gitee 私密仓同步与 AI（软件不内置任何账号、密钥或仓库地址）；点右上角「说明」查看完整配置步骤。";

  let helpOpen = false;
  let authorOpen = false;
  let dataRoot = "";
  let dirMsg = "";
  let dirErr = false;
  /** v4.25 §2.13：导出总数据（整个数据根 → 「下载」文件夹 zip） */
  let exporting = false;
  let exportPath = "";
  /** v4.22 §2.11-B：关闭窗口行为（ask=每次询问 / exit=退出 / tray=托盘驻留） */
  let closeBehavior: CloseBehavior = "ask";

  onMount(async () => {
    if (!persist) return; // 浏览器预览：无 Tauri 后端，显示预览提示
    try {
      dataRoot = (await gitSyncGetConfig()).data_root;
    } catch (e) {
      dirMsg = `读取数据目录失败：${e}`;
      dirErr = true;
    }
    try {
      closeBehavior = await closeBehaviorGet();
    } catch {
      // 读取失败保持默认 ask
    }
  });

  /** v4.22 §3.1：在资源管理器中打开数据根目录。 */
  async function openDir() {
    dirMsg = "";
    dirErr = false;
    try {
      await openDataRoot();
    } catch (e) {
      dirMsg = `打开失败：${e}`;
      dirErr = true;
    }
  }

  /** v4.25 §2.13：一键导出整个数据根为 zip 到「下载」文件夹。 */
  async function exportZip() {
    exporting = true;
    exportPath = "";
    dirMsg = "";
    dirErr = false;
    try {
      exportPath = await exportDataZip(exportStamp());
      dirMsg = `已导出：${exportPath}`;
    } catch (e) {
      dirMsg = `导出失败：${e}`;
      dirErr = true;
    }
    exporting = false;
  }

  /** 导出反馈中的「打开所在文件夹」：资源管理器定位选中该 zip。 */
  async function revealZip() {
    try {
      await revealPath(exportPath);
    } catch {
      // 打开失败静默
    }
  }

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
    <button class="btn-secondary" onclick={() => (helpOpen = true)}>
      <Icon name="help" size={21} />
      说明
    </button>
  </div>

  <GitSyncSection />

  <AiConfigSection />

  <!-- 窗口（v4.22 §2.11-B）：关闭窗口行为 -->
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

    <p class="block-hint">
      选「最小化到托盘」时程序仍在后台运行：托盘图标左键唤回主窗口，右键可「显示主窗口 / 退出应用」；
      驻留期间隆中对会话不会丢失。
    </p>
  </section>

  <!-- 数据目录（v4.22 §3.1）：全部数据都是普通 Markdown 文件（CODE-008） -->
  <section class="card block">
    <h2 class="block-title">数据</h2>
    <p class="block-hint">
      全部数据都是普通 Markdown 文件（daily 日记 / life 板块 / corpus 语料 / conversations 对话归档 / events 循环事件），
      可用任何编辑器直接打开与备份；各目录用途详见数据根目录下的 README.md。
    </p>

    <div class="field">
      <span class="label">数据目录</span>
      <input type="text" value={persist ? dataRoot || "读取中…" : "（桌面应用内显示）"} disabled />
    </div>

    <div class="actions">
      <button class="btn-secondary" onclick={openDir} disabled={!persist}>
        <Icon name="file" size={21} />
        打开数据目录
      </button>
      <!-- v4.25 §2.13：右下角「导出总数据」——整个 data 文件夹一键打包为 zip -->
      <button class="btn-secondary push-right" onclick={exportZip} disabled={!persist || exporting}>
        {exporting ? "正在打包…" : "导出总数据"}
      </button>
    </div>

    {#if dirMsg}
      <p class="feedback" class:err={dirErr}>
        {dirMsg}
        {#if exportPath}
          <button class="link-btn" onclick={revealZip}>打开所在文件夹</button>
        {/if}
      </p>
    {/if}
  </section>

  <!-- 外观（v4.17）：主题色 / 明暗模式 / 开屏动画，桌面与浏览器预览均可用 -->
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

  <!-- 底部角落：软件作者入口（v4.16） -->
  <div class="author-corner">
    <button class="btn-secondary author-btn" onclick={() => (authorOpen = true)}>软件作者</button>
  </div>

  {#if helpOpen}
    <SettingsHelp onclose={() => (helpOpen = false)} />
  {/if}
  {#if authorOpen}
    <AuthorDialog onclose={() => (authorOpen = false)} />
  {/if}
</div>

<style>
  .page {
    position: relative;
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

  .field input {
    width: 100%;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .feedback {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .feedback.err {
    color: var(--color-danger);
  }

  /* v4.25：数据区操作行右端「导出总数据」（右下角入口） */
  .push-right {
    margin-left: auto;
  }

  /* v4.25：导出反馈行内「打开所在文件夹」文字按钮 */
  .link-btn {
    margin-left: var(--space-2);
    padding: 0;
    font-size: var(--font-size-sm);
    color: var(--color-primary);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
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
