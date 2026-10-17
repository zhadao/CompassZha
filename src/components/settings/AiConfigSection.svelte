<script lang="ts">
  // AI 配置区（阶段 4 · 检查点 4.5）：DeepSeek 直连设置。
  // API key 三态语义同 GitHub PAT：输入非空=写入 / 清除按钮=空串 / 保存时空输入=null（不动）。
  // v4.15 双 API：数据分析对话可单独接一个 API（提升缓存命中率），不填则回落共用主 API。
  import { onMount } from "svelte";
  import { persist, openUrlHttps } from "../../lib/tauri-fs";
  import { aiGetConfig, aiSetConfig } from "../../lib/ai";
  import Icon from "../common/Icon.svelte";
  import { manual } from "../../stores/manual.svelte";

  /** DeepSeek 开放平台文档（「DeepSeek 开放平台」按钮目标，v4.27 §2.15-D4） */
  const DEEPSEEK_DOCS = "https://api-docs.deepseek.com/zh-cn/";

  let baseUrl = $state("https://api.deepseek.com");
  let model = $state("deepseek-chat");
  let key = $state("");
  let keySaved = $state(false);
  let corpusDir = $state("");
  let dataBaseUrl = $state("");
  let dataModel = $state("");
  let dataKey = $state("");
  let dataKeySaved = $state(false);
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
      dataBaseUrl = cfg.data_base_url;
      dataModel = cfg.data_model;
      dataKeySaved = cfg.data_key_saved;
    } catch (e) {
      notice(`读取 AI 配置失败：${e}`, true);
    }
    loaded = true;
  });

  async function save() {
    busy = true;
    try {
      const k = key.trim();
      const dk = dataKey.trim();
      await aiSetConfig(
        baseUrl,
        model,
        k ? k : null,
        dataBaseUrl, // 空串=清除回落主 API（用户明确操作），始终提交
        dataModel,
        dk ? dk : null,
      );
      key = "";
      dataKey = "";
      const cfg = await aiGetConfig();
      keySaved = cfg.key_saved;
      dataKeySaved = cfg.data_key_saved;
      dataBaseUrl = cfg.data_base_url;
      dataModel = cfg.data_model;
      notice("AI 配置已保存");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  async function clearKey() {
    busy = true;
    try {
      await aiSetConfig(baseUrl, model, "", null, null, null);
      key = "";
      keySaved = false;
      notice("API Key 已从系统凭据管理器清除");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  async function clearDataKey() {
    busy = true;
    try {
      await aiSetConfig(baseUrl, model, null, null, null, "");
      dataKey = "";
      dataKeySaved = false;
      notice("数据分析 API Key 已清除");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }

  /** 打开 DeepSeek 开放平台文档；Tauri 外链失败回退 window.open（沿用 AuthorDialog 范式） */
  async function openDeepSeekDocs() {
    try {
      await openUrlHttps(DEEPSEEK_DOCS);
    } catch {
      window.open(DEEPSEEK_DOCS, "_blank");
    }
  }
</script>

<section class="card block">
  <div class="block-head">
    <h2 class="section-title">AI 配置（隆中对用）</h2>
    <span class="head-ico" title="隆中使用你自己的 DeepSeek API">
      <Icon name="ai" size={24} />
    </span>
  </div>

  {#if !persist}
    <p class="muted">浏览器预览模式 —— AI 配置需在桌面应用内进行</p>
  {:else if !loaded}
    <p class="muted">正在读取配置…</p>
  {:else}
    <label class="field">
      <span class="label-row">
        <span class="label">DeepSeek API Key（只存系统凭据管理器，不写任何文件）</span>
        <button class="link-btn" onclick={() => void openDeepSeekDocs()}>DeepSeek 开放平台</button>
      </span>
      <input
        type="password"
        bind:value={key}
        placeholder={keySaved ? "已保存——输入新值可替换" : "sk-…（DeepSeek 官网 → API Keys 创建）"}
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span class="label">接口地址（一般无需改动）</span>
      <input type="text" bind:value={baseUrl} />
    </label>
    <p class="sub-note">
      接口地址／模型可自由修改——凡兼容 OpenAI 协议的服务都能用（Kimi、百炼、智谱、硅基流动、OpenAI、本地 Ollama…）。
      <button class="link-btn" onclick={() => manual.openManual()}>详见说明书</button>
    </p>
    {#if keySaved}
      <button class="btn-secondary clear-btn" onclick={() => void clearKey()} disabled={busy}>
        清除已存 Key
      </button>
    {/if}

    <label class="field">
      <span class="label">模型（一般无需改动）</span>
      <input type="text" bind:value={model} />
    </label>

    <label class="field">
      <span class="label">语料文件夹（对话检索范围——放 Markdown 即成语料；日记不参与）</span>
      <input type="text" value={corpusDir} disabled />
    </label>

    <div class="sub-block">
      <h3 class="sub-title">数据分析 API（可选 · 仪表盘「AI 数据分析」用）</h3>
      <p class="sub-note">
        可单独再配一个 API，与隆中对分开、各提升缓存命中率；只有一个 API 时留空即与上方共用。
      </p>
      <label class="field">
        <span class="label">数据分析 API Key（只存系统凭据管理器）</span>
        <input
          type="password"
          bind:value={dataKey}
          placeholder={dataKeySaved ? "已保存——输入新值可替换" : "留空 = 与上方主 API 共用"}
          autocomplete="off"
        />
      </label>
      {#if dataKeySaved}
        <button class="btn-secondary clear-btn" onclick={() => void clearDataKey()} disabled={busy}>
          清除数据分析 Key
        </button>
      {/if}

      <label class="field">
        <span class="label">数据分析接口地址（留空 = 共用上方接口地址）</span>
        <input type="text" bind:value={dataBaseUrl} placeholder="留空与主 API 共用" />
      </label>

      <label class="field">
        <span class="label">数据分析模型（留空 = 共用上方模型）</span>
        <input type="text" bind:value={dataModel} placeholder="留空与主 API 共用" />
      </label>
    </div>

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

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .section-title {
    font-size: var(--font-size-md);
    margin: 0;
  }

  .head-ico {
    display: inline-flex;
    /* v4.19：图标随 currentColor —— 浅色近黑 / 深色近白 */
    color: var(--color-text-primary);
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

  /* v4.27：label 旁的直达按钮（DeepSeek 开放平台） */
  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .link-btn {
    padding: 0;
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    white-space: nowrap;
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
