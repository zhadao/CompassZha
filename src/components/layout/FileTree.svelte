<script lang="ts">
  /**
   * 侧边栏文件树：年 → 月 → 日期，从 store 派生（当前为内存 30 天数据）。
   * 点击日期 → 选中该日并切到今日分区（阶段一换成真实 daily/ 目录扫描，此组件不动）。
   */
  import { app } from "../../stores/app.svelte";
  import { formatDateShort, todayKey } from "../../lib/date";

  // 文件树：年 → 月 → 日期（store 中已有日期按年月分组，随增删实时联动）
  const tree = $derived.by(() => {
    const grouped = new Map<string, Map<string, string[]>>();
    for (const day of Object.keys(app.dailyNotes).sort()) {
      const [y, m] = day.split("-");
      if (!grouped.has(y)) grouped.set(y, new Map());
      const months = grouped.get(y)!;
      if (!months.has(m)) months.set(m, []);
      months.get(m)!.push(day);
    }
    return grouped;
  });

  let openMonths = $state(
    new Set<string>([`${todayKey().split("-")[0]}-${todayKey().split("-")[1]}`]),
  );

  function toggleMonth(key: string): void {
    const next = new Set(openMonths);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    openMonths = next;
  }

  function pickDay(day: string): void {
    app.selectedDate = day;
    app.section = "today";
  }
</script>

<div class="file-tree">
  <div class="tree-title">daily/ 文件</div>
  {#each [...tree.entries()] as [year, months] (year)}
    <div class="tree-year">📁 {year}</div>
    {#each [...months.entries()] as [month, days] (month)}
      <button class="tree-month" onclick={() => toggleMonth(`${year}-${month}`)}>
        {openMonths.has(`${year}-${month}`) ? "▾" : "▸"} {Number(month)}月
      </button>
      {#if openMonths.has(`${year}-${month}`)}
        {#each days as day (day)}
          <button
            class="tree-leaf"
            class:active={app.selectedDate === day}
            onclick={() => pickDay(day)}
          >
            📄 {app.starredDates.has(day) ? "star-" : ""}{day}.md
            <span class="leaf-date">{formatDateShort(day)}</span>
          </button>
        {/each}
      {/if}
    {/each}
  {/each}
</div>

<style>
  .file-tree {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    overflow-y: auto;
  }

  .tree-title {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    padding: var(--space-1) var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tree-year {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    padding: var(--space-1) var(--space-2);
  }

  .tree-month {
    display: block;
    width: 100%;
    text-align: left;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .tree-month:hover {
    background-color: var(--color-surface-alt);
  }

  .tree-leaf {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    text-align: left;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
  }

  .tree-leaf:hover {
    background-color: var(--color-surface-alt);
  }

  .tree-leaf.active {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  .leaf-date {
    margin-left: auto;
    color: var(--color-text-tertiary);
  }
</style>
