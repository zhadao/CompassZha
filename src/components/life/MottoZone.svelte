<script lang="ts">
  /**
   * 座右铭大字展示区（v4.20 §2.5）：life/座右铭.md 每行一条全部逐条展示；
   * 字号 = 「人生板块」标题 ×2.5（过长自动换行）；「写作」按钮打开编辑弹窗；
   * 空态淡色提示「填写你的座右铭」；分割线与下方板块网格区隔。
   */
  import { app } from "../../stores/app.svelte";
  import Icon from "../common/Icon.svelte";
  import MottoDialog from "./MottoDialog.svelte";

  let mottoOpen = $state(false);
</script>

<section class="motto-zone" aria-label="座右铭">
  {#if app.mottos.length > 0}
    {#each app.mottos as m, i (i)}
      <p class="motto-line">{m}</p>
    {/each}
  {:else}
    <p class="motto-line placeholder">填写你的座右铭</p>
  {/if}
  <button
    class="motto-edit"
    title="填写你的座右铭"
    aria-label="填写你的座右铭"
    onclick={() => (mottoOpen = true)}
  >
    <Icon name="writing" size={21} />
  </button>
</section>

{#if mottoOpen}
  <MottoDialog onclose={() => (mottoOpen = false)} />
{/if}

<style>
  .motto-zone {
    position: relative;
    padding: var(--space-2) var(--space-4) var(--space-4);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .motto-line {
    margin: 0;
    font-size: calc(var(--font-size-xl) * 2.5);
    line-height: 1.25;
    font-weight: 700;
    color: var(--color-title);
    word-break: break-word;
  }

  .motto-line + .motto-line {
    margin-top: var(--space-2);
  }

  .motto-line.placeholder {
    color: var(--color-text-tertiary);
    font-weight: 400;
  }

  .motto-edit {
    position: absolute;
    top: 0;
    right: var(--space-2);
    display: inline-flex;
    padding: var(--space-1);
    color: var(--color-text-tertiary);
    border-radius: var(--radius-sm);
  }

  .motto-edit:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }
</style>
