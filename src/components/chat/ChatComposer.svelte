<script lang="ts">
  // 阶段 1 · A-2：隆中对输入区（自 ChatPage 抽出，保持组件单文件 ≤300 行）。
  // 固定在对话列底部（父级 flex 列的末项），随窗口拉伸；Enter 发送 / Shift+Enter 换行。
  let {
    value = $bindable(""),
    busy = false,
    onsend,
  }: { value?: string; busy?: boolean; onsend: () => void } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onsend();
    }
  }
</script>

<div class="composer">
  <textarea
    bind:value
    onkeydown={onKeydown}
    placeholder="输入问题，Enter 发送，Shift+Enter 换行"
    aria-label="输入对话问题"
    rows="2"
    disabled={busy}
  ></textarea>
  <button class="btn-primary" onclick={onsend} disabled={busy || !value.trim()}>发送</button>
</div>

<style>
  .composer {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .composer textarea {
    flex: 1;
    resize: vertical;
    min-height: 44px;
    max-height: 160px;
  }
</style>
