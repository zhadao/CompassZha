<script lang="ts">
  /**
   * 番茄钟（总需求 §2.6 v4.7：双模式）：
   * - 倒计时：预设 10/25/40 + 自定义分钟 + 任务标题；到点自动记录，可提前「结束并记录」
   * - 正计时：停表那一刻即结束并记录
   * 计时在 store 层全局运行（切分区继续走）；记录写入当日 ## 专注记录 + 累加 focus_minutes（阶段三 3.1 已接真）。
   */
  import { app } from "../../stores/app.svelte";
  import { offsetDays, todayKey } from "../../lib/date";
  import Segmented from "../common/Segmented.svelte";
  import FocusRecordList from "./FocusRecordList.svelte";

  const PRESETS = [10, 25, 40];
  /** 模式选择（仅空闲时可切） */
  let modeSel = $state<"countdown" | "stopwatch">("countdown");
  let presetMin = $state(25);
  let customMin = $state("");
  let title = $state("");

  const t = $derived(app.timer);
  const running = $derived(t.phase !== "idle");

  /** 当前生效分钟数（自定义合法则覆盖预设） */
  const effMin = $derived.by(() => {
    const c = Number(customMin);
    return customMin !== "" && !Number.isNaN(c) && c >= 1 && c <= 600 ? Math.floor(c) : presetMin;
  });

  /** 大数字显示：倒计时剩余 / 正计时已计 */
  const display = $derived.by(() => {
    const sec =
      t.mode === "countdown" ? Math.max(0, t.targetMin * 60 - t.elapsedSec) : t.elapsedSec;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  });

  const statusText = $derived(
    t.phase === "running"
      ? t.mode === "countdown"
        ? `倒计时 · ${t.title || "临时专注"}`
        : `正计时中 · ${t.title || "临时专注"}`
      : t.phase === "paused"
        ? "已暂停"
        : "准备开始",
  );

  function start(): void {
    if (modeSel === "countdown") {
      app.startCountdown(effMin, title);
    } else {
      app.startStopwatch(title);
    }
  }

  /** 提示：停表记录不足 1 分钟不生效 */
  function stop(): void {
    app.stopAndRecord();
  }

  /* ---- A-3：原详情栏「历史统计」搬进本页（今日专注 / 本周专注 / 专注段数） ---- */

  /** 本周周一的日期键（周一为一周起点） */
  function weekStartKey(): string {
    const day = new Date().getDay();
    return offsetDays(todayKey(), -((day + 6) % 7));
  }

  /** 番茄钟统计：从专注记录实时汇总 */
  const todayMin = $derived.by(() =>
    app.focusSessions
      .filter((s) => s.date === todayKey())
      .reduce((sum, s) => sum + s.minutes, 0),
  );
  const weekMin = $derived.by(() => {
    const from = weekStartKey();
    return app.focusSessions
      .filter((s) => s.date >= from)
      .reduce((sum, s) => sum + s.minutes, 0);
  });
  const doneCount = $derived(app.focusSessions.length);
</script>

<div class="page">
  <section class="card block center">
    {#if running}
      <!-- 运行 / 暂停态：显示实时计时 -->
      <div class="mode-tag">{t.mode === "countdown" ? "倒计时" : "正计时"}</div>
      <div class="timer" class:running={t.phase === "running"} class:paused={t.phase === "paused"}>
        {display}
      </div>
      <p class="status">{statusText}</p>
      <div class="btns">
        {#if t.phase === "running"}
          <button class="btn-secondary" onclick={() => app.pauseTimer()}>暂停</button>
        {:else}
          <button class="btn-primary" onclick={() => app.resumeTimer()}>继续</button>
        {/if}
        <button class="btn-primary" onclick={stop}>
          {t.mode === "stopwatch" ? "停表（记录本次）" : "结束并记录"}
        </button>
        <button class="btn-secondary" onclick={() => app.resetTimer()}>放弃</button>
      </div>
    {:else if modeSel === "countdown"}
      <!-- 空闲 · 倒计时配置 -->
      <Segmented
        ariaLabel="计时模式"
        options={[{ value: "countdown", label: "倒计时" }, { value: "stopwatch", label: "正计时" }]}
        value={modeSel}
        onchange={(v) => (modeSel = v as "countdown" | "stopwatch")}
      />
      <div class="timer idle">{`${String(effMin).padStart(2, "0")}:00`}</div>
      <p class="status">给自己限定一段专注时间</p>
      <div class="config">
        <div class="preset-row">
          {#each PRESETS as p (p)}
            <button class="preset" class:active={presetMin === p && customMin === ""} onclick={() => { presetMin = p; customMin = ""; }}>
              {p} 分钟
            </button>
          {/each}
        </div>
        <input
          class="custom-min"
          type="number"
          min="1"
          max="600"
          placeholder="自定义分钟"
          bind:value={customMin}
        />
        <input class="title-input" type="text" maxlength="30" placeholder="这次专注干什么？（可留空）" bind:value={title} />
      </div>
      <div class="btns">
        <button class="btn-primary" onclick={start}>开始倒计时</button>
      </div>
    {:else}
      <!-- 空闲 · 正计时配置 -->
      <Segmented
        ariaLabel="计时模式"
        options={[{ value: "countdown", label: "倒计时" }, { value: "stopwatch", label: "正计时" }]}
        value={modeSel}
        onchange={(v) => (modeSel = v as "countdown" | "stopwatch")}
      />
      <div class="timer idle">00:00</div>
      <p class="status">不知道会专注多久？开始后自由专注，停表那一刻即记录</p>
      <div class="config">
        <input class="title-input" type="text" maxlength="30" placeholder="这次专注干什么？（可留空）" bind:value={title} />
      </div>
      <div class="btns">
        <button class="btn-primary" onclick={start}>开始专注</button>
      </div>
    {/if}
  </section>

  <section class="card stats">
    <h3 class="stats-title">历史统计</h3>
    <ul class="stat-list">
      <li><span>今日专注</span><span>{todayMin} 分钟</span></li>
      <li><span>本周专注</span><span>{weekMin} 分钟</span></li>
      <li><span>专注段数</span><span>{doneCount} 次</span></li>
    </ul>
    <p class="stats-tip">由专注记录实时汇总（当日日记「## 专注记录」+ 历史加载数据）</p>
  </section>

  <FocusRecordList />
</div>

<style>
  .page {
    position: relative;
  }

  .block {
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .block.center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .mode-tag {
    font-size: var(--font-size-xs);
    color: var(--color-primary-contrast);
    background-color: var(--color-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
  }

  .timer {
    font-size: 64px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
    transition: color var(--transition-fast);
  }

  .timer.running {
    color: var(--color-primary);
  }

  .timer.paused {
    color: var(--color-warning);
  }

  .timer.idle {
    color: var(--color-text-secondary);
  }

  .status {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .config {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    max-width: 360px;
  }

  .preset-row {
    display: flex;
    gap: var(--space-2);
  }

  .preset {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
  }

  .preset.active {
    border-color: var(--color-primary);
    color: var(--color-title);
    background-color: var(--color-primary-light);
    font-weight: 600;
  }

  .custom-min {
    width: 160px;
    text-align: center;
  }

  .title-input {
    width: 100%;
  }

  .btns {
    display: flex;
    gap: var(--space-2);
  }

  .stats {
    padding: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .stats-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .stat-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }

  .stat-list li {
    display: flex;
    justify-content: space-between;
    color: var(--color-text-secondary);
  }

  .stats-tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }
</style>
