<script lang="ts">
  // 阶段 1：自 CalendarPage 抽出的「右键菜单 + 删除确认」区域（保持组件单文件 ≤300 行）。
  // v4.20 §2.9：事件上 → 编辑/删除事件；日期格 → 添加事件/添加循环事件；均含打开该日日记。
  import { app } from "../../stores/app.svelte";
  import ContextMenu, { type MenuItem } from "../common/ContextMenu.svelte";
  import ConfirmDialog from "../common/ConfirmDialog.svelte";

  let {
    ctxMenu,
    onclose,
  }: {
    ctxMenu: { x: number; y: number; eventId: string | null; date: string | null } | null;
    onclose: () => void;
  } = $props();

  /** v4.21：待确认删除的事件 id（防误删，先弹「确认删除？」） */
  let confirmDel = $state<string | null>(null);
  /** v4.21：待确认删除的循环规则 id（删除整条循环，含已生成实例） */
  let confirmRule = $state<string | null>(null);
</script>

{#if ctxMenu}
  {@const m = ctxMenu}
  {@const ev = m.eventId ? app.events.find((e) => e.id === m.eventId) : null}
  {@const day = m.date ?? ev?.date ?? null}
  {@const ruleId = ev?.ruleId ?? null}
  {@const calItems: MenuItem[] = [
    ...(ev
      ? [{ label: ruleId ? "编辑循环规则" : "编辑事件", action: () => app.openEditDraft(ev.id) }]
      : []),
    ...(ev && !ruleId
      ? [{ label: "删除事件", danger: true, action: () => (confirmDel = ev.id) }]
      : []),
    ...(ev && ruleId
      ? [
          { label: "删除本次", action: () => app.removeOccurrence(ruleId, ev.date) },
          { label: "删除整条循环", danger: true, action: () => (confirmRule = ruleId) },
        ]
      : []),
    ...(!ev && day
      ? [
          { label: "添加事件", action: () => app.openCreateDraft(day, false) },
          { label: "添加循环事件", action: () => app.openCreateDraft(day, false, "09:00", true) },
        ]
      : []),
    ...(day ? [{ label: "打开该日日记", action: () => app.openDaily(day) }] : []),
  ]}
  <ContextMenu
    x={m.x}
    y={m.y}
    title={ev ? ev.title : (day ?? "")}
    items={calItems}
    onclose={onclose}
  />
{/if}

{#if confirmDel}
  <ConfirmDialog
    text="确认删除该事件？"
    confirmLabel="删除"
    onConfirm={() => {
      app.removeEvent(confirmDel!);
      confirmDel = null;
    }}
    onCancel={() => (confirmDel = null)}
  />
{/if}

{#if confirmRule}
  <ConfirmDialog
    text="确认删除整条循环？已生成的事件将一并清除。"
    confirmLabel="删除整条循环"
    onConfirm={() => {
      app.removeRecurRule(confirmRule!, true);
      confirmRule = null;
    }}
    onCancel={() => (confirmRule = null)}
  />
{/if}
