<script lang="ts">
  /**
   * 侧边栏文件树：年 → 月 → 日期，从 store 派生（当前为内存 30 天数据）。
   * 点击日期 → 选中该日并切到今日分区（阶段一换成真实 daily/ 目录扫描，此组件不动）。
   */
  import { app } from "../../stores/app.svelte";
  import { dailyRel, fsReveal } from "../../lib/tauri-fs";
  import { formatDateShort, todayKey } from "../../lib/date";
  import Icon from "../common/Icon.svelte";
  import ContextMenu, { type MenuItem } from "../common/ContextMenu.svelte";
  import ConfirmDialog from "../common/ConfirmDialog.svelte";

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

  // v4.20 §2.9：文件右键菜单——定位文件位置 / 编辑文件 / 删除文件（「确认删除？」二次确认防误删）
  let ctxMenu = $state<{ x: number; y: number; day: string } | null>(null);
  let confirmDel = $state<string | null>(null);

  function onLeafMenu(e: MouseEvent, day: string): void {
    e.preventDefault();
    ctxMenu = { x: e.clientX, y: e.clientY, day };
  }
</script>

<div class="file-tree">
  <div class="tree-title">daily/ 文件</div>
  {#each [...tree.entries()] as [year, months] (year)}
    <div class="tree-year">{year}</div>
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
            oncontextmenu={(e) => onLeafMenu(e, day)}
          >
            <span class="leaf-ico"><Icon name="file" size={18} /></span>
            {app.starredDates.has(day) ? "star-" : ""}{day}.md
            <span class="leaf-date">{formatDateShort(day)}</span>
          </button>
        {/each}
      {/if}
    {/each}
  {/each}
</div>

{#if ctxMenu}
  {@const fileItems: MenuItem[] = [
    {
      label: "定位文件位置",
      action: () => {
        void fsReveal(dailyRel(ctxMenu!.day)).catch(() => {});
      },
    },
    { label: "编辑文件", action: () => app.openDaily(ctxMenu!.day) },
    {
      label: "删除文件",
      danger: true,
      action: () => {
        confirmDel = ctxMenu!.day;
      },
    },
  ]}
  <ContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    title={ctxMenu.day}
    items={fileItems}
    onclose={() => (ctxMenu = null)}
  />
{/if}
{#if confirmDel}
  <ConfirmDialog
    text="确认删除？"
    confirmLabel="删除"
    onConfirm={() => {
      void app.deleteDaily(confirmDel!);
      confirmDel = null;
    }}
    onCancel={() => (confirmDel = null)}
  />
{/if}

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
    font-weight: 600;
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

  .leaf-ico {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
  }

  .tree-leaf.active .leaf-ico {
    color: var(--color-primary);
  }

  .leaf-date {
    margin-left: auto;
    color: var(--color-text-tertiary);
  }
</style>
