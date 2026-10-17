<script lang="ts">
  /**
   * 板块重命名弹窗（v4.20 右键「编辑」入口）：复用 store.renameBoard 既有改名链路
   * （文件夹 + 默认文档 + 日记任务标签同步更名，热力图历史转记）。
   */
  import { app } from "../../stores/app.svelte";
  import type { LifeBoard } from "../../types/schema";

  interface Props {
    board: LifeBoard;
    onDone: () => void;
  }
  let { board, onDone }: Props = $props();

  // 弹窗实例化时取当时板块名作初值（board 在弹窗生命周期内不变）
  // svelte-ignore state_referenced_locally
  let name = $state(board.name);
  const dup = $derived(
    name.trim() !== board.name && app.lifeBoards.some((b) => b.name === name.trim()),
  );

  function submit(): void {
    const raw = name.trim();
    if (!raw || dup) return;
    app.renameBoard(board.id, raw);
    onDone();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onDone();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="编辑板块名称" tabindex="-1">
    <h3 class="dialog-title">编辑板块「{board.name}」</h3>
    <label class="field">
      <span class="label">板块名称</span>
      <input
        type="text"
        bind:value={name}
        aria-label="板块名称"
        onkeydown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      {#if dup}
        <span class="warn">已有同名板块</span>
      {/if}
    </label>
    <p class="dialog-hint">
      改名会同步更名文件夹、默认文档与日记任务里的板块标签；热力图历史完整保留。
    </p>
    <div class="dialog-actions">
      <button class="btn-primary" onclick={submit} disabled={!name.trim() || dup}>保存</button>
      <button class="btn-secondary" onclick={onDone}>取消</button>
    </div>
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
    width: min(420px, 100%);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dialog-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .warn {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
  }

  .dialog-hint {
    margin: 0;
    font-size: var(--font-size-xs);
    line-height: 1.7;
    color: var(--color-text-secondary);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
