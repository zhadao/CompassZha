<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import StaticBadge from "../layout/StaticBadge.svelte";
  import BoardEditor from "./BoardEditor.svelte";
  import BoardFolder from "./BoardFolder.svelte";
  import type { LifeBoard } from "../../types/schema";

  const purpose =
    "干什么：每个板块是 life/ 下一个文件夹，点开卡片进入文件夹——左侧文档列表，右侧编辑器，在里面新建多个 Markdown 分别梳理思路，每天 check 自己。";

  let creating = $state(false);

  const openedBoard = $derived<LifeBoard | null>(
    app.lifeBoards.find((b) => b.id === app.openedLifeBoardId) ?? null,
  );

  /** 网格态点击卡片：右栏摘要联动 + 打开文件夹视图 */
  function select(id: string): void {
    app.selectedLifeBoardId = id;
  }

  /** 卡片副标题：默认文件正文去 frontmatter 后首行非空行 */
  function preview(board: LifeBoard): string {
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

<div class="page">
  <StaticBadge />

  {#if openedBoard}
    <!-- 文件夹视图：进入该板块的 life/<板块名>/ -->
    <BoardFolder board={openedBoard} />
  {:else if creating}
    <!-- 新建板块表单 -->
    <BoardEditor mode="create" onDone={() => (creating = false)} />
  {:else if app.lifeBoards.length === 0}
    <!-- 空态：人生板块初始为空（v3.1：用户自建） -->
    <p class="purpose">{purpose}</p>
    <section class="empty card">
      <div class="empty-icon">🧭</div>
      <h2 class="empty-title">还没有任何板块</h2>
      <p class="empty-desc">
        每创建一个板块，相当于在「人生板块」文件夹里创建一个子文件夹；点开卡片进入文件夹视图——左侧是该板块的
        Markdown 文档列表，可以新建多个文档分别梳理不同思路，右侧直接编辑。
      </p>
      <button class="btn-primary" onclick={() => (creating = true)}>+ 新建板块</button>
    </section>
  {:else}
    <!-- 网格态：用户已建的板块 -->
    <p class="purpose">{purpose}</p>
    <section class="grid">
      {#each app.lifeBoards as board (board.id)}
        <button
          class="life-card card"
          class:active={app.selectedLifeBoardId === board.id}
          onclick={() => {
            select(board.id);
            app.openBoard(board.id);
          }}
        >
          <div class="card-icon">{board.icon}</div>
          <div class="card-name">{board.name}</div>
          <div class="card-scope">{preview(board)}</div>
          <div class="card-count">{board.files.length} 个文档</div>
        </button>
      {/each}
      <button class="life-card add-card" onclick={() => (creating = true)}>
        <div class="card-icon">＋</div>
        <div class="card-name">新建板块</div>
        <div class="card-scope">life/ 下再加一个子文件夹</div>
      </button>
    </section>
  {/if}
</div>

<style>
  .page {
    position: relative;
  }

  .purpose {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-3);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: calc(var(--space-4) * 2) var(--space-4);
    text-align: center;
  }

  .empty-icon {
    font-size: var(--font-size-xl);
  }

  .empty-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .empty-desc {
    max-width: 460px;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.7;
    margin-bottom: var(--space-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }

  @media (min-width: 1000px) {
    .grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .life-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    padding: var(--space-3);
    text-align: left;
    transition: all var(--transition-fast);
  }

  .life-card:hover {
    border-color: var(--color-border-strong);
    transform: translateY(-2px);
  }

  .life-card.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .add-card {
    border-style: dashed;
    color: var(--color-text-tertiary);
  }

  .add-card .card-name {
    color: var(--color-text-secondary);
  }

  .card-icon {
    font-size: var(--font-size-xl);
  }

  .card-name {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .card-scope {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .card-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
