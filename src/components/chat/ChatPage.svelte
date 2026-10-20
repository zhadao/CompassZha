<script lang="ts">
  // 隆中对分区（v4.20 起统一为现名；阶段 4 · 检查点 4.4，v4.12 内嵌自研轻量路线）：
  // 问题 → AI 扩词选卡 → 本地检索 corpus/ → 以语料为基础回答并标注出处（材料不足时兜底提示）。
  // 首版非流式（等待期间显示「思考中」）；对话历史为会话内内存态。
  // v4.22 §2.12：工具栏「保存本轮对话」把整轮对话归档为 conversations/*.md。
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import {
    persist,
    fsReveal,
    revealPath,
    uiGetConfig,
    uiSetChatGuideSeen,
  } from "../../lib/tauri-fs";
  import {
    aiGetConfig,
    aiAsk,
    corpusStats,
    openCorpusFolder,
    pickCorpusFiles,
    importCorpusFile,
    type ChatMsg,
    type ImportResult,
  } from "../../lib/ai";
  import type { ChatBubble } from "../../lib/chat-export";
  import ChatThread from "./ChatThread.svelte";
  import ChatComposer from "./ChatComposer.svelte";
  import ChatNotices from "./ChatNotices.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import ChatHelp from "./ChatHelp.svelte";
  import ChatCorpusNotice from "./ChatCorpusNotice.svelte";
  import TopicCardsEditor from "./TopicCardsEditor.svelte";
  import CorpusConvertInfo from "./CorpusConvertInfo.svelte";
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
  /** D-8①：语料库文件数（null = 尚未读到，不提示） */
  let corpusCount = $state<number | null>(null);
  /** D-8②：首开引导是否已看过（默认按「已看过」渲染，读到配置后再决定，避免闪现） */
  let guideSeen = $state(true);

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
    // D-8①：语料统计（失败静默，不打断对话）
    try {
      corpusCount = (await corpusStats()).file_count;
    } catch {
      /* 统计失败不提示 */
    }
    // D-8②：是否已看过首开引导（读失败按「已看过」处理，避免误弹）
    try {
      guideSeen = (await uiGetConfig()).chat_guide_seen === true;
    } catch {
      /* 读失败按已看过处理 */
    }
  });

  /** D-8②：关掉首开引导并落盘「已看过」 */
  function dismissGuide(): void {
    guideSeen = true;
    if (!persist) return;
    uiSetChatGuideSeen(true).catch((err) =>
      console.error("[ChatPage] 保存引导标记失败", err),
    );
  }

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
  <ChatToolbar
    {importing}
    bubbleCount={bubbles.length}
    {busy}
    {corpusDir}
    onOpenCorpus={() => void openCorpusFolder()}
    onConvert={() => (convertInfoOpen = true)}
    onCards={() => (cardsOpen = true)}
    onSave={() => void saveConversation()}
    onHelp={() => (helpOpen = true)}
  />

  <ChatNotices
    {saveMsg}
    {saveErr}
    {importResult}
    {importErr}
    onRevealSaved={() => void revealSaved()}
    onRevealImported={() => void revealImported()}
  />

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
    <ChatCorpusNotice
      fileCount={corpusCount}
      {guideSeen}
      onOpenCorpus={() => void openCorpusFolder()}
      onDismissGuide={dismissGuide}
    />

    <ChatThread
      {bubbles}
      {busy}
      {errorMsg}
      onmenu={(x, y, content) => (copyMenu = { x, y, content })}
    />

    <ChatComposer bind:value={input} {busy} onsend={() => void send()} />
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
    min-height: 0; /* A-2：允许内部消息区收缩，输入框不叠、不被裁 */
    width: 100%; /* A-2：外层自适应，列宽由 max-width 收住并居中 */
    max-width: 720px;
    margin-inline: auto;
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
</style>
