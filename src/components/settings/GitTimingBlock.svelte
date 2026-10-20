<script lang="ts">
  // 同步时机（v4.40 C-2 从 GitSyncSection 拆出，CODE-003）：三时机开关 + 定时档位。
  interface Props {
    /** 打开软件时同步一次（默认开） */
    onStart: boolean;
    /** 每次保存后同步（默认关） */
    enabled: boolean;
    /** 定时同步档位（分钟，0 = 关闭） */
    intervalMin: number;
    /** 认证方式是否为 auto（仅影响提示文案） */
    isAuto: boolean;
  }
  let { onStart = $bindable(), enabled = $bindable(), intervalMin = $bindable(), isAuto }: Props = $props();

  /** 定时同步档位（分钟；0 = 关闭），与 Rust 侧白名单一致 */
  const INTERVALS: number[] = [0, 5, 15, 30, 60];
</script>

<div class="sub-block">
  <h3 class="sub-title">同步时机</h3>
  <p class="sub-note">
    默认仅「打开软件时」同步一次；下面两项按需开启。三者都需先填仓库地址{#if !isAuto}并保存令牌{/if}。
  </p>
  <label class="switch-row">
    <input type="checkbox" bind:checked={onStart} />
    <span>打开软件时同步（本次对比本地变更并提交推送一次）</span>
  </label>
  <label class="switch-row">
    <input type="checkbox" bind:checked={enabled} />
    <span>每次保存后同步（每次本地提交后立即推送）</span>
  </label>
  <label class="field">
    <span class="label">定时同步</span>
    <select value={intervalMin} onchange={(e) => (intervalMin = Number(e.currentTarget.value))}>
      {#each INTERVALS as m (m)}
        <option value={m}>{m === 0 ? "关闭" : `每 ${m} 分钟`}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .sub-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: 8px;
  }
  .sub-title {
    margin: 0;
    font-size: var(--font-size-sm);
  }
  .sub-note {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }
  .switch-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
