<script lang="ts">
  import { app } from "../../stores/app.svelte";

  // 临时记录 + 今日收尾（三段式后两段）
  let notes = $state(app.note.notes);
  let review = $state(app.note.review);

  // 切换日期时同步内容（文件树选择日期后进入今日页）
  $effect(() => {
    notes = app.note.notes;
    review = app.note.review;
  });

  function onNotesBlur(): void {
    app.setNotes(app.selectedDate, notes);
  }

  function onReviewBlur(): void {
    app.setReview(app.selectedDate, review);
  }
</script>

<section class="card block">
  <h2 class="block-title">临时记录</h2>
  <textarea
    class="memo-area"
    rows="4"
    placeholder="白天冒出来的想法、临时记录，先放这里……（失焦即保存到内存）"
    bind:value={notes}
    onblur={onNotesBlur}
  ></textarea>
</section>

<section class="card block">
  <h2 class="block-title">今日收尾</h2>
  <textarea
    class="memo-area review-area"
    rows="2"
    placeholder="睡前写一句对今天的判断：完成了什么？卡在哪？（lifeos 式晚间闭环）"
    bind:value={review}
    onblur={onReviewBlur}
  ></textarea>
</section>

<style>
  .block {
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .memo-area {
    width: 100%;
    resize: vertical;
    line-height: 1.6;
    padding: var(--space-2);
  }
</style>
