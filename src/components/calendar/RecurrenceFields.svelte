<script lang="ts">
  /**
   * 事件编辑器「重复」区（v4.21 §2.10；从 EventEditor 拆出，CODE-003 组件 ≤300 行）。
   * 直接编辑 app.calendarDraft.repeat：开启 = 循环规则草稿，关闭 = 单次事件。
   */
  import { app } from "../../stores/app.svelte";
  import { fromDateKey } from "../../lib/date";
  import type { RecurDraft, RecurFreq } from "../../types/schema";

  const draft = $derived(app.calendarDraft);
  const repeat = $derived(draft?.repeat ?? null);

  /** 上次关闭前的重复设置（开关来回切换时保留用户选择） */
  let lastRepeat = $state<RecurDraft | null>(null);

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const FREQ_OPTIONS: Array<{ value: RecurFreq; label: string }> = [
    { value: "daily", label: "每天" },
    { value: "weekly", label: "每周" },
    { value: "monthly", label: "每月" },
    { value: "yearly", label: "每年" },
  ];
  const UNIT: Record<RecurFreq, string> = {
    daily: "天",
    weekly: "周",
    monthly: "个月",
    yearly: "年",
  };

  /** 开/关「重复」：开启复用上次设置（否则按开始日期所在周几初始化）；关闭时记住当前设置 */
  function setRepeat(on: boolean): void {
    const d = draft;
    if (!d) return;
    if (on) {
      const src =
        lastRepeat ?? {
          freq: "weekly" as RecurFreq,
          interval: 1,
          weekdays: [fromDateKey(d.date).getDay()],
          endDate: null,
        };
      const cur = d.id ? app.events.find((e) => e.id === d.id) : undefined;
      d.repeat = { ...src, ruleId: cur?.ruleId, weekdays: [...src.weekdays] };
    } else {
      if (d.repeat) lastRepeat = { ...d.repeat, ruleId: undefined };
      d.repeat = null;
    }
  }

  function toggleWeekday(i: number): void {
    const r = repeat;
    if (!r) return;
    r.weekdays = r.weekdays.includes(i)
      ? r.weekdays.filter((x) => x !== i)
      : [...r.weekdays, i].sort((a, b) => a - b);
  }
</script>

{#if draft}
  <fieldset class="repeat">
    <legend class="legend">重复</legend>
    <label class="field checkbox-row">
      <input
        type="checkbox"
        checked={!!repeat}
        onchange={(e) => setRepeat(e.currentTarget.checked)}
      />
      <span>循环事件</span>
    </label>
    {#if repeat}
      <div class="field">
        <span class="label">频率</span>
        <select
          value={repeat.freq}
          onchange={(e) => (repeat.freq = e.currentTarget.value as RecurFreq)}
        >
          {#each FREQ_OPTIONS as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
        </select>
      </div>
      <label class="field">
        <span class="label">间隔（每隔 N {UNIT[repeat.freq]}）</span>
        <input
          type="number"
          min="1"
          value={repeat.interval}
          onchange={(e) => (repeat.interval = Math.max(1, Number(e.currentTarget.value) || 1))}
        />
      </label>
      {#if repeat.freq === "weekly"}
        <div class="field">
          <span class="label">周几</span>
          <div class="weekdays">
            {#each WEEKDAYS as lb, i (i)}
              <button
                type="button"
                class:on={repeat.weekdays.includes(i)}
                onclick={() => toggleWeekday(i)}
              >
                {lb}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      <div class="field">
        <span class="label">结束</span>
        <div class="end-row">
          <label class="radio">
            <input
              type="radio"
              name="rend"
              checked={repeat.endDate === null}
              onchange={() => (repeat.endDate = null)}
            />
            <span>永久循环</span>
          </label>
          <label class="radio">
            <input
              type="radio"
              name="rend"
              checked={repeat.endDate !== null}
              onchange={() => (repeat.endDate = draft.date)}
            />
            <span>至</span>
          </label>
          {#if repeat.endDate !== null}
            <input
              class="end-date"
              type="date"
              value={repeat.endDate}
              onchange={(e) => (repeat.endDate = e.currentTarget.value)}
            />
          {/if}
        </div>
      </div>
      <p class="tip">
        循环仅记录规则：今天 ~ 3 个月内自动生成事件，更远日期不创建文件；随时间推移窗口自动向前补齐。
      </p>
    {/if}
  </fieldset>
{/if}

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input[type="number"],
  .field select {
    width: 100%;
  }

  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .repeat {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .legend {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: 0 var(--space-1);
  }

  .tip {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }

  .weekdays {
    display: flex;
    gap: var(--space-1);
  }

  .weekdays button {
    flex: 1;
    font-size: var(--font-size-xs);
    padding: var(--space-1) 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .weekdays button.on {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .end-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    flex-wrap: wrap;
  }

  .radio {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .end-date {
    flex: 1;
    min-width: 130px;
  }
</style>
