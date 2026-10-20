<script lang="ts">
  // 说明书弹层（v4.30 §2.16）：左侧目录分组可跳转 + 右侧正文（独立滚动）。
  // 正文为 content.ts 的自撰静态 HTML，用事件委托处理两种标记：
  //   [data-jump] → 主题色标亮的关键词，点击滚到对应章节/锚点（助读）；
  //   [data-url]  → 外链，打开系统浏览器（open_url_https，回退 window.open）。
  // 组件 ≤300 行（CODE-003）；目录已拆到 ManualCatalog.svelte（v4.40 C-1）。
  import { onMount } from "svelte";
  import Icon from "../common/Icon.svelte";
  import ManualCatalog from "./ManualCatalog.svelte";
  import { CHAPTERS } from "./content";
  import { openUrlHttps } from "../../lib/tauri-fs";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let docEl = $state<HTMLElement | null>(null);
  let activeId = $state("");

  /** 在正文滚动容器内滚到目标章节 / 锚点 */
  function scrollTo(id: string) {
    const el = docEl?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** 外链直达浏览器；Tauri 外链失败回退 window.open（沿用 AuthorDialog 范式） */
  async function openExt(url: string) {
    try {
      await openUrlHttps(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  function onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const url = t.closest<HTMLElement>("[data-url]")?.dataset.url;
    if (url) {
      e.preventDefault();
      void openExt(url);
      return;
    }
    const jump = t.closest<HTMLElement>("[data-jump]")?.dataset.jump;
    if (jump) {
      e.preventDefault();
      scrollTo(jump);
    }
  }

  onMount(() => {
    if (!docEl) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) activeId = (en.target as HTMLElement).id;
      },
      { root: docEl, rootMargin: "0px 0px -72% 0px", threshold: 0 },
    );
    docEl.querySelectorAll("section[data-chapter]").forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="CompassZha 说明书" tabindex="-1">
    <header class="panel-head">
      <h2 class="panel-title"><Icon name="help" size={20} /> CompassZha 说明书</h2>
      <button class="close" onclick={onclose} aria-label="关闭说明书">
        <Icon name="close" size={24} />
      </button>
    </header>

    <div class="panel-body">
      <ManualCatalog {activeId} onjump={scrollTo} />

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <article class="doc" bind:this={docEl} onclick={onDocClick}>
        {#each CHAPTERS as ch (ch.id)}
          <section id={ch.id} data-chapter>
            <h3>{ch.title}</h3>
            {@html ch.html}
          </section>
        {/each}
      </article>
    </div>

    <footer class="panel-foot">
      <button class="btn-primary" onclick={onclose}>知道了</button>
    </footer>
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
    padding: var(--space-4);
    background: rgb(17 24 39 / 32%);
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: min(1040px, calc(100vw - 48px));
    max-height: calc(100vh - 80px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-md, 16px);
    color: var(--color-title);
  }

  .close {
    display: inline-flex;
    color: var(--color-text-tertiary);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }

  /* 双栏：目录（固定）+ 正文（独立滚动） */
  .panel-body {
    display: flex;
    min-height: 0;
    flex: 1;
  }

  .doc {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5, 20px);
    font-size: var(--font-size-sm, 13px);
    line-height: 1.8;
    color: var(--color-text-secondary);
  }

  .doc section + section {
    margin-top: var(--space-5, 20px);
    padding-top: var(--space-4);
    border-top: 1px dashed var(--color-border);
  }

  .doc :global(h3) {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-md, 16px);
    color: var(--color-title);
  }

  .doc :global(h4) {
    margin: var(--space-3) 0 var(--space-1);
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-primary);
  }

  .doc :global(p) {
    margin: 0 0 var(--space-2);
  }

  .doc :global(ul),
  .doc :global(ol) {
    margin: 0 0 var(--space-2);
    padding-left: var(--space-5, 20px);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* 关键词高亮（主题色）+ 点击助读跳转 */
  .doc :global(.kw) {
    color: var(--color-primary);
    border-bottom: 1px dashed var(--color-primary);
    cursor: pointer;
  }

  .doc :global(.kw:hover) {
    background: var(--color-primary-tint, var(--color-primary-light));
  }

  /* 外链 */
  .doc :global(.ext) {
    color: var(--color-primary);
    cursor: pointer;
    white-space: nowrap;
  }

  .doc :global(.ext:hover) {
    text-decoration: underline;
  }

  .doc :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-xs, 12px);
  }

  .doc :global(th),
  .doc :global(td) {
    border: 1px solid var(--color-border);
    padding: var(--space-1) var(--space-2);
    text-align: left;
    vertical-align: top;
  }

  .doc :global(th) {
    background: var(--color-surface-alt);
    color: var(--color-text-tertiary);
    font-weight: 600;
  }

  .doc :global(code) {
    font-size: 0.92em;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .doc :global(.lead) {
    color: var(--color-text-primary);
  }

  .doc :global(.tip) {
    margin: var(--space-2) 0 0;
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--color-primary);
    background: var(--color-surface-alt);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs, 12px);
    color: var(--color-text-tertiary);
  }

  .panel-foot {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
  }
</style>
