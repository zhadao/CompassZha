<script lang="ts">
  // 数据分析对话弹层（v4.15 · 检查点 4.6）：仪表盘顶端入口点开。
  // AI 基于每日量化指标（9 项，内存态全量）做分析建议；非数据问题只回固定句（后端约束）。
  // 每次发送时现取数据表——与界面图表同源，最新录入即刻可析；只传数字，不传日记正文。
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { persist } from "../../lib/tauri-fs";
  import { aiGetConfig, dataAnalyzeAsk, type ChatMsg } from "../../lib/ai";
  import Icon from "../common/Icon.svelte";
  import type { DailyMetrics } from "../../types/schema";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  interface Bubble {
    role: "user" | "assistant";
    content: string;
  }

  let bubbles: Bubble[] = $state([]);
  let input = $state("");
  let busy = $state(false);
  let errorMsg = $state("");
  // 数据分析 key 回落主 key（Rust read_data_key）——两者任一存在即可用
  let keyReady = $state(false);
  let dataDays = $state(0);
  let scroller: HTMLDivElement | undefined = $state();

  onMount(async () => {
    if (!persist) return;
    try {
      const cfg = await aiGetConfig();
      keyReady = cfg.key_saved || cfg.data_key_saved;
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

  // 组装每日量化数据表（有任一指标记录的天，按日期升序；空值留空）
  function buildDataText(): string {
    const days = Object.entries(app.dailyNotes)
      .map(([date, n]) => ({ date, m: n.metrics }))
      .filter((d) => Object.values(d.m).some((v) => v !== null))
      .sort((a, b) => a.date.localeCompare(b.date));
    dataDays = days.length;
    if (!days.length) return "（暂无任何记录）";
    return days
      .map((d) => rowOf(d.date, d.m))
      .join("\n");
  }

  function rowOf(date: string, m: DailyMetrics): string {
    return [
      date,
      m.sleep_hours?.toFixed(1) ?? "",
      m.sleep_quality?.toString() ?? "",
      m.sleep_bedtime ?? "",
      m.sleep_wake ?? "",
      m.weight_kg?.toString() ?? "",
      m.spend_total?.toString() ?? "",
      m.mood?.toString() ?? "",
      m.focus_minutes?.toString() ?? "",
      m.steps?.toString() ?? "",
    ].join(" | ");
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    errorMsg = "";
    input = "";
    bubbles = [...bubbles, { role: "user", content: text }];
    busy = true;
    try {
      const history: ChatMsg[] = bubbles.map((b) => ({ role: b.role, content: b.content }));
      const answer = await dataAnalyzeAsk(history, buildDataText());
      bubbles = [...bubbles, { role: "assistant", content: answer }];
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

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="AI 数据分析" tabindex="-1">
    <header class="panel-head">
      <h2 class="panel-title">
        <Icon name="ai" size={27} />
        AI 数据分析
      </h2>
      <button class="close" onclick={onclose} aria-label="关闭">
        <Icon name="close" size={24} />
      </button>
    </header>

    {#if !persist}
      <div class="panel-body">
        <p class="muted">浏览器预览模式 —— 数据分析需在桌面应用内使用</p>
      </div>
    {:else if !keyReady}
      <div class="panel-body">
        <div class="guide">
          <h3>开始前需要配置一次 AI</h3>
          <p>
            数据分析通过你自己的 AI API 回答，软件不内置任何密钥。请到设置页「AI
            配置」填入 API Key（可为主对话与数据分析分别配置两个 API），回来即可提问。
          </p>
          <button
            class="btn-primary"
            onclick={() => {
              onclose();
              app.gotoSection("settings");
            }}
          >
            去设置页配置
          </button>
        </div>
      </div>
    {:else}
      <div class="thread" bind:this={scroller}>
        {#if bubbles.length === 0}
          <p class="empty">
            问一问你的数据——比如「最近哪几天睡得比较晚？」「这个月支出情况怎么样？」
            {#if dataDays > 0}当前已捕捉 {dataDays} 天记录。{:else}尚未录入数据时，AI 会如实说明。{/if}
          </p>
        {/if}
        {#each bubbles as b, i (i)}
          <div class="msg" class:user={b.role === "user"} class:ai={b.role === "assistant"}>
            <div class="bubble">{b.content}</div>
          </div>
        {/each}
        {#if busy}
          <div class="msg ai">
            <div class="bubble muted">分析中…（约需十几秒）</div>
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
          placeholder="输入数据相关问题，Enter 发送，Shift+Enter 换行"
          aria-label="输入数据分析问题"
          rows="2"
          disabled={busy}
        ></textarea>
        <button class="btn-primary" onclick={() => void send()} disabled={busy || !input.trim()}>
          发送
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: var(--color-overlay);
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: min(680px, calc(100vw - 48px));
    height: min(72vh, 640px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    overflow: hidden;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
  }

  .close {
    display: inline-flex;
    border: none;
    background: transparent;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--color-text-tertiary);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .close:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-alt);
  }

  .panel-body {
    overflow-y: auto;
    padding: var(--space-4);
  }

  .muted {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin: 0;
  }

  .guide h3 {
    font-size: var(--font-size-md);
    margin: 0 0 var(--space-2);
  }

  .guide p {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
    line-height: 1.7;
  }

  .thread {
    flex: 1;
    min-height: 0;
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
    line-height: 1.8;
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
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.7;
  }

  .msg.user .bubble {
    background-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .msg.ai .bubble {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
  }

  .bubble.muted {
    color: var(--color-text-tertiary);
  }

  .error {
    font-size: var(--font-size-sm);
    color: var(--color-danger);
    margin: 0;
  }

  .composer {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .composer textarea {
    flex: 1;
    resize: vertical;
    min-height: 44px;
    max-height: 140px;
  }
</style>
