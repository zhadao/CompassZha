<script lang="ts">
  /**
   * 座右铭编辑弹窗（v4.20 §2.5）：life/座右铭.md 每行一条；
   * 形态对标 todo 快速编辑窗——逐条编辑、可增删，保存即落盘（store.saveMottos）。
   */
  import { app } from "../../stores/app.svelte";
  import Icon from "../common/Icon.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let items = $state<string[]>([...app.mottos]);

  function add(): void {
    items = [...items, ""];
  }

  function remove(i: number): void {
    items = items.filter((_, idx) => idx !== i);
  }

  function save(): void {
    void app
      .saveMottos(
        items
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      )
      .catch(() => {});
    onclose();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="填写你的座右铭" tabindex="-1">
    <header class="head">
      <h3 class="dialog-title">填写你的座右铭</h3>
      <button class="close" onclick={onclose} aria-label="关闭">
        <Icon name="close" size={20} />
      </button>
    </header>
    <p class="hint">每行一条；保存后展示在人生板块上方，过长自动换行。</p>

    <div class="list">
      {#each items as item, i (i)}
        <div class="row">
          <input
            type="text"
            value={item}
            oninput={(e) => (items[i] = e.currentTarget.value)}
            placeholder="写下激励你的那句话"
            aria-label="座右铭第 {i + 1} 条"
          />
          <button class="row-del" onclick={() => remove(i)} aria-label="删除第 {i + 1} 条" title="删除这一条">
            <Icon name="close" size={16} />
          </button>
        </div>
      {:else}
        <p class="empty">还没有座右铭，点下方按钮添加。</p>
      {/each}
    </div>
    <button class="add-btn" onclick={add}>+ 添加一条</button>

    <footer class="foot">
      <button class="btn-primary" onclick={save} disabled={items.every((s) => !s.trim())}>保存</button>
      <button class="btn-secondary" onclick={onclose}>取消</button>
    </footer>
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
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .dialog {
    width: min(480px, 100%);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dialog-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close {
    display: inline-flex;
    color: var(--color-text-tertiary);
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }

  .hint {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 46vh;
    overflow-y: auto;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row input {
    flex: 1;
  }

  .row-del {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .row-del:hover {
    color: var(--color-danger);
    background-color: var(--color-surface-alt);
  }

  .empty {
    margin: 0;
    padding: var(--space-3) 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .add-btn {
    align-self: flex-start;
    font-size: var(--font-size-sm);
    color: var(--color-primary);
    padding: var(--space-1) var(--space-2);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
  }

  .add-btn:hover {
    border-color: var(--color-primary);
    background-color: var(--color-surface-alt);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
