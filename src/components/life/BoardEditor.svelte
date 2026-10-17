<script lang="ts">
  /**
   * 板块编辑器（v4.5：板块文件夹视图内的右侧编辑器）。
   * - mode="create"：新建板块表单（名称 + 自绘 SVG 图标选择）→ app.createBoard（= 在 life/ 下建子文件夹）
   * - 传入 { board, file }：该板块内单个 Markdown 文件的所见即所得编辑（正文编辑、frontmatter 保留）
   * v4.17：icon 字段存「svg:键名」；旧 emoji 数据由展示层回退，不迁移。
   */
  import { app } from "../../stores/app.svelte";
  import { BOARD_ICONS } from "../../mock/preview";
  import { dailyBody, replaceBody } from "../../lib/markdown";
  import type { BoardFile, LifeBoard } from "../../types/schema";
  import CrepeEditor from "../common/CrepeEditor.svelte";
  import Icon from "../common/Icon.svelte";

  interface Props {
    mode?: "create";
    board?: LifeBoard;
    file?: BoardFile;
    onDone?: () => void;
  }
  let { mode, board, file, onDone }: Props = $props();

  let name = $state("");
  let icon = $state(BOARD_ICONS[0]);
  let error = $state("");

  function submitCreate(e: SubmitEvent): void {
    e.preventDefault();
    if (!name.trim()) {
      error = "给板块起个名字";
      return;
    }
    app.createBoard(name, `svg:${icon}`);
    name = "";
    error = "";
    onDone?.();
  }

  /** 编辑器正文变更 → 与 frontmatter 合并回全文 → 既有 debounce 落盘通道 */
  function updateBody(md: string): void {
    if (!board || !file) return;
    app.updateBoardFile(board.id, file.id, replaceBody(file.content, md));
  }
</script>

{#if mode === "create"}
  <!-- 新建板块表单 -->
  <section class="card editor">
    <h2 class="editor-title">新建板块</h2>
    <p class="hint">
      创建后相当于在「人生板块」文件夹里多一个子文件夹；点开卡片进入文件夹视图，可以在里面新建多个
      Markdown 文档分别梳理思路。
    </p>
    <form class="form" onsubmit={submitCreate}>
      <label class="field">
        <span class="label">板块名称</span>
        <input
          type="text"
          placeholder="例如：长期项目 · 自由职业 · 家庭"
          maxlength="20"
          bind:value={name}
        />
      </label>
      <div class="field">
        <span class="label">图标</span>
        <div class="icon-grid">
          {#each BOARD_ICONS as ic (ic)}
            <button
              type="button"
              class="icon-btn"
              class:active={icon === ic}
              aria-label={`选择图标 ${ic}`}
              onclick={() => (icon = ic)}
            >
              <Icon name={ic} size={39} />
            </button>
          {/each}
        </div>
      </div>
      <div class="actions">
        <button class="btn-primary" type="submit">创建</button>
        <button class="btn-secondary" type="button" onclick={() => onDone?.()}>取消</button>
        {#if error}
          <span class="error">{error}</span>
        {/if}
      </div>
    </form>
  </section>
{:else if board && file}
  <!-- 板块内单个 Markdown 文件编辑 -->
  <div class="editor-shell">
    {#key file.id}
      {@const bodyText = dailyBody(file.content)}
      <CrepeEditor value={bodyText} onUpdate={updateBody} />
    {/key}
  </div>
  <footer class="editor-footer">
    所见即所得编辑实时生效，自动写入 life/{board.name}/{file.name} 并本地 git 提交。
  </footer>
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .editor-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 520px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: var(--space-1);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
  }

  .icon-btn.active {
    border-color: var(--color-primary);
    background-color: var(--color-surface-alt);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
  }

  .editor-shell {
    width: 100%;
  }

  .editor-footer {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
