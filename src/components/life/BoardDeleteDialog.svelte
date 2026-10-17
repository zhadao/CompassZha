<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import type { LifeBoard } from "../../types/schema";

  interface Props {
    board: LifeBoard;
    onCancel: () => void;
  }
  let { board, onCancel }: Props = $props();

  function del(keepStats: boolean): void {
    app.deleteBoard(board.id, keepStats); // store 会置 boardNotice 并退回网格
    onCancel(); // v4.20：删除即关弹窗（网格态从右键菜单进入时，弹窗不再随视图卸载）
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onCancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="alertdialog" aria-label="删除人生板块" tabindex="-1">
    <h3 class="dialog-title">删除板块「{board.name}」？</h3>
    <p class="dialog-text">
      将删除 <code>life/{board.name}/</code> 文件夹及其中 {board.files.length} 个文档。
    </p>
    <p class="dialog-text">
      是否保留<b>板块历史数据</b>？（热力图数据：每天被任务关联的次数）
    </p>
    <div class="dialog-actions">
      <button class="btn primary solid" onclick={() => del(true)}>保留历史数据并删除</button>
      <button class="btn primary" onclick={() => del(false)}>不保留，全部清除</button>
      <button class="btn ghost" onclick={onCancel}>取消</button>
    </div>
    <p class="dialog-hint">
      保留 → 历史数据存档于 <code>life/goal-stats.md</code>（删除后页面顶部会告知位置）；
      不保留 → 清除存档，并移除所有日记任务中的该板块标签。
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
  /* v4.25：删除确认操作改用全站主按钮语义色（随主题色联动；
     深色模式 --color-primary-contrast 为近黑，粉底黑字对比达标） */
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
