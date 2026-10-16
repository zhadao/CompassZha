<script lang="ts">
  // 语料对话分区（阶段 4 · 检查点 4.4，v4.12 内嵌自研轻量路线）：
  // 问题 → AI 扩词选卡 → 本地检索 corpus/ → 以语料为基础回答并标注出处（材料不足时兜底提示）。
  // 首版非流式（等待期间显示「思考中」）；对话历史仅会话内（不落盘）。
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { persist } from "../../lib/tauri-fs";
  import {
    aiGetConfig,
    aiAsk,
    openCorpusFolder,
    type ChatMsg,
    type CorpusHit,
  } from "../../lib/ai";
  import ChatHelp from "./ChatHelp.svelte";
  import TopicCardsEditor from "./TopicCardsEditor.svelte";

  interface Bubble {
    role: "user" | "assistant";
    content: string;
    citations?: CorpusHit[];
  }

  let bubbles: Bubble[] = $state([]);
  let input = $state("");
  let busy = $state(false);
  let errorMsg = $state("");
  let keySaved = $state(false);
  let corpusDir = $state("");
  let helpOpen = $state(false);
  let cardsOpen = $state(false);
  let scroller: HTMLDivElement | undefined = $state();

  onMount(async () => {
    if (!persist) return;
    try {
      const cfg = await aiGetConfig();
      keySaved = cfg.key_saved;
      corpusDir = cfg.corpus_dir;
    } catch (e) {
      errorMsg = `${e}`;
    }
  });

  // 新消息后滚到底
  $effect(() => {
    void bubbles;
    void busy;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
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
</script>

<div class="chat-page">
  <div class="toolbar">
    <button class="btn-secondary" onclick={() => void openCorpusFolder()}>
      📂 资源跳转
    </button>
    <button class="btn-secondary" onclick={() => (cardsOpen = true)}>🗂 索引卡</button>
    <button class="btn-secondary" onclick={() => (helpOpen = true)}>说明</button>
    {#if corpusDir}
      <span class="corpus-path" title={corpusDir}>语料库：{corpusDir}</span>
    {/if}
  </div>

  {#if !persist}
    <div class="banner">
      🌐 浏览器预览模式 —— 语料对话需在桌面应用内使用（API 配置见设置页）
    </div>
  {:else if !keySaved}
    <div class="guide card">
      <h2>开始前需要配置一次 AI</h2>
      <p>
        语料对话通过你自己的 AI API（DeepSeek）回答，软件不内置任何密钥。请到
        设置页「AI 配置」填入你的 API Key，回来即可开始对话。
      </p>
      <button class="btn-primary" onclick={() => app.gotoSection("settings")}>
        去设置页配置
      </button>
    </div>
  {:else}
    <div class="thread card" bind:this={scroller}>
      {#if bubbles.length === 0}
        <p class="empty">
          和你的语料库对话——AI 会先检索语料，再以语料为依据回答并标注出处。
        </p>
      {/if}
      {#each bubbles as b, i (i)}
        <div class="msg" class:user={b.role === "user"} class:ai={b.role === "assistant"}>
          <div class="bubble">{b.content}</div>
          {#if b.citations && b.citations.length > 0}
            <details class="cites">
              <summary>引用出处（{b.citations.length}）</summary>
              <ul>
                {#each b.citations as c (c.rel_path + c.snippet.slice(0, 20))}
                  <li title={c.rel_path}>{c.title}</li>
                {/each}
              </ul>
            </details>
          {/if}
        </div>
      {/each}
      {#if busy}
        <div class="msg ai">
          <div class="bubble muted">思考中…（检索语料并生成回答，约需十几秒）</div>
        </div>
      {/if}
      {#if errorMsg}
        <p class="error">{errorMsg}</p>
      {/if}
    </div>

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
    align-items: center;
    gap: var(--space-2);
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

  .thread {
    flex: 1;
    min-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .empty {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    text-align: center;
    margin: auto;
  }

  .msg {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .msg.ai {
    align-items: flex-start;
  }

  .bubble {
    max-width: 85%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md, 10px);
    font-size: var(--font-size-sm);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.7;
  }

  .msg.user .bubble {
    background-color: var(--color-primary);
    color: #fff;
  }

  .msg.ai .bubble {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
  }

  .bubble.muted {
    color: var(--color-text-tertiary);
  }

  .cites {
    max-width: 85%;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: var(--space-1);
  }

  .cites summary {
    cursor: pointer;
  }

  .cites ul {
    margin: var(--space-1) 0 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cites li {
    cursor: default;
  }

  .error {
    font-size: var(--font-size-sm);
    color: var(--color-danger, #dc2626);
    margin: 0;
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
