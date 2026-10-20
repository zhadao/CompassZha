<script lang="ts">
  /**
   * 单个追踪项录入字段（从 MetricsForm 拆出，CODE-003）：
   * 按 kind 渲染——level → 档位选择器、bool → 勾选、time → 时间、number → 数字输入。
   * 值为字符串态（"" = 未填），由父组件双向绑定。
   */
  import MoodPicker from "./MoodPicker.svelte";
  import type { TrackerDef } from "../../types/schema";

  interface Props {
    tracker: TrackerDef;
    /** 字符串态值（"" = 未填；与 frontmatter 字段同型） */
    value?: string;
  }
  let { tracker, value = $bindable("") }: Props = $props();

  const label = $derived(tracker.unit ? `${tracker.name}（${tracker.unit}）` : tracker.name);
</script>

<div class="field-wrap">
  {#if tracker.kind === "level"}
    <MoodPicker bind:value label={label} max={tracker.max ?? 5} />
  {:else if tracker.kind === "bool"}
    <label class="field bool">
      <span class="label">{label}</span>
      <input
        type="checkbox"
        checked={value === "1"}
        onchange={(e) => (value = e.currentTarget.checked ? "1" : "0")}
      />
    </label>
  {:else if tracker.kind === "time"}
    <label class="field">
      <span class="label">{label}</span>
      <input type="time" bind:value />
    </label>
  {:else}
    <label class="field">
      <span class="label">{label}</span>
      <input type="number" step={tracker.step} min="0" bind:value />
    </label>
  {/if}
</div>

<style>
  .field-wrap {
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field.bool {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input {
    width: 100%;
  }
</style>
