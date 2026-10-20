<script lang="ts">
  // v4.22：从 ChatPage 拆出的消息链（CODE-003 组件行数红线）。
  // 只负责渲染气泡、引用出处、思考中占位与错误行，并自动滚到底；数据与动作由 ChatPage 持有。
  import type { ChatBubble } from "../../lib/chat-export";

  interface Props {
    bubbles: ChatBubble[];
    busy: boolean;
    errorMsg: string;
    /** 气泡右键（屏幕坐标 + 该段文本），由 ChatPage 弹「复制该段对话」菜单 */
    onmenu: (x: number, y: number, content: string) => void;
  }

  let { bubbles, busy, errorMsg, onmenu }: Props = $props();

  let scroller: HTMLDivElement | undefined = $state();

  /** D-8③：把某条引用的反思写回气泡（与 citations 下标对齐），保存对话时一并归档 */
  function setReflection(b: ChatBubble, index: number, value: string): void {
    if (!b.reflections) b.reflections = [];
    b.reflections[index] = value;
  }

  // 新消息后滚到底
  $effect(() => {
    void bubbles;
    void busy;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
</script>

<div class="thread card" bind:this={scroller}>
  {#if bubbles.length === 0}
    <p class="empty">
      和你的语料库对话——AI 会先检索语料，再以语料为依据回答并标注出处。
    </p>
  {/if}
  {#each bubbles as b, i (i)}
    <div
      class="msg"
      role="listitem"
      class:user={b.role === "user"}
      class:ai={b.role === "assistant"}
      oncontextmenu={(e) => {
        e.preventDefault();
        onmenu(e.clientX, e.clientY, b.content);
      }}
    >
      <div class="bubble">{b.content}</div>
      {#if b.citations && b.citations.length > 0}
        <details class="cites">
          <summary>引用出处（{b.citations.length}）</summary>
          <ul>
            {#each b.citations as c, ci (c.rel_path + c.snippet.slice(0, 20))}
              <li>
                <span class="cite-title" title={c.rel_path}>{c.title}</span>
                <details class="reflect">
                  <summary
                    >{b.reflections?.[ci]?.trim() ? "反思（已记）" : "补一句反思"}</summary
                  >
                  <textarea
                    rows="2"
                    placeholder="这条引用给你的启发（可留空）"
                    value={b.reflections?.[ci] ?? ""}
                    oninput={(e) => setReflection(b, ci, e.currentTarget.value)}
                  ></textarea>
                </details>
              </li>
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

<style>
  .thread {
    flex: 1;
    min-height: 0; /* A-2：小窗口下由消息区内部滚动，滚动条只出现在这里 */
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

  .cite-title {
    display: block;
  }

  /* D-8③：每条引用下的「补一句反思」折叠输入 */
  .reflect {
    margin-top: 2px;
  }

  .reflect summary {
    cursor: pointer;
    color: var(--color-text-tertiary);
  }

  .reflect textarea {
    box-sizing: border-box;
    width: 100%;
    margin-top: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    font-family: inherit;
    color: var(--color-text-primary);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    resize: vertical;
  }

  .error {
    font-size: var(--font-size-sm);
    color: var(--color-danger);
    margin: 0;
  }
</style>
