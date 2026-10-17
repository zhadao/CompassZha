<script lang="ts">
  import { app } from "../../stores/app.svelte";
  import TodoList from "./TodoList.svelte";
  import QuickCapture from "./QuickCapture.svelte";
  import { formatDateCN } from "../../lib/date";
</script>

<div class="page">
  <p class="date-line">{formatDateCN(app.selectedDate)}</p>

  <TodoList />
  <QuickCapture />
</div>

<style>
  .page {
    position: relative;
  }

  .date-line {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-3);
  }
</style>
