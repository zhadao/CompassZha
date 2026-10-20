<script lang="ts">
  // 阶段 1：自 ChatPage 抽出的提示条（保存本轮对话结果 / 语料转化结果，保持组件单文件 ≤300 行）。
  import type { ImportResult } from "../../lib/ai";

  let {
    saveMsg,
    saveErr,
    importResult,
    importErr,
    onRevealSaved,
    onRevealImported,
  }: {
    saveMsg: string;
    saveErr: boolean;
    importResult: ImportResult | null;
    importErr: string;
    onRevealSaved: () => void;
    onRevealImported: () => void;
  } = $props();
</script>

{#if saveMsg}
  <div class="save-note" class:err={saveErr}>
    <span class="save-text">{saveMsg}</span>
    {#if !saveErr}
      <button class="btn-secondary save-open" onclick={onRevealSaved}>打开所在文件夹</button>
    {/if}
  </div>
{/if}

{#if importResult}
  <div class="save-note" class:err={importResult.files_failed > 0}>
    <span class="save-text">
      语料转化完成：成功 {importResult.files_converted} · 失败 {importResult.files_failed}
      · 已存入语料库
    </span>
    <button class="btn-secondary save-open" onclick={onRevealImported}>打开语料库</button>
  </div>
{/if}
{#if importErr}
  <div class="save-note err">
    <span class="save-text">语料转化失败：{importErr}</span>
  </div>
{/if}

<style>
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
</style>
