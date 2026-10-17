// 语料转化前置说明弹窗（v4.26 §2.14）：点「语料转化」先说明支持范围与扫描件限制，
// 用户确认后再进入文件选择。独立组件（ChatPage 已超 300 行，不再内联）。
// 样式复用 ChatHelp.svelte 的 overlay/panel 模式。
<script lang="ts">
  import Icon from "../common/Icon.svelte";

  interface Props {
    onconfirm: () => void;
    oncancel: () => void;
  }
  let { onconfirm, oncancel }: Props = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") oncancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="语料转化说明" tabindex="-1">
    <header class="panel-head">
      <h2>语料转化说明</h2>
      <button class="close" onclick={oncancel} aria-label="关闭说明">
        <Icon name="close" size={24} />
      </button>
    </header>

    <div class="panel-body">
      <ul>
        <li>
          <b>支持的格式：</b>只有 <b>PDF</b> 和 <b>EPUB</b> 两种电子书格式。
          程序会把它们自动转成 Markdown（<code>.md</code>）存进语料库——
          AI 最终读取的就是这些 md 文件。
        </li>
        <li>
          <b>PDF 有限制：</b>只有<b>带文字层</b>的 PDF（能选中、能复制文字）可以转化。
          <b>扫描件不行</b>——那种每页其实是一张图片，文件里没有文字，程序读不出任何内容。
        </li>
        <li>
          <b>如果是扫描件：</b>请先用 OCR 工具把它转成「可搜索的双层 PDF」
          （推荐 <b>Umi-OCR</b>：免费、离线、Windows 桌面版），再回到这里导入；
          或者直接找这本书的 <b>EPUB</b> 版本导入，效果更好。
        </li>
      </ul>
    </div>

    <footer class="panel-foot">
      <button class="btn" onclick={oncancel}>取消</button>
      <button class="btn primary" onclick={onconfirm}>开始转化</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background-color: var(--color-overlay, rgb(0 0 0 / 0.35));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    padding: var(--space-4);
  }

  .panel {
    background-color: var(--color-surface);
    border-radius: var(--radius-md, 10px);
    width: min(520px, 100%);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-head h2 {
    font-size: var(--font-size-md);
    margin: 0;
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

  .panel-body {
    padding: var(--space-3) var(--space-4);
    overflow-y: auto;
  }

  ul {
    margin: 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  li {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  code {
    background-color: var(--color-surface-alt);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
  }

  .panel-foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .btn {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .btn:hover {
    background-color: var(--color-surface-alt);
  }

  /* v4.25 语义色：主按钮随主题色联动（同 ConfirmDialog） */
  .btn.primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .btn.primary:hover {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }
</style>
