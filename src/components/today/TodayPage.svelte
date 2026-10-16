<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import StaticBadge from "../layout/StaticBadge.svelte";
  import TodoList from "./TodoList.svelte";
  import QuickCapture from "./QuickCapture.svelte";
  import { formatDateCN } from "../../lib/date";

  // 分区说明（每页含「干什么」一句话说明，对齐原型文档 §4.4 约定）
  const purpose =
    "干什么：写当天日记、勾选今日清单、用右侧表单录入睡眠/体重/支出等量化数据——全部实时落盘到当日 Markdown 文件。";
</script>

<div class="page">
  <StaticBadge mode="live" />
  <p class="purpose">{purpose}</p>
  <p class="date-line">{formatDateCN(app.selectedDate)}</p>

  <TodoList />
  <QuickCapture />
</div>

<style>
  .page {
    position: relative;
  }

  .purpose {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .date-line {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-3);
  }
</style>
