<script lang="ts">
  /**
   * 循环事件管理弹窗（v4.21 §2.10）：右栏「循环事件」按钮唤起。
   * 逐条列出规则的人类可读描述；编辑 = 复用事件编辑器「重复」区；删除二选一
   * （仅删规则、保留已生成事件 / 规则与已生成事件一并删除）。
   */
  import { app } from "../../stores/app.svelte";
  import { describeRule } from "../../lib/recurrence";
  import { todayKey } from "../../lib/date";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  /** 待删除的规则 id（弹二次选择） */
  let delTarget = $state<string | null>(null);

  const rules = $derived(app.recurRules);
  const delRule = $derived(rules.find((r) => r.id === delTarget) ?? null);

  function edit(id: string): void {
    app.openEditRuleDraft(id);
    onclose();
  }

  function createNew(): void {
    app.openCreateDraft(todayKey(), false, "09:00", true);
    onclose();
  }

  function remove(deleteInstances: boolean): void {
    if (delTarget) void app.removeRecurRule(delTarget, deleteInstances);
    delTarget = null;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") {
      if (delTarget) delTarget = null;
      else onclose();
    }
  }}
/>

<div
  class="overlay"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onclose();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="循环事件管理">
    <div class="head">
      <h3 class="title">循环事件</h3>
      <button class="btn-secondary" onclick={createNew}>新建循环事件</button>
    </div>
    <p class="tip">
      循环仅记录规则：今天 ~ 3 个月内自动生成事件并写入对应日记「## 日程」，更远日期不创建文件；随时间推移窗口自动向前补齐。
    </p>

    {#if rules.length === 0}
      <div class="empty-state">
        <span>暂无循环事件规则</span>
        <span>点「新建循环事件」，或在日历日期格右键「添加循环事件」</span>
      </div>
    {:else}
      <ul class="rule-list">
        {#each rules as r (r.id)}
          <li class="rule-item">
            <div class="rule-main">
              <div class="rule-title">{r.title}</div>
              <div class="rule-desc">{describeRule(r)}</div>
            </div>
            <div class="rule-ops">
              <button class="btn-secondary" onclick={() => edit(r.id)}>编辑</button>
              <button class="btn-danger" onclick={() => (delTarget = r.id)}>删除</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="foot">
      <button class="btn-secondary" onclick={onclose}>关闭</button>
    </div>
  </div>
</div>

{#if delTarget}
  <div class="overlay confirm-overlay" role="presentation">
    <div class="dialog confirm" role="alertdialog" aria-modal="true" aria-label="确认删除循环规则">
      <p class="dialog-text">删除「{delRule?.title ?? ""}」的循环规则：</p>
      <p class="dialog-sub">选择如何处理已生成的循环事件。</p>
      <div class="confirm-actions">
        <button class="btn-secondary" onclick={() => remove(false)}>
          仅删除规则（保留已生成事件）
        </button>
        <button class="btn-danger" onclick={() => remove(true)}>
          删除规则及已生成事件
        </button>
        <button class="btn-ghost" onclick={() => (delTarget = null)}>取消</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .confirm-overlay {
    z-index: 220;
  }

  .dialog {
    width: min(520px, 100%);
    max-height: min(80vh, 640px);
    overflow-y: auto;
    padding: var(--space-4);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .confirm {
    width: min(360px, 100%);
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .title {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .tip {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }

  .rule-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .rule-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .rule-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .rule-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: 2px;
  }

  .rule-ops {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .btn-danger {
    color: var(--color-danger);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-xs);
    transition: all var(--transition-fast);
  }

  .btn-danger:hover {
    border-color: var(--color-danger);
  }

  .btn-secondary {
    font-size: var(--font-size-xs);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
  }

  .dialog-text {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .dialog-sub {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .confirm-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .confirm-actions .btn-secondary,
  .confirm-actions .btn-danger {
    width: 100%;
    padding: var(--space-2);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  .btn-ghost {
    width: 100%;
    padding: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .btn-ghost:hover {
    background-color: var(--color-surface-alt);
  }
</style>
