<script lang="ts">
  // AI 配置区（阶段 4 · 检查点 4.5）：DeepSeek 直连设置。
  // API key 三态语义同 GitHub PAT：输入非空=写入 / 清除按钮=空串 / 保存时空输入=null（不动）。
  import { onMount } from "svelte";
  import { persist } from "../../lib/tauri-fs";
  import { aiGetConfig, aiSetConfig } from "../../lib/ai";

  let baseUrl = $state("https://api.deepseek.com");
  let model = $state("deepseek-chat");
  let key = $state("");
  let keySaved = $state(false);
  let corpusDir = $state("");
  let loaded = $state(false);
  let busy = $state(false);
  let feedback = $state("");
  let feedbackErr = $state(false);

  function notice(text: string, err = false) {
    feedback = text;
    feedbackErr = err;
  }

  onMount(async () => {
    if (!persist) return;
    try {
      const cfg = await aiGetConfig();
      baseUrl = cfg.base_url;
      model = cfg.model;
      keySaved = cfg.key_saved;
      corpusDir = cfg.corpus_dir;
    } catch (e) {
      notice(`读取 AI 配置失败：${e}`, true);
    }
    loaded = true;
  });

  async function save() {
    busy = true;
    try {
      const k = key.trim();
      await aiSetConfig(baseUrl, model, k ? k : null);
      key = "";
      const cfg = await aiGetConfig();
      keySaved = cfg.key_saved;
      notice("AI 配置已保存");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  async function clearKey() {
    busy = true;
    try {
      await aiSetConfig(baseUrl, model, "");
      key = "";
      keySaved = false;
      notice("API Key 已从系统凭据管理器清除");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }
</script>

<section class="card block">
  <h2 class="section-title">AI 配置（语料对话用）</h2>

  {#if !persist}
    <p class="muted">浏览器预览模式 —— AI 配置需在桌面应用内进行</p>
  {:else if !loaded}
    <p class="muted">正在读取配置…</p>
  {:else}
    <label class="field">
      <span class="label">DeepSeek API Key（只存系统凭据管理器，不写任何文件）</span>
      <input
        type="password"
        bind:value={key}
        placeholder={keySaved ? "已保存——输入新值可替换" : "sk-…（DeepSeek 官网 → API Keys 创建）"}
        autocomplete="off"
      />
    </label>
    {#if keySaved}
      <button class="btn-secondary clear-btn" onclick={() => void clearKey()} disabled={busy}>
        清除已存 Key
      </button>
    {/if}

    <label class="field">
      <span class="label">接口地址（一般无需改动）</span>
      <input type="text" bind:value={baseUrl} />
    </label>

    <label class="field">
      <span class="label">模型（一般无需改动）</span>
      <input type="text" bind:value={model} />
    </label>

    <label class="field">
      <span class="label">语料文件夹（对话检索范围——放 Markdown 即成语料；日记不参与）</span>
      <input type="text" value={corpusDir} disabled />
    </label>

    <div class="actions">
      <button class="btn-primary" onclick={() => void save()} disabled={busy}>保存配置</button>
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

  .section-title {
    font-size: var(--font-size-md);
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .muted {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin: 0;
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
