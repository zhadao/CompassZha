<script lang="ts">
  /**
   * D-8 / CODE-003：隆中对工具栏（自 ChatPage 抽出）。
   * 纯展示 + 回调：不持有业务状态，按钮可用性由传入的布尔量决定。
   */
  import Icon from "../common/Icon.svelte";

  interface Props {
    /** 语料转化进行中（禁用按钮并改文案） */
    importing: boolean;
    /** 已有对话气泡数（0 = 无内容可保存） */
    bubbleCount: number;
    busy: boolean;
    corpusDir: string;
    onOpenCorpus: () => void;
    onConvert: () => void;
    onCards: () => void;
    onSave: () => void;
    onHelp: () => void;
  }

  let {
    importing,
    bubbleCount,
    busy,
    corpusDir,
    onOpenCorpus,
    onConvert,
    onCards,
    onSave,
    onHelp,
  }: Props = $props();

  const canSave = $derived(bubbleCount > 0 && !busy);
</script>

<div class="toolbar">
  <button class="btn-secondary tool-btn" onclick={onOpenCorpus}>
    <Icon name="file" size={21} />
    资源跳转
  </button>
  <button
    class="btn-secondary tool-btn"
    disabled={importing}
    title="把 PDF / EPUB 电子书转成 Markdown，存入语料库"
    onclick={onConvert}
  >
    <Icon name="writing" size={21} />
    {importing ? "正在转化…" : "语料转化"}
  </button>
  <button class="btn-secondary tool-btn" onclick={onCards}>
    <Icon name="index-card" size={21} />
    索引卡
  </button>
  <button
    class="btn-secondary tool-btn"
    disabled={!canSave}
    title={bubbleCount === 0 ? "当前没有对话可保存" : "把本轮对话保存为 Markdown"}
    onclick={onSave}
  >
    <Icon name="writing" size={21} />
    保存本轮对话
  </button>
  <button class="btn-secondary tool-btn" onclick={onHelp}>
    <Icon name="help" size={21} />
    说明
  </button>
  {#if corpusDir}
    <span class="corpus-path" title={corpusDir}>语料库：{corpusDir}</span>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap; /* v4.26：窄空间按钮整体换行，避免单个按钮文字被竖排 */
    align-items: center;
    gap: var(--space-2);
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap; /* v4.26：按钮文字禁止折行（「索引卡」曾被竖排三行） */
    flex-shrink: 0;
  }

  .corpus-path {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-left: auto;
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
