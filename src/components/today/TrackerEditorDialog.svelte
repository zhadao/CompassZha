<script lang="ts">
  /**
   * E-1：自定义追踪项编辑弹窗（新建 / 编辑共用）。
   * 键名规则：`x_<英文slug>`；留空时自动取 `x_t1`、`x_t2`…（跳过已占用）。
   * 值一律落当日 frontmatter 的 `x_` 键；隐藏 / 删除都不动历史文件里的数据。
   */
  import { untrack } from "svelte";
  import { newTrackerKey, validateSlug } from "../../lib/trackers";
  import type { TrackerDef } from "../../types/schema";

  interface Props {
    /** 编辑既有项时传入；新建时 undefined */
    def?: TrackerDef | null;
    /** 已被占用的键（新建时排除自动键候选） */
    takenKeys: string[];
    onSave: (def: TrackerDef) => void;
    onCancel: () => void;
  }

  let { def = null, takenKeys, onSave, onCancel }: Props = $props();

  /** 弹窗每次按 {#if} 重建，初值取挂载时刻的 def 即可（untrack 避免 Svelte 告警） */
  const isEdit = untrack(() => def !== null);

  let name = $state(untrack(() => def?.name ?? ""));
  let slug = $state(untrack(() => (def && !def.builtin ? def.key.replace(/^x_/, "") : "")));
  let unit = $state(untrack(() => def?.unit ?? ""));
  let kind = $state<TrackerDef["kind"]>(untrack(() => def?.kind ?? "number"));
  let direction = $state<TrackerDef["direction"]>(untrack(() => def?.direction ?? "up"));
  let max = $state(String(untrack(() => def?.max ?? 5)));
  let error = $state("");

  const KINDS: Array<{ value: TrackerDef["kind"]; label: string }> = [
    { value: "number", label: "数值" },
    { value: "level", label: "档位" },
    { value: "bool", label: "是 / 否" },
    { value: "time", label: "时刻" },
  ];

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      error = "请填写指标名称";
      return;
    }
    const s = slug.trim() || newTrackerKey(takenKeys).replace(/^x_/, "");
    if (!validateSlug(s)) {
      error = "英文键名需以小写字母开头，仅含小写字母 / 数字 / 下划线，总长 ≤ 24";
      return;
    }
    const key = `x_${s}`;
    if (!isEdit && takenKeys.includes(key)) {
      error = "该英文键名已被占用";
      return;
    }
    const m = Number(max);
    onSave({
      key,
      name: trimmed,
      unit: unit.trim(),
      kind,
      direction,
      max: kind === "level" ? (Number.isFinite(m) ? Math.min(Math.max(Math.round(m), 2), 10) : 5) : undefined,
      builtin: false,
      hidden: def?.hidden ?? false,
    });
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onCancel();
  }}
/>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="自定义数据追踪">
    <form class="dialog-body" onsubmit={submit}>
    <h2 class="dialog-title">{isEdit ? "编辑追踪项" : "新建追踪项"}</h2>
    <p class="dialog-hint">
      自定义指标与内置项走同一套机制：保存后今日表单、仪表盘卡片与趋势曲线会自动出现，全程无需改代码。
    </p>

    <label class="field">
      <span class="label">指标名称</span>
      <input bind:value={name} placeholder="例如：睡眠质量2 / 每日饮水" />
    </label>

    <label class="field">
      <span class="label">英文键名（可留空，自动分配）</span>
      <input bind:value={slug} placeholder="sleep2（留空则自动取 x_t1）" disabled={isEdit} />
      <span class="hint">写入日记文件的 frontmatter 键为 <code>x_{slug || "t1"}</code></span>
    </label>

    <label class="field">
      <span class="label">单位（可留空）</span>
      <input bind:value={unit} placeholder="小时 / 次 / 元…" />
    </label>

    <div class="row">
      <label class="field">
        <span class="label">类型</span>
        <select bind:value={kind}>
          {#each KINDS as k (k.value)}
            <option value={k.value}>{k.label}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span class="label">目标方向</span>
        <select bind:value={direction}>
          <option value="up">越高越好</option>
          <option value="down">越低越好</option>
        </select>
      </label>
    </div>

    {#if kind === "level"}
      <label class="field">
        <span class="label">档位上限（2–10）</span>
        <input type="number" min="2" max="10" step="1" bind:value={max} />
      </label>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="dialog-actions">
      <button class="btn-primary" type="submit">保存</button>
      <button class="btn-secondary" type="button" onclick={onCancel}>取消</button>
    </div>
    </form>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay);
    padding: var(--space-4);
  }

  .dialog {
    width: min(440px, 100%);
    padding: var(--space-4);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-4);
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dialog-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
  }

  .dialog-hint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    gap: var(--space-3);
  }

  .row .field {
    flex: 1;
    min-width: 0;
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  code {
    color: var(--color-primary);
  }

  .error {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-danger);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
