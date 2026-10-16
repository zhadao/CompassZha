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
      <button class="btn danger solid" onclick={() => del(true)}>保留历史数据并删除</button>
      <button class="btn danger" onclick={() => del(false)}>不保留，全部清除</button>
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
    background: rgb(17 24 39 / 32%);
  }
  .dialog {
    width: min(420px, calc(100vw - 48px));
    padding: var(--space-4);
    background: var(--bg-elevated, #fff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
  }
  .dialog-title {
    margin: 0 0 var(--space-2);
    font-size: 16px;
  }
  .dialog-text {
    margin: 0 0 var(--space-2);
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-primary, #1f2937);
  }
  .dialog-text code {
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }
  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .btn {
    padding: 7px 12px;
    font-size: 13px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-primary, #fff);
    cursor: pointer;
  }
  .btn:hover {
    background: var(--bg-hover, #f3f4f6);
  }
  .btn.danger {
    color: var(--danger, #dc2626);
    border-color: var(--danger, #dc2626);
  }
  .btn.danger.solid {
    background: var(--danger, #dc2626);
    color: #fff;
  }
  .btn.danger.solid:hover {
    opacity: 0.9;
  }
  .btn.ghost {
    margin-left: auto;
    color: var(--text-secondary, #6b7280);
  }
  .dialog-hint {
    margin: var(--space-3) 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-secondary, #6b7280);
  }
  .dialog-hint code {
    font-size: 11px;
  }
</style>
