<script lang="ts">
  /**
   * 右侧详情栏：随分区切换显示对应内容（宽度 280px，可隐藏）。
   * A-3：详情栏仅今日 / 日历 / 仪表盘 / 人生板块显示；仪表盘与番茄钟的右栏内容已搬进各自页面，
   * 本组件只保留今日（编辑模式/日记日历/指标表单）、日历（事件编辑器/循环事件）、人生板块（板块说明）。
   * v4.17：编辑模式切换统一为 Segmented 分段选择器；板块图标走自绘 SVG（emoji 回退）。
   */
  import { app } from "../../stores/app.svelte";
  import Segmented from "../common/Segmented.svelte";
  import BoardIcon from "../common/BoardIcon.svelte";
  import MetricsForm from "../today/MetricsForm.svelte";
  import DiaryCalendar from "../today/DiaryCalendar.svelte";
  import EventEditor from "../calendar/EventEditor.svelte";
  import RecurringRulesDialog from "../calendar/RecurringRulesDialog.svelte";

  /** 选中板块（网格态点卡片联动，编辑态自动选中该板块） */
  const lifeBoard = $derived(
    app.lifeBoards.find((b) => b.id === app.selectedLifeBoardId) ?? null,
  );

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
