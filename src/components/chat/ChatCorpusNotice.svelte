<script lang="ts">
  /**
   * D-8①②：隆中对语料引导区（从 ChatPage 抽出，CODE-003）。
   * ① 首开引导卡：AI 配好后首次进入显示一次，点任一按钮即标记「已看过」不再出现；
   * ② 空语料轻提示：语料库为空时给一条浅色提示 + 「打开语料文件夹」，不阻断对话、不报错。
   */
  interface Props {
    /** 语料文件数；null = 尚未读到（不提示） */
    fileCount: number | null;
    /** 首开引导是否已看过 */
    guideSeen: boolean;
    onOpenCorpus: () => void;
    onDismissGuide: () => void;
  }

  let { fileCount, guideSeen, onOpenCorpus, onDismissGuide }: Props = $props();
</script>

{#if !guideSeen}
  <div class="guide card">
    <h2>先给诸葛孔明备点材料</h2>
    <p>
      把你要它读的 Markdown 放进语料文件夹（支持 .md / .txt / .json，也可用上方「语料转化」把
      PDF / EPUB 转进来）。提问时它会先检索语料，再以语料为依据回答并标注出处。
    </p>
    <div class="acts">
      <button class="btn-primary" onclick={onOpenCorpus}>打开语料文件夹</button>
      <button class="btn-secondary" onclick={onDismissGuide}>我知道了</button>
    </div>
  </div>
{:else if fileCount === 0}
  <div class="notice">
    <span class="notice-text">语料库还是空的，先丢几份 .md 进去，回答会更准。</span>
    <button class="btn-secondary notice-btn" onclick={onOpenCorpus}>打开语料文件夹</button>
  </div>
{/if}

<style>
  .guide {
    padding: var(--space-4);
    flex-shrink: 0;
  }

  .guide h2 {
    font-size: var(--font-size-md);
    margin: 0 0 var(--space-2);
  }

  .guide p {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3);
    line-height: 1.7;
  }

  .acts {
    display: flex;
    gap: var(--space-2);
  }

  .acts .btn-primary,
  .acts .btn-secondary {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-alt);
  }

  /* CJK 防挤：长说明可收缩、按钮不折行 */
  .notice-text {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .notice-btn {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--font-size-xs);
  }
</style>
