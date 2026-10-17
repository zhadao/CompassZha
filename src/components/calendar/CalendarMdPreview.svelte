<script lang="ts">
  /**
   * 当日事件 · Markdown 预览卡（从 CalendarPage 拆出，v4.21；CODE-003 组件 ≤300 行）。
   * 展示「与该日 daily 文件 ## 日程 章节写入格式一致」的文本，并提供一键复制。
   */
  import { app } from "../../stores/app.svelte";
  import { eventsToMarkdown } from "../../lib/markdown";

  let copied = $state(false);

  const mdPreview = $derived(eventsToMarkdown(app.selectedDate, app.events));

  /** 复制预览文本（浏览器 clipboard API，无网络） */
  async function copyMd(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mdPreview);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // 无头 / 无剪贴板权限环境静默失败
    }
  }
</script>

<section class="card md-card">
  <div class="md-head">
    <h3 class="md-title">当日事件 · Markdown 预览（{app.selectedDate}）</h3>
    <button class="btn-secondary" onclick={copyMd}>{copied ? "已复制" : "复制"}</button>
  </div>
  <pre class="md-pre">{mdPreview}</pre>
  <p class="md-note">
    日历事件已实时以该格式写入当日文件的「## 日程」章节（新建/编辑/拖拽均防抖落盘 + 本地 git
    提交）——Markdown 对 AI 足够可读，单文件即一天全貌。
  </p>
</section>

<style>
  .md-card {
    margin-top: var(--space-3);
    padding: var(--space-3);
  }

  .md-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .md-title {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .md-pre {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    line-height: 1.8;
    color: var(--color-text-secondary);
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .md-note {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
