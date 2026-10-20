<script lang="ts">
  // 数据同步区（v4.27 §2.15）：GitHub / Gitee 私密仓同步。
  // 从 SettingsPage.svelte 拆出，遵守 CODE-003（组件 ≤300 行）。
  // 令牌三态语义：输入非空 = 写入密钥链 / 「清除已存令牌」传空串 = 清除 / 保存时空输入 = null（保持不动）。
  // v4.29：新增「认证方式」——auto（默认，交给本机 git，免输入）/ token（注入私人令牌）。
  import { onMount } from "svelte";
  import Icon from "../common/Icon.svelte";
  import GitAuthGuide from "./GitAuthGuide.svelte";
  import GitTimingBlock from "./GitTimingBlock.svelte";
  import {
    persist,
    gitSyncGetConfig,
    gitSyncSetConfig,
    gitSyncNow,
    type GitPlatform,
    type GitAuth,
  } from "../../lib/tauri-fs";
  import { refreshSyncSchedule } from "../../lib/git-sync-schedule";
  import { manual } from "../../stores/manual.svelte";

  let platform = $state<GitPlatform>("github");
  let auth = $state<GitAuth>("auto");
  let onStart = $state(true);
  let enabled = $state(false);
  let intervalMin = $state(0);
  let remote = $state("");
  let branch = $state("main");
  let token = $state("");
  let tokenSaved = $state(false);
  let lastSync = $state<number | null>(null);
  let loaded = $state(false);
  let busy = $state(false);
  let feedback = $state("");
  let feedbackErr = $state(false);

  const isGitee = $derived(platform === "gitee");
  const isAuto = $derived(auth === "auto");
  const hostLabel = $derived(isGitee ? "Gitee" : "GitHub");
  const remotePlaceholder = $derived(
    isGitee
      ? "https://gitee.com/<你的用户名>/<仓库名>.git"
      : "https://github.com/<用户名>/<仓库名>.git",
  );
  const fmtTime = (secs: number | null): string =>
    secs == null ? "从未同步" : new Date(secs * 1000).toLocaleString("zh-CN");

  function notice(text: string, err = false) {
    feedback = text;
    feedbackErr = err;
  }

  async function applyCfg() {
    const cfg = await gitSyncGetConfig();
    platform = cfg.platform;
    auth = cfg.auth;
    onStart = cfg.on_start;
    enabled = cfg.enabled;
    intervalMin = cfg.interval_min;
    remote = cfg.remote;
    branch = cfg.branch;
    tokenSaved = cfg.token_saved;
    lastSync = cfg.last_sync;
  }

  onMount(async () => {
    if (!persist) return;
    try {
      await applyCfg();
    } catch (e) {
      notice(`读取配置失败：${e}`, true);
    }
    loaded = true;
  });

  /**
   * 保存配置。令牌输入为空 → 传 null（保持已存令牌不动）。
   * v4.40 C-2：抽成「不吞异常」的内核，供「测试并保存」复用（失败需回显在引导区）。
   */
  async function saveSilently(): Promise<void> {
    const t = token.trim();
    await gitSyncSetConfig(enabled, platform, auth, onStart, intervalMin, remote, branch, t ? t : null);
    token = "";
    await applyCfg();
    await refreshSyncSchedule();
  }

  /** 「保存配置」按钮：保存并把结果写进本区反馈行 */
  async function save() {
    busy = true;
    try {
      await saveSilently();
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
      await applyCfg();
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  /** 清除已存令牌（传空串 = 清除密钥链条目）。 */
  async function clearToken() {
    busy = true;
    try {
      await gitSyncSetConfig(enabled, platform, auth, onStart, intervalMin, remote, branch, "");
      token = "";
      tokenSaved = false;
      notice("令牌已从系统凭据管理器清除");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }
</script>

<section class="card block">
  <div class="block-head">
    <h2 class="block-title">数据同步（GitHub / Gitee 私密仓）</h2>
    <span class="head-ico" title="数据同步到你自己的 GitHub 或 Gitee 私密仓库">
      <Icon name="github" size={24} />
    </span>
  </div>

  <p class="banner">同步是可选的：不配也能正常用，数据都存在本机。想让数据多设备同步时再来配。</p>

  {#if !persist}
    <p class="banner">浏览器预览模式 —— 数据同步需在桌面应用内配置（步骤见右上角「说明书」）</p>
  {:else if !loaded}
    <p class="banner">正在读取配置…</p>
  {:else}
    <label class="field">
      <span class="label">同步平台</span>
      <select
        value={platform}
        onchange={(e) => (platform = e.currentTarget.value as GitPlatform)}
      >
        <option value="github">GitHub</option>
        <option value="gitee">Gitee（国内网络更顺畅）</option>
      </select>
    </label>

    <label class="field">
      <span class="label">认证方式</span>
      <select value={auth} onchange={(e) => (auth = e.currentTarget.value as GitAuth)}>
        <option value="auto">自动（交给系统，免输入）</option>
        <option value="token">私人令牌</option>
      </select>
    </label>

    <p class="sub-note">
      拿不定主意就选「自动」。
      <button class="link-btn" onclick={() => manual.openManual()}>详见说明书</button>
    </p>

    <GitAuthGuide
      {platform}
      {auth}
      {remote}
      {tokenSaved}
      {busy}
      bind:token
      onSaveTest={saveSilently}
      onClearToken={() => void clearToken()}
    />

    <GitTimingBlock bind:onStart bind:enabled bind:intervalMin {isAuto} />

    <label class="field">
      <span class="label">仓库地址（{hostLabel} 私密仓，https:// 或 SSH 形式）</span>
      <input type="text" bind:value={remote} placeholder={remotePlaceholder} />
    </label>

    <label class="field">
      <span class="label">同步分支</span>
      <input type="text" bind:value={branch} placeholder="main" />
    </label>

    <p class="sync-status">上次同步：{fmtTime(lastSync)}</p>

    <div class="actions">
      <button class="btn-primary" onclick={() => void save()} disabled={busy}>保存配置</button>
      <button class="btn-secondary" onclick={() => void syncNow()} disabled={busy}>立即同步</button>
    </div>

    {#if feedback}
      <p class="feedback" class:err={feedbackErr}>{feedback}</p>
    {/if}
  {/if}
</section>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 560px;
  }
  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .block-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
  }
  /* 图标随 currentColor —— 浅色近黑 / 深色近白 */
  .head-ico {
    display: inline-flex;
    color: var(--color-text-primary);
  }
  .banner {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field input {
    width: 100%;
  }
  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .sync-status {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  .feedback {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .feedback.err {
    color: var(--color-danger);
  }
  .link-btn {
    padding: 0;
    margin-left: var(--space-1);
    background: none;
    border: none;
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    cursor: pointer;
    text-decoration: underline;
    white-space: nowrap;
  }
</style>
