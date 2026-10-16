<script lang="ts">
  /**
   * 右侧详情栏：随分区切换显示对应内容（宽度 280px，可隐藏）。
   * v4.1：指标口径 8 项 + 趋势范围（7/30/90 天）真切换 + 板块摘要联动 + 番茄钟统计实时派生。
   */
  import { app } from "../../stores/app.svelte";
  import MetricsForm from "../today/MetricsForm.svelte";
  import DiaryCalendar from "../today/DiaryCalendar.svelte";
  import EventEditor from "../calendar/EventEditor.svelte";
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

<aside class="detail">
  {#if app.section === "today"}
    <section class="panel-block">
      <h3 class="panel-title">编辑模式</h3>
      <button class="btn-primary mode-btn" onclick={() => app.toggleEditorMode()}>
        {app.editorMode ? "返回 GUI 模式" : "切换到编辑器模式"}
      </button>
      <p class="tip">
        {app.editorMode
          ? "编辑器模式：当日章节正文所见即所得；指标仍在下方表单。"
          : "GUI 模式：表单化编辑；点按钮切到 Markdown 编辑器模式。"}
      </p>
    </section>
    <DiaryCalendar />
    <MetricsForm />
  {:else if app.section === "calendar"}
    <EventEditor />
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
      <div class="range-row">
        <label>
          <input
            type="radio"
            name="range"
            checked={app.trendRange === 7}
            onchange={() => (app.trendRange = 7)}
          />
          近 7 天
        </label>
        <label>
          <input
            type="radio"
            name="range"
            checked={app.trendRange === 30}
            onchange={() => (app.trendRange = 30)}
          />
          近 30 天
        </label>
        <label>
          <input
            type="radio"
            name="range"
            checked={app.trendRange === 90}
            onchange={() => (app.trendRange = 90)}
          />
          近 90 天
        </label>
      </div>
      <p class="tip">切换后趋势图实时重绘</p>
    </section>
  {:else if app.section === "life"}
    <section class="panel-block">
      <h3 class="panel-title">{lifeBoard ? lifeBoard.name : "板块说明"}</h3>
      {#if lifeBoard}
        <div class="life-icon">{lifeBoard.icon}</div>
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
      <h3 class="panel-title">任务绑定</h3>
      <select disabled>
        <option>选择今日任务（阶段二接通）</option>
      </select>
    </section>
    <section class="panel-block">
      <h3 class="panel-title">历史统计</h3>
      <ul class="stat-list">
        <li><span>今日专注</span><span>{todayMin} 分钟</span></li>
        <li><span>本周专注</span><span>{weekMin} 分钟</span></li>
        <li><span>专注段数</span><span>{doneCount} 次</span></li>
      </ul>
      <p class="tip">由专注记录实时汇总（当日日记「## 专注记录」+ 历史加载数据）</p>
    </section>
  {:else}
    <section class="panel-block">
      <h3 class="panel-title">设置</h3>
      <p class="tip">
        设置项在阶段三接通：Git 同步配置、DeepSeek API key（存系统密钥链）、数据路径。
      </p>
    </section>
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

  .range-row {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .life-icon {
    font-size: var(--font-size-xl);
    margin-bottom: var(--space-2);
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

  .mode-btn {
    width: 100%;
  }
</style>
