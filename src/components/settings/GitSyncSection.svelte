<script lang="ts">
  // 数据同步区（v4.27 §2.15）：GitHub / Gitee 私密仓同步。
  // 从 SettingsPage.svelte 拆出，遵守 CODE-003（组件 ≤300 行）。
  // 令牌三态语义：输入非空 = 写入密钥链 / 「清除已存令牌」传空串 = 清除 / 保存时空输入 = null（保持不动）。
  import { onMount } from "svelte";
  import Icon from "../common/Icon.svelte";
  import {
    persist,
    gitSyncGetConfig,
    gitSyncSetConfig,
    gitSyncNow,
    openUrlHttps,
    type GitPlatform,
  } from "../../lib/tauri-fs";
  import { refreshSyncSchedule } from "../../lib/git-sync-schedule";

  /** 令牌生成页（「获取令牌」按钮目标；GitHub 已预勾 repo 权限） */
  const TOKEN_URL: Record<GitPlatform, string> = {
    github: "https://github.com/settings/tokens/new?scopes=repo&description=CompassZha%20data%20sync",
    gitee: "https://gitee.com/profile/personal_access_tokens",
  };

  /** 定时同步档位（分钟；0 = 关闭），与 Rust 侧白名单一致 */
  const INTERVALS: number[] = [0, 5, 15, 30, 60];

  let platform = $state<GitPlatform>("github");
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
  const remotePlaceholder = $derived(
    isGitee
      ? "https://gitee.com/<你的用户名>/<仓库名>.git"
      : "https://github.com/<用户名>/<仓库名>.git",
  );
  const tokenLabel = $derived(isGitee ? "Gitee 私人令牌" : "GitHub 访问令牌（PAT）");
  const tokenHint = $derived(
    tokenSaved
      ? "已保存——输入新值可替换"
      : isGitee
        ? "Gitee 私人令牌（只存系统凭据管理器，不写任何文件）"
        : "ghp_…（只存系统凭据管理器，不写任何文件）",
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

  /** 打开对应平台的令牌生成页；Tauri 外链失败回退 window.open（沿用 AuthorDialog 范式） */
  async function openTokenPage() {
    const url = TOKEN_URL[platform];
    try {
      await openUrlHttps(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  /** 保存配置。令牌输入为空 → 传 null（保持已存令牌不动）。 */
  async function save() {
    busy = true;
    try {
      const t = token.trim();
      await gitSyncSetConfig(enabled, platform, onStart, intervalMin, remote, branch, t ? t : null);
      token = "";
      await applyCfg();
      await refreshSyncSchedule();
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
      await gitSyncSetConfig(enabled, platform, onStart, intervalMin, remote, branch, "");
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

  {#if !persist}
    <p class="banner">浏览器预览模式 —— 数据同步需在桌面应用内配置（配置步骤见右上角「说明」）</p>
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

    <div class="sub-block">
      <h3 class="sub-title">同步时机</h3>
      <p class="sub-note">
        默认只在「打开软件时」对比本地变更并提交推送一次；下面两项按需开启。三个时机都要求已填仓库地址并保存令牌。
      </p>
      <label class="switch-row">
        <input type="checkbox" bind:checked={onStart} />
        <span>打开软件时同步（本次对比本地变更并提交推送一次）</span>
      </label>
      <label class="switch-row">
        <input type="checkbox" bind:checked={enabled} />
        <span>每次保存后同步（每次本地提交后立即推送）</span>
      </label>
      <label class="field">
        <span class="label">定时同步</span>
        <select
          value={intervalMin}
          onchange={(e) => (intervalMin = Number(e.currentTarget.value))}
        >
          {#each INTERVALS as m (m)}
            <option value={m}>{m === 0 ? "关闭" : `每 ${m} 分钟`}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="field">
      <span class="label">仓库地址（{isGitee ? "Gitee" : "GitHub"} 私密仓，https:// 开头）</span>
      <input type="text" bind:value={remote} placeholder={remotePlaceholder} />
    </label>

    <label class="field">
      <span class="label">同步分支</span>
      <input type="text" bind:value={branch} placeholder="main" />
    </label>

    <label class="field">
      <span class="label">{tokenLabel}</span>
      <input type="password" bind:value={token} placeholder={tokenHint} autocomplete="off" />
    </label>

    <div class="actions">
      <button class="btn-secondary" onclick={() => void openTokenPage()}>获取令牌</button>
      {#if tokenSaved}
        <button class="btn-secondary" onclick={() => void clearToken()} disabled={busy}>
          清除已存令牌
        </button>
      {/if}
    </div>

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
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .head-ico {
    display: inline-flex;
    /* 图标随 currentColor —— 浅色近黑 / 深色近白 */
    color: var(--color-text-primary);
  }

  .banner {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
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
    color: var(--color-danger, #dc2626);
  }

  .sub-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: 8px;
  }

  .sub-title {
    font-size: var(--font-size-sm);
    margin: 0;
  }

  .sub-note {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin: 0;
    line-height: 1.6;
  }
</style>
