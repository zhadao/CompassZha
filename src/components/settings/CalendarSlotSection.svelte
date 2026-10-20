<script lang="ts">
  // 阶段 1 · A-4 / A-5 / A-6：日历设置（自 SettingsPage 抽出，保持组件单文件 ≤300 行）。
  // 写入 config.calendar（slot_min / slot_max / px_per_hour / ticks）：
  // 时段范围 + 缩放档位（只读透传，缩放 UI 在日历页）+ 刻度规则（每 N 小时 / 指定时刻）。
  import { onMount } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { persist } from "../../lib/tauri-fs";
  import {
    TICK_HOURS,
    parseTickTimes,
    unrepresentableTimes,
    type CalendarTicks,
  } from "../../lib/calendarZoom";

  let slotMin = $state("06:00");
  let slotMax = $state("24:00");
  /** 刻度方式①：每 N 小时一横线 */
  let everyOn = $state(true);
  let everyHours = $state(1);
  /** 刻度方式②：指定时刻 */
  let timesOn = $state(false);
  let timesText = $state("");
  let slotMsg = $state("");
  let slotErr = $state(false);

  onMount(() => {
    slotMin = app.calendarSlotMin;
    slotMax = app.calendarSlotMax;
    everyOn = app.calendarTicks.everyHours > 0;
    everyHours = app.calendarTicks.everyHours > 0 ? app.calendarTicks.everyHours : 1;
    timesOn = app.calendarTicks.times.length > 0;
    timesText = app.calendarTicks.times.join(", ");
  });

  /** 无法落在 15 分钟时间格上的指定时刻（非阻断，仅提示） */
  const skipped = $derived(
    timesOn ? unrepresentableTimes(slotMin, parseTickTimes(timesText)) : [],
  );

  /** 保存日历设置（校验 HH:mm，结束须晚于开始）。 */
  async function saveSlots() {
    slotMsg = "";
    slotErr = false;
    const ticks: CalendarTicks = {
      everyHours: everyOn ? everyHours : 0,
      times: timesOn ? parseTickTimes(timesText) : [],
    };
    try {
      await app.setCalendarSlots(slotMin, slotMax, app.calendarPxPerHour, ticks);
      slotMsg = "已保存";
    } catch (e) {
      slotMsg = `保存失败：${e}`;
      slotErr = true;
    }
  }
</script>

<!-- 日历（阶段 1 · A-4 / A-5 / A-6）：时段范围 + 时间轴刻度 -->
<section class="card block">
  <h2 class="block-title">日历</h2>
  <p class="block-hint">
    日历时间轴默认只显示常用时段，其余时段不占高度。时间格固定为 15 分钟一格；
    日历页用 <b>Ctrl + 滚轮</b> 或顶部「时间缩放 −/+」缩放<b>视图</b>（改的是「1 小时占多少高度」，
    放大便于读细节、缩小可把一整天压进一屏），事件随视图一起按真实时间比例缩放。
  </p>

  <div class="slot-row">
    <label class="field">
      <span class="label">起始时间</span>
      <input
        type="text"
        value={slotMin}
        placeholder="06:00"
        aria-label="日历起始时间"
        disabled={!persist}
        oninput={(e) => (slotMin = e.currentTarget.value)}
      />
    </label>
    <label class="field">
      <span class="label">结束时间</span>
      <input
        type="text"
        value={slotMax}
        placeholder="24:00"
        aria-label="日历结束时间"
        disabled={!persist}
        oninput={(e) => (slotMax = e.currentTarget.value)}
      />
    </label>
  </div>
  <p class="block-hint">格式 HH:mm（如 06:00 / 24:00），结束时间须晚于开始时间。</p>

  <h3 class="sub-title">时间轴刻度</h3>
  <p class="block-hint">
    横向格线默认全部隐去（一天 = 一根贯通竖列），只在下列两类「刻度行」画线。
    两种规则各自独立，可同时启用，也可全部取消（全取消 = 无横线、无刻度文字）。
  </p>

  <div class="tick-row">
    <input
      id="tick-every"
      type="checkbox"
      bind:checked={everyOn}
      disabled={!persist}
    />
    <label for="tick-every" class="check-label">每</label>
    <select
      class="hours"
      value={everyHours}
      disabled={!persist || !everyOn}
      aria-label="每几小时一条横线"
      onchange={(e) => (everyHours = Number(e.currentTarget.value))}
    >
      {#each TICK_HOURS as h}
        <option value={h}>{h}</option>
      {/each}
    </select>
    <label for="tick-every" class="check-label">小时一横线</label>
  </div>

  <div class="tick-row">
    <input
      id="tick-times"
      type="checkbox"
      bind:checked={timesOn}
      disabled={!persist}
    />
    <label for="tick-times" class="check-label">指定时刻刻度</label>
    <input
      type="text"
      class="times"
      value={timesText}
      placeholder="08:00, 12:00, 18:00"
      aria-label="指定时刻刻度（HH:mm，逗号或空格分隔）"
      disabled={!persist || !timesOn}
      oninput={(e) => (timesText = e.currentTarget.value)}
    />
  </div>
  <p class="block-hint">逗号 / 空格分隔，格式 HH:mm；清空输入框即取消这类刻度。</p>

  {#if skipped.length > 0}
    <p class="feedback err">
      时间格固定 15 分钟，以下时刻无法落在刻度格上（须为 :00 / :15 / :30 / :45），日历中已跳过：{skipped.join(
        "、",
      )}
    </p>
  {/if}

  <div class="actions">
    <button class="btn-secondary" onclick={() => void saveSlots()} disabled={!persist}>
      保存日历设置
    </button>
  </div>

  {#if slotMsg}
    <p class="feedback" class:err={slotErr}>{slotMsg}</p>
  {/if}
</section>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    max-width: 560px;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .sub-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-title);
    margin: var(--space-2) 0 0;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
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

  .field input {
    width: 100%;
  }

  .slot-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .slot-row .field {
    flex: 0 1 140px;
  }

  .tick-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .check-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .tick-row input[type="checkbox"] {
    margin: 0;
  }

  .hours {
    width: 64px;
  }

  .times {
    flex: 1;
    min-width: 0;
  }

  .actions {
    margin-top: var(--space-1);
  }

  .feedback {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .feedback.err {
    color: var(--color-danger);
  }
</style>
