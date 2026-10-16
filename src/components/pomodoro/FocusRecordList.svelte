<script lang="ts">
  /** 今日专注记录：倒序，实时刷新；空态引导（UI-005） */
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import type { FocusSession } from "../../types/schema";

  const todaySessions = $derived.by<FocusSession[]>(() =>
    app.focusSessions.filter((s) => s.date === todayKey()).slice().reverse(),
  );

  const totalMin = $derived(
    app.focusSessions
      .filter((s) => s.date === todayKey())
      .reduce((acc, s) => acc + s.minutes, 0),
  );
</script>

<section class="card block">
  <h2 class="block-title">
    今日专注记录
    {#if totalMin > 0}
      <span class="total">共 {totalMin} 分钟</span>
    {/if}
  </h2>
  {#if todaySessions.length === 0}
    <div class="empty-state">
      <p>还没有今天的专注记录——点击开始，第一次专注会出现在这里。</p>
    </div>
  {:else}
    <ul class="records">
      {#each todaySessions as s (s.id)}
        <li class="record">
          <span class="time">{s.startHHmm}</span>
          <span class="task">{s.task || "未命名专注"}</span>
          <span class="mode">{s.mode === "countdown" ? "倒计时" : "正计时"}</span>
          <span class="minutes">{s.minutes} 分钟</span>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="tip">每条记录实时追加到当日日记的「## 专注记录」章节，并累加 frontmatter 的 focus_minutes（500ms 防抖落盘 + 本地 git 提交）。</p>
</section>

<style>
  .block {
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .total {
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--color-primary);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-2);
  }

  .records {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .record {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .record .time {
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .record .task {
    flex: 1;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record .mode {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
  }

  .record .minutes {
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
