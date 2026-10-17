<script lang="ts">
  /**
   * 通用二次确认弹窗（v4.20 §2.9）：右键「删除文件」等危险动作的「确认删除？」
   * 二次确认，防误删。样式同既有删除弹窗（overlay + 小模态）。
   */
  interface Props {
    text: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }
  let { text, confirmLabel = "确认", onConfirm, onCancel }: Props = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onCancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="alertdialog" aria-modal="true" aria-label={text} tabindex="-1">
    <p class="dialog-text">{text}</p>
    <div class="dialog-actions">
      <button class="btn confirm" onclick={onConfirm}>{confirmLabel}</button>
      <button class="btn ghost" onclick={onCancel}>取消</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 210;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .dialog {
    width: min(340px, 100%);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dialog-text {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .btn {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    cursor: pointer;
  }

  /* v4.25：确认按钮改全站主按钮语义色（随主题色联动；深色模式对比达标） */
  .btn.confirm {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .btn.confirm:hover {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .btn.ghost {
    background: transparent;
    color: var(--color-text-secondary);
  }

  .btn.ghost:hover {
    background-color: var(--color-surface-alt);
  }
</style>
