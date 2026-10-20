<script lang="ts">
  /**
   * 今日专注记录：倒序，实时刷新；空态引导（UI-005）。
   * D-3(a) / E-4：每条记录右侧「⋯」→「删除」（二次确认）→ 当日专注时长与仪表盘同步重算。
   */
  import { app } from "../../stores/app.svelte";
  import { todayKey } from "../../lib/date";
  import type { FocusSession } from "../../types/schema";

  /** 打开「⋯」菜单的记录 id；null = 关闭 */
  let menuId = $state<string | null>(null);
  /** 处于删除二次确认的记录 id；null = 尚未点删除 */
  let confirmId = $state<string | null>(null);

  function closeMenu(): void {
    menuId = null;
    confirmId = null;
  }

  function toggleMenu(id: string): void {
    if (menuId === id) {
      closeMenu();
      return;
    }
    menuId = id;
    confirmId = null;
  }

  function doRemove(id: string): void {
    app.removeFocusSession(id);
    closeMenu();
  }

  const todaySessions = $derived.by<FocusSession[]>(() =>
    app.focusSessions.filter((s) => s.date === todayKey()).slice().reverse(),
  );

  /**
   * D-3(b)：段号 = 当日专注记录按开始时刻升序的名次（并列时保持原顺序），展示层现算、不落盘。
   * 列表本身倒序展示，段号仍按时间先后编。
   */
  const segNo = $derived.by(() => {
    const asc = [...todaySessions]
      .reverse()
      .sort((a, b) => (a.startHHmm < b.startHHmm ? -1 : a.startHHmm > b.startHHmm ? 1 : 0));
    const m = new Map<string, number>();
    asc.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  });

  const totalMin = $derived(
    app.focusSessions
      .filter((s) => s.date === todayKey())
      .reduce((acc, s) => acc + s.minutes, 0),
  );
</script>

<svelte:window
  onclick={(e) => {
    if (menuId && !(e.target as HTMLElement).closest(".rec-menu-wrap")) closeMenu();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") closeMenu();
  }}
/>

<section class="card block">
  <h2 class="block-title">
    今日专注记录
    {#if totalMin > 0}
      <span class="total">共 {totalMin} 分钟</span>
    {/if}
  </h2>
  {#if todaySessions.length === 0}
    <div class="empty-state">
      <p>还没有今天的专注记录——点击开始，第一次专注会出现在这里。</p>
    </div>
  {:else}
    <ul class="records">
      {#each todaySessions as s (s.id)}
        <li class="record">
          <span class="seg">第 {segNo.get(s.id)} 段</span>
          <span class="time">{s.startHHmm}</span>
          <span class="task">{s.task || "专注"}</span>
          <span class="mode">{s.mode === "countdown" ? "倒计时" : "正计时"}</span>
          <span class="minutes">{s.minutes} 分钟</span>
          <span class="rec-menu-wrap">
            <button
              class="more-btn"
              type="button"
              title="更多操作"
              aria-label="更多操作"
              aria-expanded={menuId === s.id}
              onclick={() => toggleMenu(s.id)}
            >
              ⋯
            </button>
            {#if menuId === s.id}
              <div class="rec-menu">
                {#if confirmId === s.id}
                  <p class="rec-menu-text">确定删除这条记录？</p>
                  <div class="rec-menu-actions">
                    <button class="danger" type="button" onclick={() => doRemove(s.id)}>删除</button>
                    <button type="button" onclick={closeMenu}>取消</button>
                  </div>
                {:else}
                  <button class="rec-menu-item" type="button" onclick={() => (confirmId = s.id)}>
                    删除
                  </button>
                {/if}
              </div>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .block {
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .total {
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--color-primary);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-2);
  }

  .records {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .record {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  /* D-3(b)：第 N 段（当日按开始时刻升序的名次） */
  .record .seg {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    color: var(--color-title);
    background-color: var(--color-primary-light);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    white-space: nowrap;
  }

  .record .time {
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .record .task {
    flex: 1;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record .mode {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
  }

  .record .minutes {
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  /* D-3(a)：行内「⋯」菜单（锚定在行尾） */
  .rec-menu-wrap {
    position: relative;
    display: inline-flex;
  }

  .more-btn {
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-tertiary);
    line-height: 1.4;
    cursor: pointer;
  }

  .more-btn:hover {
    background-color: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .rec-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 100;
    min-width: 152px;
    padding: var(--space-1);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
  }

  .rec-menu-item {
    display: block;
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
  }

  .rec-menu-item:hover {
    background-color: var(--color-surface-alt);
  }

  .rec-menu-text {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .rec-menu-actions {
    display: flex;
    gap: var(--space-1);
    padding: 0 var(--space-1) var(--space-1);
  }

  .rec-menu-actions button {
    flex: 1;
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .rec-menu-actions button.danger {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }
</style>
