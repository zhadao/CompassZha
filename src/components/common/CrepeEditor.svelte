<script lang="ts">
  /**
   * 可复用所见即所得 Markdown 编辑器（@milkdown/crepe 7.22 封装，v4.4）。
   * - 挂载即创建 Crepe（defaultValue = value），卸载即销毁；
   * - 文档每次变更回调 onUpdate（最新 Markdown 串）；防抖与落盘由调用方负责；
   * - WebView 兼容性已通过 Edge 无头探针验证（挂载/可编辑/roundtrip/监听全绿）；
   * - v4.5 工具栏精简：关 Toolbar/TopBar/LaTeX/ImageBlock/BlockEdit（用户反馈「一堆看不懂的图标」
   *   ——「+」插入区块菜单样式混乱），保留静默写作功能（需求文档 v4.5 §2.2 约定）。
   * - v4.28 再精简：补关 LinkTooltip——正文底部常驻的链接浮层（铅笔/垃圾桶图标 + 「Paste link...」
   *   输入框）此前未被关闭，属用户反馈的多余 UI（需求文档 v4.28 §2.2）。
   */
  import { onMount, onDestroy } from "svelte";
  import { Crepe, CrepeFeature } from "@milkdown/crepe";
  import "@milkdown/crepe/theme/frame.css";

  interface Props {
    /** 初始 Markdown（仅挂载时读取一次；换文档请用 {#key} 重挂载） */
    value: string;
    /** 文档变更回调（每次按键都会触发） */
    onUpdate: (md: string) => void;
  }
  let { value, onUpdate }: Props = $props();

  let rootEl = $state<HTMLElement | null>(null);
  let crepe: Crepe | null = null;
  let disposed = false;

  onMount(() => {
    if (!rootEl) return;
    const c = new Crepe({
      root: rootEl,
      defaultValue: value,
      features: {
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.BlockEdit]: false,
        // v4.28：关闭链接浮层——此前漏关，正文底部常驻「铅笔/垃圾桶图标 + Paste link... 输入框」
        [CrepeFeature.LinkTooltip]: false,
      },
    });
    c.on((api) => {
      api.markdownUpdated((_ctx, md) => onUpdate(md));
    });
    void c
      .create()
      .then(() => {
        if (disposed) {
          void c.destroy();
          return;
        }
        crepe = c;
      })
      .catch((err) => console.error("[CrepeEditor] 编辑器创建失败", err));
  });

  onDestroy(() => {
    disposed = true;
    void crepe?.destroy();
    crepe = null;
  });
</script>

<div class="crepe-root" bind:this={rootEl}></div>

<style>
  .crepe-root {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-surface);
    overflow: hidden;
  }

  /* Crepe 挂载后内容注入 .crepe > .milkdown；浅色卡片风格对齐 tokens.css */
  .crepe-root :global(.milkdown) {
    min-height: 320px;
    padding: var(--space-3) var(--space-4);
    outline: none;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .crepe-root :global(.milkdown .ProseMirror) {
    min-height: 300px;
  }
</style>
