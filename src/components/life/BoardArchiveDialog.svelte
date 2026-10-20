<script lang="ts">
  /**
   * D-6（v4.41）：封存板块确认弹窗。
   * 封存 = 把 life/<名>/ 整体移入 life/_archived/<名>/，卡片从网格收起；
   * **不是删除**——文档、任务标签、热力图历史全部保留，可随时从「封存盒」重启。
   */
  import { app } from "../../stores/app.svelte";
  import type { LifeBoard } from "../../types/schema";

  interface Props {
    board: LifeBoard;
    onCancel: () => void;
  }
  let { board, onCancel }: Props = $props();

  function archive(): void {
    app.archiveBoard(board.id); // store 会置 boardNotice 并退回网格
    onCancel(); // 封存即关弹窗
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onCancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="alertdialog" aria-label="封存人生板块" tabindex="-1">
    <h3 class="dialog-title">封存板块「{board.name}」？</h3>
    <p class="dialog-text">
      将把 <code>life/{board.name}/</code> 整个文件夹移入
      <code>life/_archived/{board.name}/</code>，卡片从网格收起。
    </p>
    <p class="dialog-text">
      <b>这不是删除</b>：{board.files.length} 个文档、任务标签与热力图历史全部保留，
      随时可在页面下方「封存盒」中重启。
    </p>
    <div class="dialog-actions">
      <button class="btn primary solid" onclick={archive}>封存</button>
      <button class="btn ghost" onclick={onCancel}>取消</button>
    </div>
    <p class="dialog-hint">
      封存后默认文档的 frontmatter 会写入 <code>archived: &lt;日期&gt;</code>；
      热力图历史继续保留在 <code>life/goal-stats.md</code>，不删。
    </p>
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
  }
  .dialog {
    width: min(420px, calc(100vw - 48px));
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
  }
  .dialog-title {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .dialog-text {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-sm);
    line-height: 1.7;
    color: var(--color-text-primary);
  }
  .dialog-text code {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .btn {
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .btn:hover {
    background: var(--color-surface-alt);
  }
  .btn.primary {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .btn.primary:hover {
    background: var(--color-primary-light);
  }
  .btn.primary.solid {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }
  .btn.primary.solid:hover {
    background: var(--color-primary-hover);
  }
  .btn.ghost {
    margin-left: auto;
    color: var(--color-text-secondary);
  }
  .dialog-hint {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-xs);
    line-height: 1.7;
    color: var(--color-text-secondary);
  }
  .dialog-hint code {
    font-size: 11px;
  }
</style>
