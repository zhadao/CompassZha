<script lang="ts">
  // 说明书目录（v4.40 C-1 从 Manual.svelte 拆出，CODE-003）：上手册默认展开、进阶册默认折叠。
  // 正文里的助读跳转（data-jump）若命中进阶册章节，由 activeId 变化自动把该册展开。
  import { CHAPTERS } from "./content";

  interface Props {
    /** 当前可见章节 id（父组件按 IntersectionObserver 维护） */
    activeId: string;
    /** 点击目录项 → 父组件在正文容器内滚动 */
    onjump: (id: string) => void;
  }
  let { activeId, onjump }: Props = $props();

  const isAdv = (group: string) => group.startsWith("进阶");

  /** group → chapters（CHAPTERS 为静态数据，只需算一次） */
  const GROUPS = (() => {
    const map = new Map<string, typeof CHAPTERS>();
    for (const ch of CHAPTERS) {
      const arr = map.get(ch.group) ?? [];
      arr.push(ch);
      map.set(ch.group, arr);
    }
    return [...map.entries()].map(([group, chapters]) => ({ group, chapters }));
  })();

  const UP = GROUPS.filter((g) => !isAdv(g.group));
  const ADV = GROUPS.filter((g) => isAdv(g.group));

  /** 目录里展示时去掉「进阶 · 」前缀（册标题已表达层级） */
  const advLabel = (group: string) => group.replace(/^进阶\s*·\s*/, "");

  let advOpen = $state(false);

  $effect(() => {
    if (ADV.some((g) => g.chapters.some((c) => c.id === activeId))) advOpen = true;
  });
</script>

<aside class="toc">
  <p class="book">上手册</p>
  {#each UP as g (g.group)}
    <div class="toc-group">
      <p class="toc-group-title">{g.group}</p>
      {#each g.chapters as ch (ch.id)}
        <button class="toc-item" class:active={activeId === ch.id} onclick={() => onjump(ch.id)}>
          {ch.title}
        </button>
      {/each}
    </div>
  {/each}

  <p class="book">
    <button class="book-toggle" onclick={() => (advOpen = !advOpen)} aria-expanded={advOpen}>
      <span class="caret" class:open={advOpen}>▸</span>
      进阶册
    </button>
  </p>
  {#if advOpen}
    {#each ADV as g (g.group)}
      <div class="toc-group">
        <p class="toc-group-title">{advLabel(g.group)}</p>
        {#each g.chapters as ch (ch.id)}
          <button class="toc-item" class:active={activeId === ch.id} onclick={() => onjump(ch.id)}>
            {ch.title}
          </button>
        {/each}
      </div>
    {/each}
  {/if}
</aside>

<style>
  .toc {
    flex-shrink: 0;
    width: 232px;
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .book {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-title);
  }

  .book + .toc-group {
    margin-top: var(--space-2);
  }

  .book-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
  }

  .book-toggle:hover {
    color: var(--color-primary);
  }

  .caret {
    display: inline-block;
    font-size: 10px;
    line-height: 1;
    transition: transform var(--transition-fast);
  }

  .caret.open {
    transform: rotate(90deg);
  }

  .toc-group + .toc-group {
    margin-top: var(--space-3);
  }

  .toc-group-title {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-tertiary);
  }

  .toc-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    transition: all var(--transition-fast);
  }

  .toc-item:hover {
    background: var(--color-surface);
    color: var(--color-text-primary);
  }

  .toc-item.active {
    background: var(--color-primary-light);
    color: var(--color-title);
    font-weight: 600;
  }
</style>
