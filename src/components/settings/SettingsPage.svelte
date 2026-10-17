<script lang="ts">
  import { onMount } from "svelte";
  import SettingsHelp from "./SettingsHelp.svelte";
  import AuthorDialog from "./AuthorDialog.svelte";
  import AiConfigSection from "./AiConfigSection.svelte";
  import Segmented from "../common/Segmented.svelte";
  import Icon from "../common/Icon.svelte";
  import { appearance } from "../../stores/appearance.svelte";
  import type { AccentColor, ColorMode } from "../../lib/theme";
  import {
    gitSyncGetConfig,
    gitSyncSetConfig,
    gitSyncNow,
    openDataRoot,
    closeBehaviorGet,
    closeBehaviorSet,
    persist,
    type CloseBehavior,
    type GitSyncConfig,
  } from "../../lib/tauri-fs";

  /** 主题色四色卡（0% 基础色，出自 color.md 色卡） */
  const ACCENTS: Array<{ value: AccentColor; label: string; hex: string }> = [
    { value: "blue", label: "蓝", hex: "#1761b9" },
    { value: "red", label: "红", hex: "#f6beca" },
    { value: "yellow", label: "黄", hex: "#ebd014" },
    { value: "green", label: "绿", hex: "#5ab002" },
  ];

  const purpose =
    "配置你自己的 GitHub 私密仓同步与 AI（软件不内置任何账号、密钥或仓库地址）；点右上角「说明」查看完整配置步骤。";

  let enabled = false;
  let helpOpen = false;
  let authorOpen = false;
  let remote = "";
  let branch = "main";
  let token = "";
  let tokenSaved = false;
  let lastSync: number | null = null;
  let dataRoot = "";
  let loaded = false;
  let busy = false;
  let feedback = "";
  let feedbackErr = false;
  let dirMsg = "";
  let dirErr = false;
  /** v4.22 §2.11-B：关闭窗口行为（ask=每次询问 / exit=退出 / tray=托盘驻留） */
  let closeBehavior: CloseBehavior = "ask";

  const fmtTime = (secs: number | null): string =>
    secs == null ? "从未同步" : new Date(secs * 1000).toLocaleString("zh-CN");

  function applyCfg(cfg: GitSyncConfig) {
    enabled = cfg.enabled;
    remote = cfg.remote;
    branch = cfg.branch;
    tokenSaved = cfg.token_saved;
    lastSync = cfg.last_sync;
    dataRoot = cfg.data_root;
  }

  function notice(text: string, err = false) {
    feedback = text;
    feedbackErr = err;
  }

  onMount(async () => {
    if (!persist) return; // 浏览器预览：无 Tauri 后端，显示预览提示
    try {
      applyCfg(await gitSyncGetConfig());
    } catch (e) {
      notice(`读取配置失败：${e}`, true);
    }
    try {
      closeBehavior = await closeBehaviorGet();
    } catch {
      // 读取失败保持默认 ask
    }
    loaded = true;
  });

  /** 保存配置。令牌输入为空 → 传 null（保持已存 PAT 不动）。 */
  async function save() {
    busy = true;
    try {
      const t = token.trim();
      await gitSyncSetConfig(enabled, remote, branch, t ? t : null);
      token = "";
      applyCfg(await gitSyncGetConfig());
      notice("配置已保存");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  /** 立即同步：本地提交 + 推送。 */
  async function syncNow() {
    busy = true;
    try {
      notice(await gitSyncNow());
      applyCfg(await gitSyncGetConfig());
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  /** 清除已存令牌（传空串 = 清除密钥链条目）。 */
  async function clearToken() {
    busy = true;
    try {
      await gitSyncSetConfig(enabled, remote, branch, "");
      token = "";
      tokenSaved = false;
      notice("令牌已从系统凭据管理器清除");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

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

  /** v4.22 §2.11-B：切换关闭窗口行为（立即写 config.json）。 */
  async function setCloseBehavior(v: CloseBehavior) {
    closeBehavior = v;
    try {
      await closeBehaviorSet(v);
    } catch (e) {
      notice(`${e}`, true);
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

  {#if !persist}
    <div class="banner">
      浏览器预览模式 —— GitHub 同步需在桌面应用内配置（配置步骤见右上角「说明」）
    </div>
  {:else if !loaded}
    <div class="banner">正在读取配置…</div>
  {:else}
    <section class="card block">
      <div class="block-head">
        <h2 class="block-title">GitHub 私密仓同步</h2>
        <span class="head-ico" title="数据同步到你自己的 GitHub 私密仓库">
          <Icon name="github" size={24} />
        </span>
      </div>

      <label class="switch-row">
        <input type="checkbox" bind:checked={enabled} />
        <span>开启自动同步（每次本地提交后自动推送到 GitHub）</span>
      </label>

      <label class="field">
        <span class="label">仓库地址（GitHub 私密仓，https:// 开头）</span>
        <input
          type="text"
          bind:value={remote}
          placeholder="https://github.com/<用户名>/<仓库名>.git"
        />
      </label>

      <label class="field">
        <span class="label">同步分支</span>
        <input type="text" bind:value={branch} placeholder="main" />
      </label>

      <label class="field">
        <span class="label">GitHub 访问令牌（PAT）</span>
        <input
          type="password"
          bind:value={token}
          placeholder={tokenSaved
            ? "已保存——输入新值可替换"
            : "ghp_…（只存系统凭据管理器，不写任何文件）"}
          autocomplete="off"
        />
      </label>
      {#if tokenSaved}
        <button class="btn-secondary clear-btn" onclick={clearToken} disabled={busy}>
          清除已存令牌
        </button>
      {/if}

      <p class="sync-status">上次同步：{fmtTime(lastSync)}</p>

      <div class="actions">
        <button class="btn-primary" onclick={save} disabled={busy}>保存配置</button>
        <button class="btn-secondary" onclick={syncNow} disabled={busy}>立即同步</button>
      </div>

      {#if feedback}
        <p class="feedback" class:err={feedbackErr}>{feedback}</p>
      {/if}
    </section>

    <AiConfigSection />
  {/if}

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
    </div>

    {#if dirMsg}
      <p class="feedback" class:err={dirErr}>{dirMsg}</p>
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

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
  }

  .head-ico {
    display: inline-flex;
    /* v4.19：图标随 currentColor —— 浅色近黑 / 深色近白，保证 GitHub 标志深色下清晰 */
    color: var(--color-text-primary);
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

  .banner {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    max-width: 560px;
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

  .clear-btn {
    align-self: flex-start;
  }

  .sync-status {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin: 0;
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
