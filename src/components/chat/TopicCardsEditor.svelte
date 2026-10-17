<script lang="ts">
  // 索引卡编辑弹层（v4.12 · 检查点 4.4）：8 张主题卡 = AI 检索前的标签路由。
  // 弹层内固定提示「索引卡是 AI 的路由依据，不建议频繁更改」；保存整组写回 config.json。
  import { onMount } from "svelte";
  import { persist } from "../../lib/tauri-fs";
  import { configGetTopics, configSetTopics, type TopicCard } from "../../lib/ai";
  import Icon from "../common/Icon.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let cards: TopicCard[] = $state([]);
  let loaded = $state(false);
  let busy = $state(false);
  let feedback = $state("");
  let feedbackErr = $state(false);

  onMount(async () => {
    if (!persist) {
      loaded = true;
      return;
    }
    try {
      cards = await configGetTopics();
    } catch (e) {
      notice(`${e}`, true);
    }
    loaded = true;
  });

  function notice(text: string, err = false) {
    feedback = text;
    feedbackErr = err;
  }

  function addCard() {
    const n = cards.length + 1;
    cards = [
      ...cards,
      { id: `topic-${n}-${Date.now().toString(36)}`, name: "新主题", keywords: "", desc: "" },
    ];
  }

  function removeCard(i: number) {
    cards = cards.filter((_, idx) => idx !== i);
  }

  async function save() {
    busy = true;
    try {
      await configSetTopics(cards);
      notice("索引卡已保存（下次提问生效）");
    } catch (e) {
      notice(`${e}`, true);
    }
    busy = false;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="索引卡编辑" tabindex="-1">
    <header class="panel-head">
      <h2>索引卡</h2>
      <button class="close" onclick={onclose} aria-label="关闭索引卡编辑">
        <Icon name="close" size={24} />
      </button>
    </header>

    <div class="panel-body">
      <p class="warn">
        索引卡是 AI 的路由依据，不建议频繁更改——卡是检索前帮 AI「选书架」用的，
        除非明确新的主题方向，保持现状即可。
      </p>

      {#if !loaded}
        <p class="muted">正在读取…</p>
      {:else if !persist}
        <p class="muted">浏览器预览模式——索引卡编辑需在桌面应用内使用</p>
      {:else}
        {#each cards as card, i (card.id)}
          <fieldset class="card-item">
            <legend>卡 {i + 1}</legend>
            <label class="field">
              <span>名称</span>
              <input type="text" bind:value={card.name} aria-label="索引卡名称" />
            </label>
            <label class="field">
              <span>检索关键词（逗号分隔，可留空）</span>
              <input
                type="text"
                bind:value={card.keywords}
                placeholder="例：职业、跳槽、转行"
                aria-label="索引卡关键词"
              />
            </label>
            <label class="field">
              <span>描述（这张卡代表什么主题，可留空）</span>
              <input type="text" bind:value={card.desc} aria-label="索引卡描述" />
            </label>
            <button
              class="btn-secondary remove"
              onclick={() => removeCard(i)}
              disabled={cards.length <= 1}
            >
              删除此卡
            </button>
          </fieldset>
        {/each}

        <div class="actions">
          <button class="btn-secondary" onclick={addCard}>＋ 新增卡</button>
          <button class="btn-primary" onclick={() => void save()} disabled={busy}>
            保存
          </button>
        </div>
        {#if feedback}
          <p class="feedback" class:err={feedbackErr}>{feedback}</p>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background-color: rgb(0 0 0 / 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-4);
  }

  .panel {
    background-color: var(--color-surface);
    border-radius: var(--radius-md, 10px);
    width: min(560px, 100%);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-head h2 {
    font-size: var(--font-size-md);
    margin: 0;
  }

  .close {
    display: inline-flex;
    color: var(--color-text-tertiary);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }

  .panel-body {
    padding: var(--space-3) var(--space-4);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .warn {
    font-size: var(--font-size-sm);
    color: var(--color-warning);
    background-color: var(--color-warning-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    margin: 0;
    line-height: 1.6;
  }

  .muted {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin: 0;
  }

  .card-item {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-item legend {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: 0 var(--space-1);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input {
    width: 100%;
  }

  .remove {
    align-self: flex-end;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .feedback {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .feedback.err {
    color: var(--color-danger, #dc2626);
  }
</style>
