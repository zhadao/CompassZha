<script lang="ts">
  import { onMount } from "svelte";
  import StaticBadge from "../layout/StaticBadge.svelte";
  import SettingsHelp from "./SettingsHelp.svelte";
  import {
    gitSyncGetConfig,
    gitSyncSetConfig,
    gitSyncNow,
    persist,
    type GitSyncConfig,
  } from "../../lib/tauri-fs";

  const purpose =
    "配置你自己的 GitHub 私密仓同步与 AI（软件不内置任何账号、密钥或仓库地址）；点右上角「说明」查看完整配置步骤。";

  let enabled = false;
  let helpOpen = false;
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
</script>

<div class="page">
  <StaticBadge />
  <div class="head">
    <p class="purpose">{purpose}</p>
    <button class="btn-secondary" onclick={() => (helpOpen = true)}>说明</button>
  </div>

  {#if !persist}
    <div class="banner">
      🌐 浏览器预览模式 —— GitHub 同步需在桌面应用内配置（配置步骤见右上角「说明」）
    </div>
  {:else if !loaded}
    <div class="banner">正在读取配置…</div>
  {:else}
    <section class="card block">
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

      <label class="field">
        <span class="label">数据目录（只读 —— daily/ life/ corpus/ 的根目录）</span>
        <input type="text" value={dataRoot} disabled />
      </label>

      <p class="sync-status">上次同步：{fmtTime(lastSync)}</p>

      <div class="actions">
        <button class="btn-primary" onclick={save} disabled={busy}>保存配置</button>
        <button class="btn-secondary" onclick={syncNow} disabled={busy}>立即同步</button>
      </div>

      {#if feedback}
        <p class="feedback" class:err={feedbackErr}>{feedback}</p>
      {/if}
    </section>
  {/if}

  {#if helpOpen}
    <SettingsHelp onclose={() => (helpOpen = false)} />
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
    color: var(--color-danger, #dc2626);
  }
</style>
