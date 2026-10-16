<script lang="ts">
  /**
   * 板块文件夹视图：
   * 点卡进入 life/<板块名>/ —— 左侧该板块的 Markdown 文件列表（新建/重命名/删除），
   * 右侧为当前选中文件的 Crepe 编辑器，编辑实时落盘。
   */
  import { app } from "../../stores/app.svelte";
  import type { BoardFile, LifeBoard } from "../../types/schema";
  import BoardEditor from "./BoardEditor.svelte";

  interface Props {
    board: LifeBoard;
  }
  let { board }: Props = $props();

  const openedFile = $derived<BoardFile | null>(
    board.files.find((f) => f.id === app.openedBoardFileId) ?? null,
  );

  let newName = $state("");
  let error = $state("");
  let renamingId = $state<string | null>(null);
  let renameValue = $state("");
  let confirmDel = $state(false);

  function createFile(): void {
    const raw = newName.trim();
    if (!raw) {
      error = "先输入文件名";
      return;
    }
    if (board.files.some((f) => f.name === raw || f.name === `${raw}.md`)) {
      error = "同名文件已存在";
      return;
    }
    app.createBoardFile(board.id, raw);
    newName = "";
    error = "";
  }

  function startRename(file: BoardFile): void {
    renamingId = file.id;
    renameValue = file.name.replace(/\.md$/i, "");
    error = "";
  }

  function submitRename(file: BoardFile): void {
    const raw = renameValue.trim();
    if (!raw) {
      error = "文件名不能为空";
      return;
    }
    const target = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
    if (target !== file.name && board.files.some((f) => f.name === target)) {
      error = "同名文件已存在";
      return;
    }
    app.renameBoardFile(board.id, file.id, raw);
    renamingId = null;
    renameValue = "";
    error = "";
  }

  function removeFile(file: BoardFile): void {
    if (board.files.length <= 1) {
      error = "至少保留一个文件";
      return;
    }
    app.deleteBoardFile(board.id, file.id);
    error = "";
  }

  function removeBoard(): void {
    if (!confirmDel) {
      confirmDel = true; // 两次点击确认，避免误删
      setTimeout(() => (confirmDel = false), 2500);
      return;
    }
    app.deleteBoard(board.id);
  }

  /** 卡片预览：默认文件正文去 frontmatter 后首行非空行 */
  function previewText(): string {
    const def = board.files.find((f) => f.name === `${board.name}.md`) ?? board.files[0];
    if (!def) return "（空文件夹）";
    const line =
      def.content
        .replace(/^---[ \t]*\n[\s\S]*?---[ \t]*(?:\n|$)/, "")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? "";
    return line || "（还没写内容）";
  }
</script>

<section class="folder">
  <header class="folder-header">
    <button class="btn-secondary" onclick={() => app.closeBoard()}>← 返回</button>
    <div class="crumbs">
      <span class="crumb-icon">{board.icon}</span>
      <span class="crumb-name">{board.name}</span>
      <span class="crumb-path">life/{board.name}/</span>
      <span class="crumb-count">{board.files.length} 个文档</span>
    </div>
    <button class="btn-danger" class:armed={confirmDel} onclick={removeBoard}>
      {confirmDel ? "确认删除板块？" : "删除板块"}
    </button>
  </header>

  <div class="folder-body">
    <!-- 左：文件列表 -->
    <aside class="file-list">
      <div class="new-row">
        <input
          type="text"
          placeholder="新建文档名…"
          maxlength="40"
          bind:value={newName}
          onkeydown={(e) => e.key === "Enter" && createFile()}
        />
        <button class="btn-primary btn-sm" onclick={createFile}>＋ 新建</button>
      </div>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <ul class="files">
        {#each board.files as file (file.id)}
          <li class="file-item" class:active={app.openedBoardFileId === file.id}>
            {#if renamingId === file.id}
              <input
                class="rename-input"
                type="text"
                maxlength="40"
                bind:value={renameValue}
                onkeydown={(e) => {
                  if (e.key === "Enter") submitRename(file);
                  if (e.key === "Escape") renamingId = null;
                }}
                onblur={() => (renamingId = null)}
              />
            {:else}
              <button class="file-name" onclick={() => app.openBoardFile(file.id)}>
                {file.name}
              </button>
              <span class="file-ops">
                <button
                  class="op-btn"
                  title="重命名"
                  onclick={() => startRename(file)}
                >
                  ✏️
                </button>
                {#if board.files.length > 1}
                  <button class="op-btn" title="删除" onclick={() => removeFile(file)}>
                    🗑
                  </button>
                {/if}
              </span>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="list-tip">对应磁盘文件夹：life/{board.name}/</p>
    </aside>

    <!-- 右：编辑器 -->
    <div class="editor-pane">
      {#if openedFile}
        <BoardEditor {board} file={openedFile} />
      {:else}
        <div class="no-file card">
          <p>在左侧选择一个文档，或新建一个开始梳理思路。</p>
          <p class="sub">{previewText()}</p>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .folder {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .folder-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .crumbs {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .crumb-icon {
    font-size: var(--font-size-lg);
  }

  .crumb-name {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .crumb-path {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    background-color: var(--color-surface-alt);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crumb-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .btn-danger {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    background: transparent;
  }

  .btn-danger.armed {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .folder-body {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: var(--space-3);
    align-items: start;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .new-row {
    display: flex;
    gap: var(--space-1);
  }

  .new-row input {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .btn-sm {
    font-size: var(--font-size-xs);
    padding: var(--space-1) var(--space-2);
    white-space: nowrap;
  }

  .error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
  }

  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
  }

  .file-item:hover {
    background-color: var(--color-surface-alt);
  }

  .file-item.active {
    border-color: var(--color-primary);
    background-color: var(--color-surface-alt);
  }

  .file-name {
    flex: 1;
    min-width: 0;
    text-align: left;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    background: transparent;
    border: none;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .file-ops {
    display: flex;
    gap: 2px;
  }

  .op-btn {
    font-size: var(--font-size-xs);
    background: transparent;
    border: none;
    padding: 0 var(--space-1);
    cursor: pointer;
    opacity: 0.5;
  }

  .op-btn:hover {
    opacity: 1;
  }

  .rename-input {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    padding: 0 var(--space-1);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
  }

  .list-tip {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .editor-pane {
    min-width: 0;
  }

  .no-file {
    padding: var(--space-4);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }

  .no-file .sub {
    font-size: var(--font-size-xs);
    margin-top: var(--space-1);
  }
</style>
