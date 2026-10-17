<script lang="ts">
  /**
   * v4.22 §2.11-B：关闭方式弹窗（三段式第一段）。
   * 首次（或未记忆偏好）点关闭时由 Rust 发 `close-requested` 事件唤起；
   * 选择结果由 App.svelte 交给 Rust 执行（直接退出 / 隐藏到托盘）。
   * 「记住我的选择」勾选后偏好写入 config.json 的 close_behavior，此后不再询问。
   */
  import type { CloseBehavior } from "../../lib/tauri-fs";

  interface Props {
    onConfirm: (behavior: CloseBehavior, remember: boolean) => void;
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();

  let choice = $state<CloseBehavior>("exit");
  let remember = $state(false);
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onCancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="关闭 CompassZha" tabindex="-1">
    <h2 class="dialog-title">关闭 CompassZha</h2>
    <p class="dialog-hint">
      选择关闭方式。最小化到托盘后程序仍在后台运行，隆中对会话不会丢失。
    </p>

    <div class="options" role="radiogroup" aria-label="关闭方式">
      <label class="option">
        <input type="radio" name="close-behavior" value="exit" bind:group={choice} />
        <span>直接退出（结束程序）</span>
      </label>
      <label class="option">
        <input type="radio" name="close-behavior" value="tray" bind:group={choice} />
        <span>最小化到托盘（后台保持运行）</span>
      </label>
    </div>

    <label class="remember">
      <input type="checkbox" bind:checked={remember} />
      <span>记住我的选择（可在「设置 → 窗口」中修改）</span>
    </label>

    <div class="dialog-actions">
      <button class="btn-primary" onclick={() => onConfirm(choice, remember)}>确定</button>
      <button class="btn-secondary" onclick={onCancel}>取消</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .dialog {
    width: min(400px, 100%);
    padding: var(--space-4);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dialog-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
  }

  .dialog-hint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .option,
  .remember {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .remember {
    padding-top: var(--space-1);
    border-top: 1px solid var(--color-border);
  }

  .option input,
  .remember input {
    accent-color: var(--color-primary);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
