<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import Icon from "../common/Icon.svelte";
  import BoardIcon from "../common/BoardIcon.svelte";
  import BoardEditor from "./BoardEditor.svelte";
  import BoardFolder from "./BoardFolder.svelte";
  import MottoZone from "./MottoZone.svelte";
  import ContextMenu, { type MenuItem } from "../common/ContextMenu.svelte";
  import BoardRenameDialog from "./BoardRenameDialog.svelte";
  import BoardDeleteDialog from "./BoardDeleteDialog.svelte";
  import type { LifeBoard } from "../../types/schema";

  let creating = $state(false);
  /** v4.20：卡片右键菜单 / 编辑与删除弹窗（座右铭区见 MottoZone） */
  let cardMenu = $state<{ x: number; y: number; board: LifeBoard } | null>(null);
  let renaming = $state<LifeBoard | null>(null);
  let deleting = $state<LifeBoard | null>(null);

  const openedBoard = $derived<LifeBoard | null>(
    app.lifeBoards.find((b) => b.id === app.openedLifeBoardId) ?? null,
  );

  /** v4.20：卡片右键 →「编辑 / 删除」菜单（§2.5） */
  function onCardMenu(e: MouseEvent, board: LifeBoard): void {
    e.preventDefault();
    cardMenu = { x: e.clientX, y: e.clientY, board };
  }

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
  {#if app.boardNotice}
    <!-- v4.9：板块删除结果横幅（告知热力图历史数据保留位置） -->
    <div class="board-notice">
      <span>{app.boardNotice}</span>
      <button class="notice-x" title="知道了" onclick={() => (app.boardNotice = null)}>
        <Icon name="close" size={20} />
      </button>
    </div>
  {/if}

  {#if !openedBoard}
    <!-- v4.20：座右铭大字展示区（life/座右铭.md 每行一条全部逐条显示；§2.5） -->
    <MottoZone />
  {/if}

  {#if openedBoard}
    <!-- 文件夹视图：进入该板块的 life/<板块名>/（v4.5 落实 v4.2 §2.5） -->
    <BoardFolder board={openedBoard} />
  {:else if creating}
    <!-- 新建板块表单 -->
    <BoardEditor mode="create" onDone={() => (creating = false)} />
  {:else if app.lifeBoards.length === 0}
    <!-- 空态：人生板块初始为空（v3.1：用户自建） -->
    <section class="empty card">
      <div class="empty-icon"><Icon name="life" size={54} /></div>
      <h2 class="empty-title">还没有任何板块</h2>
      <p class="empty-desc">
        每创建一个板块，相当于在「人生板块」文件夹里创建一个子文件夹；点开卡片进入文件夹视图——左侧是该板块的
        Markdown 文档列表，可以新建多个文档分别梳理不同思路，右侧直接编辑。
      </p>
      <button class="btn-primary" onclick={() => (creating = true)}>+ 新建板块</button>
    </section>
  {:else}
    <!-- 网格态：用户已建的板块 -->
    <section class="grid">
      {#each app.lifeBoards as board (board.id)}
        <button
          class="life-card card"
          class:active={app.selectedLifeBoardId === board.id}
          onclick={() => {
            select(board.id);
            app.openBoard(board.id);
          }}
          oncontextmenu={(e) => onCardMenu(e, board)}
        >
          <div class="card-icon">
            <BoardIcon icon={board.icon} size={45} />
          </div>
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

{#if cardMenu}
  {@const cardItems: MenuItem[] = [
    {
      label: "编辑",
      action: () => {
        renaming = cardMenu!.board;
      },
    },
    {
      label: "删除",
      danger: true,
      action: () => {
        deleting = cardMenu!.board;
      },
    },
  ]}
  <ContextMenu
    x={cardMenu.x}
    y={cardMenu.y}
    title={cardMenu.board.name}
    items={cardItems}
    onclose={() => (cardMenu = null)}
  />
{/if}
{#if renaming}
  <BoardRenameDialog board={renaming} onDone={() => (renaming = null)} />
{/if}
{#if deleting}
  <BoardDeleteDialog board={deleting} onCancel={() => (deleting = null)} />
{/if}

<style>
  /* v4.9：板块删除结果横幅 */
  .board-notice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .notice-x {
    display: inline-flex;
    margin-left: auto;
    color: var(--color-text-tertiary);
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .notice-x:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }
  .page {
    position: relative;
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
