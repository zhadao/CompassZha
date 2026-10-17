<script lang="ts">
  /**
   * 右侧详情栏：随分区切换显示对应内容（宽度 280px，可隐藏）。
   * v4.1：指标口径 8 项 + 趋势范围（7/30/90 天）真切换 + 板块摘要联动 + 番茄钟统计实时派生。
   * v4.17：趋势范围/编辑模式切换统一为 Segmented 分段选择器；板块图标走自绘 SVG（emoji 回退）。
   */
  import { app } from "../../stores/app.svelte";
  import Segmented from "../common/Segmented.svelte";
  import BoardIcon from "../common/BoardIcon.svelte";
  import MetricsForm from "../today/MetricsForm.svelte";
  import DiaryCalendar from "../today/DiaryCalendar.svelte";
  import EventEditor from "../calendar/EventEditor.svelte";
  import RecurringRulesDialog from "../calendar/RecurringRulesDialog.svelte";
  import { offsetDays, todayKey } from "../../lib/date";

  /** 选中板块（网格态点卡片联动，编辑态自动选中该板块） */
  const lifeBoard = $derived(
    app.lifeBoards.find((b) => b.id === app.selectedLifeBoardId) ?? null,
  );

  /** 指标口径说明（v3.1：8 项，frontmatter 平铺键） */
  const DASHBOARD_CALIBERS: Array<[string, string]> = [
    ["睡眠时长", "frontmatter sleep_hours，单位小时"],
    ["入睡时间", "frontmatter sleep_bedtime，HH:mm"],
    ["起床时间", "frontmatter sleep_wake，HH:mm"],
    ["体重", "frontmatter weight_kg，单位 kg，晨起空腹"],
    ["当日支出", "frontmatter spend_total，单位元，含全部消费"],
    ["心情", "frontmatter mood，1-5 整数"],
    ["专注时长", "focus_minutes，番茄钟记录自动累加"],
    ["运动步数", "frontmatter steps，单位步"],
  ];

  const TREND_OPTIONS = [
    { value: "7", label: "近 7 天" },
    { value: "30", label: "近 30 天" },
    { value: "90", label: "近 90 天" },
  ];

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

  /** v4.21：循环事件管理弹窗开关 */
  let showRules = $state(false);
</script>

<aside class="detail">
  {#if app.section === "today"}
    <section class="panel-block">
      <h3 class="panel-title">编辑模式</h3>
      <Segmented
        ariaLabel="编辑模式"
        options={[
          { value: "gui", label: "GUI 表单" },
          { value: "editor", label: "编辑器" },
        ]}
        value={app.editorMode ? "editor" : "gui"}
        onchange={(v) => {
          if ((v === "editor") !== app.editorMode) app.toggleEditorMode();
        }}
      />
      <p class="tip">
        {app.editorMode
          ? "编辑器模式：当日章节正文所见即所得；指标仍在下方表单。"
          : "GUI 模式：表单化编辑；可切到 Markdown 编辑器模式。"}
      </p>
    </section>
    <DiaryCalendar />
    <MetricsForm />
  {:else if app.section === "calendar"}
    <EventEditor />
    <section class="panel-block">
      <h3 class="panel-title">循环事件</h3>
      <button class="btn-secondary rules-btn" onclick={() => (showRules = true)}>
        循环事件
      </button>
      <p class="tip">
        管理全部循环事件规则：逐条查看、编辑或删除（删除时可二选一保留 / 清除已生成事件）。
      </p>
    </section>
  {:else if app.section === "dashboard"}
    <section class="panel-block">
      <h3 class="panel-title">指标口径说明</h3>
      <ul class="caliber-list">
        {#each DASHBOARD_CALIBERS as [name, desc] (name)}
          <li>
            <div class="c-name">{name}</div>
            <div class="c-desc">{desc}</div>
          </li>
        {/each}
      </ul>
    </section>
    <section class="panel-block">
      <h3 class="panel-title">时间范围</h3>
      <Segmented
        ariaLabel="趋势时间范围"
        options={TREND_OPTIONS}
        value={String(app.trendRange)}
        onchange={(v) => (app.trendRange = Number(v) as 7 | 30 | 90)}
      />
      <p class="tip">切换后趋势图实时重绘</p>
    </section>
  {:else if app.section === "life"}
    <section class="panel-block">
      <h3 class="panel-title">{lifeBoard ? lifeBoard.name : "板块说明"}</h3>
      {#if lifeBoard}
        <div class="life-icon"><BoardIcon icon={lifeBoard.icon} size={42} /></div>
        <p class="life-scope">
          {lifeBoard.files.length} 个文档 · 默认 {lifeBoard.name}.md
        </p>
        <p class="life-file">对应文件夹：life/{lifeBoard.name}/</p>
        <p class="tip">
          每个板块是 life/ 下一个子文件夹；点开卡片进入文件夹视图——左侧文档列表可新建/重命名/删除多个
          Markdown 文件，右侧编辑实时落盘并本地 git 提交。
        </p>
      {:else}
        <div class="empty-state">
          <span>未选中板块</span>
          <span>在人生板块分区新建或点击卡片查看</span>
        </div>
      {/if}
    </section>
  {:else if app.section === "pomodoro"}
    <section class="panel-block">
      <h3 class="panel-title">历史统计</h3>
      <ul class="stat-list">
        <li><span>今日专注</span><span>{todayMin} 分钟</span></li>
        <li><span>本周专注</span><span>{weekMin} 分钟</span></li>
        <li><span>专注段数</span><span>{doneCount} 次</span></li>
      </ul>
      <p class="tip">由专注记录实时汇总（当日日记「## 专注记录」+ 历史加载数据）</p>
    </section>
  {/if}

  {#if showRules}
    <RecurringRulesDialog onclose={() => (showRules = false)} />
  {/if}
</aside>

<style>
  .detail {
    width: var(--detail-width);
    flex-shrink: 0;
    background-color: var(--color-surface);
    border-left: 1px solid var(--color-border);
    overflow-y: auto;
  }

  .panel-block {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: var(--font-size-md);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .caliber-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .c-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .c-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: var(--space-1);
  }

  .life-icon {
    display: inline-flex;
    margin-bottom: var(--space-2);
    line-height: 0;
  }

  .life-scope {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .life-file {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
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

  .tip {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }

  .rules-btn {
    width: 100%;
    padding: var(--space-2);
    font-size: var(--font-size-sm);
  }
</style>
