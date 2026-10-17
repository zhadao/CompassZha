<script lang="ts">
  // 隆中对分区（原「语料对话」，v4.20 更名；阶段 4 · 检查点 4.4，v4.12 内嵌自研轻量路线）：
  // 问题 → AI 扩词选卡 → 本地检索 corpus/ → 以语料为基础回答并标注出处（材料不足时兜底提示）。
  // 首版非流式（等待期间显示「思考中」）；对话历史为会话内内存态。
  // v4.22 §2.12：工具栏「保存本轮对话」把整轮对话归档为 conversations/*.md。
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { persist, fsReveal, revealPath } from "../../lib/tauri-fs";
  import {
    aiGetConfig,
    aiAsk,
    openCorpusFolder,
    pickCorpusFiles,
    importCorpusFile,
    type ChatMsg,
    type ImportResult,
  } from "../../lib/ai";
  import type { ChatBubble } from "../../lib/chat-export";
  import ChatThread from "./ChatThread.svelte";
  import ChatHelp from "./ChatHelp.svelte";
  import TopicCardsEditor from "./TopicCardsEditor.svelte";
  import CorpusConvertInfo from "./CorpusConvertInfo.svelte";
  import Icon from "../common/Icon.svelte";
  import ContextMenu from "../common/ContextMenu.svelte";

  let bubbles: ChatBubble[] = $state([]);
  let input = $state("");
  let busy = $state(false);
  let errorMsg = $state("");
  let keySaved = $state(false);
  let corpusDir = $state("");
  let model = $state("");
  let helpOpen = $state(false);
  /** v4.20 §2.9：消息右键「复制该段对话」菜单（屏幕坐标） */
  let copyMenu = $state<{ x: number; y: number; content: string } | null>(null);
  let cardsOpen = $state(false);
  /** v4.22 §2.12：保存结果提示 + 「打开所在文件夹」 */
  let saveMsg = $state("");
  let saveErr = $state(false);
  /** v4.26 §2.14：语料导入状态 */
  let importing = $state(false);
  let importResult = $state<ImportResult | null>(null);
  let importErr = $state("");
  /** v4.26：语料转化前置说明弹窗（点按钮先提示支持范围与扫描件限制） */
  let convertInfoOpen = $state(false);

  onMount(async () => {
    if (!persist) return;
    try {
      const cfg = await aiGetConfig();
      keySaved = cfg.key_saved;
      corpusDir = cfg.corpus_dir;
      model = cfg.model;
    } catch (e) {
      errorMsg = `${e}`;
    }
  });

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    errorMsg = "";
    input = "";
    bubbles = [...bubbles, { role: "user", content: text }];
    busy = true;
    try {
      const history: ChatMsg[] = bubbles.map((b) => ({
        role: b.role,
        content: b.content,
      }));
      const r = await aiAsk(history);
      bubbles = [
        ...bubbles,
        { role: "assistant", content: r.answer, citations: r.citations },
      ];
    } catch (e) {
      errorMsg = `${e}`;
    }
    busy = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  /** v4.22 §2.12：保存本轮对话为 Markdown（conversations/）。 */
  async function saveConversation() {
    saveMsg = "";
    saveErr = false;
    try {
      const rel = await app.saveConversation(bubbles, model);
      if (!rel) return;
      saveMsg = `已保存：${rel}`;
    } catch (e) {
      saveMsg = `保存失败：${e}`;
      saveErr = true;
    }
  }

  /** 保存提示中的「打开所在文件夹」：资源管理器定位到 conversations/ */
  async function revealSaved() {
    try {
      await fsReveal("conversations");
    } catch {
      // 打开失败静默
    }
  }

  /** v4.26 §2.14：语料转化——弹文件选择器 → epub/pdf 转 md → 落 corpus/<书名>/ */
  async function importCorpus() {
    importResult = null;
    importErr = "";
    try {
      const paths = await pickCorpusFiles();
      if (paths.length === 0) return; // 用户取消
      importing = true;
      const r = await importCorpusFile(paths);
      importResult = r;
    } catch (e) {
      importErr = `${e}`;
    } finally {
      importing = false;
    }
  }

  /** v4.26：转化完成后打开语料库目录（绝对路径，explorer 直达） */
  async function revealImported() {
    if (!importResult) return;
    try {
      await revealPath(importResult.output_dir);
    } catch {
      // 静默
    }
  }
</script>

<div class="chat-page">
  <div class="toolbar">
    <button class="btn-secondary tool-btn" onclick={() => void openCorpusFolder()}>
      <Icon name="file" size={21} />
      资源跳转
    </button>
    <button
      class="btn-secondary tool-btn"
      disabled={importing}
      title="把 PDF / EPUB 电子书转成 Markdown，存入语料库"
      onclick={() => (convertInfoOpen = true)}
    >
      <Icon name="writing" size={21} />
      {importing ? "正在转化…" : "语料转化"}
    </button>
    <button class="btn-secondary tool-btn" onclick={() => (cardsOpen = true)}>
      <Icon name="index-card" size={21} />
      索引卡
    </button>
    <button
      class="btn-secondary tool-btn"
      disabled={bubbles.length === 0 || busy}
      title={bubbles.length === 0 ? "当前没有对话可保存" : "把本轮对话保存为 Markdown"}
      onclick={() => void saveConversation()}
    >
      <Icon name="writing" size={21} />
      保存本轮对话
    </button>
    <button class="btn-secondary tool-btn" onclick={() => (helpOpen = true)}>
      <Icon name="help" size={21} />
      说明
    </button>
    {#if corpusDir}
      <span class="corpus-path" title={corpusDir}>语料库：{corpusDir}</span>
    {/if}
  </div>

  {#if saveMsg}
    <div class="save-note" class:err={saveErr}>
      <span class="save-text">{saveMsg}</span>
      {#if !saveErr}
        <button class="btn-secondary save-open" onclick={() => void revealSaved()}>
          打开所在文件夹
        </button>
      {/if}
    </div>
  {/if}

  {#if importResult}
    <div class="save-note" class:err={importResult.files_failed > 0}>
      <span class="save-text">
        语料转化完成：成功 {importResult.files_converted} · 失败 {importResult.files_failed}
        · 已存入语料库
      </span>
      <button class="btn-secondary save-open" onclick={() => void revealImported()}>
        打开语料库
      </button>
    </div>
  {/if}
  {#if importErr}
    <div class="save-note err">
      <span class="save-text">语料转化失败：{importErr}</span>
    </div>
  {/if}

  {#if !persist}
    <div class="banner">
      浏览器预览模式 —— 隆中对需在桌面应用内使用（API 配置见设置页）
    </div>
  {:else if !keySaved}
    <div class="guide card">
      <h2>配置你的AI</h2>
      <p>通过配置AI和培养语料，培养一个属于你的诸葛孔明</p>
      <button class="btn-primary" onclick={() => app.gotoSection("settings")}>
        去设置页配置
      </button>
    </div>
  {:else}
    <ChatThread
      {bubbles}
      {busy}
      {errorMsg}
      onmenu={(x, y, content) => (copyMenu = { x, y, content })}
    />

    <div class="composer">
      <textarea
        bind:value={input}
        onkeydown={onKeydown}
        placeholder="输入问题，Enter 发送，Shift+Enter 换行"
        aria-label="输入对话问题"
        rows="2"
        disabled={busy}
      ></textarea>
      <button class="btn-primary" onclick={() => void send()} disabled={busy || !input.trim()}>
        发送
      </button>
    </div>
  {/if}
</div>

{#if helpOpen}
  <ChatHelp onclose={() => (helpOpen = false)} />
{/if}
{#if cardsOpen}
  <TopicCardsEditor onclose={() => (cardsOpen = false)} />
{/if}

{#if convertInfoOpen}
  <CorpusConvertInfo
    onconfirm={() => {
      convertInfoOpen = false;
      void importCorpus();
    }}
    oncancel={() => (convertInfoOpen = false)}
  />
{/if}
{#if copyMenu}
  <ContextMenu
    x={copyMenu.x}
    y={copyMenu.y}
    items={[
      {
        label: "复制该段对话",
        action: () => {
          void navigator.clipboard.writeText(copyMenu!.content).catch(() => {});
        },
      },
    ]}
    onclose={() => (copyMenu = null)}
  />
{/if}

<style>
  .chat-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
    max-width: 760px;
    margin: 0 auto;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap; /* v4.26：窄空间按钮整体换行，避免单个按钮文字被竖排 */
    align-items: center;
    gap: var(--space-2);
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap; /* v4.26：按钮文字禁止折行（「索引卡」曾被竖排三行） */
    flex-shrink: 0;
  }

  .corpus-path {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-left: auto;
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .save-note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  .save-note.err {
    color: var(--color-danger);
  }

  .save-text {
    min-width: 0;
    word-break: break-all;
  }

  .save-open {
    margin-left: auto;
    flex-shrink: 0;
    font-size: var(--font-size-xs);
  }

  .banner {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .guide {
    padding: var(--space-4);
  }

  .guide h2 {
    font-size: var(--font-size-md);
    margin: 0 0 var(--space-2);
  }

  .guide p {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
  }

  .composer {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .composer textarea {
    flex: 1;
    resize: vertical;
    min-height: 44px;
    max-height: 160px;
  }
</style>
