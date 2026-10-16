<script lang="ts">
  /**
   * 编辑器模式主区（v4.4）：当日 daily 正文（frontmatter 之外）的所见即所得编辑。
   * - 挂载：flushNow 清空 GUI 待写 → 磁盘现读正文 → Crepe 挂载；
   * - 编辑：800ms debounce 保存（replaceBody 正文替换、frontmatter 字节级保留）
   *   + parseDaily 刷内存 + git 提交；
   * - 卸载：未落盘缓冲强制保存一次（切回 GUI / 切分区 / 换日期都会先卸载本组件）。
   * 正文与 frontmatter 分治：指标仍由右栏 GUI 表单管理，避免双写竞争。
   */
  import { onMount, onDestroy } from "svelte";
  import { app } from "../../stores/app.svelte";
  import { formatDateCN } from "../../lib/date";
  import {
    buildDailyFile,
    dailyBody,
    parseDaily,
    replaceBody,
  } from "../../lib/markdown";
  import { persist, fsRead, fsWrite, gitAutoCommit, dailyRel } from "../../lib/tauri-fs";
  import CrepeEditor from "../common/CrepeEditor.svelte";

  /** 本次编辑会话绑定的日期（换日期会先卸载本组件，不存在会话内漂移） */
  const date = app.selectedDate;

  let loading = $state(true);
  /** 磁盘已知正文（装载值 / 最近一次保存值；用于跳过无变化保存 + 编辑器初始值） */
  let lastSaved = $state("");
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function nowHHmm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function onUpdate(md: string): void {
    if (loading) return;
    if (md === lastSaved) {
      pending = null; // 改回已保存内容：无需落盘
      return;
    }
    pending = md;
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        void save();
      }, 800);
    }
  }

  async function save(): Promise<void> {
    if (!persist || pending === null) return;
    const next = pending;
    pending = null;
    try {
      const rel = dailyRel(date);
      const base = (await fsRead(rel).catch(() => null)) ?? buildDailyFile(date);
      const merged = replaceBody(base, next);
      await fsWrite(rel, merged);
      lastSaved = dailyBody(merged);
      app.refreshDailyFromParse(date, parseDaily(merged, date));
      await gitAutoCommit(`编辑器：${date} · ${nowHHmm()}`);
    } catch (err) {
      console.error("[DailyEditor] 保存失败", err);
      pending = next; // 失败回滚，下次变更重试
    }
  }

  onMount(async () => {
    if (!persist) {
      lastSaved = "";
      loading = false;
      return;
    }
    await app.flushNow();
    const rel = dailyRel(date);
    const text = (await fsRead(rel).catch(() => null)) ?? buildDailyFile(date);
    lastSaved = dailyBody(text);
    app.dailyRaw = lastSaved;
    loading = false;
  });

  onDestroy(() => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    void save(); // 强制落盘未保存缓冲
  });
</script>

<section class="editor-page">
  <header class="editor-bar">
    <button class="btn-secondary" onclick={() => app.toggleEditorMode()}>← 返回 GUI</button>
    <div class="date-info">
      <span class="date-text">{formatDateCN(date)}</span>
      <span class="file-path">daily/{date.slice(0, 4)}/{date}.md</span>
    </div>
  </header>
  {#if loading}
    <div class="placeholder">正在读取当日文件…</div>
  {:else if persist}
    <div class="editor-shell">
      <CrepeEditor value={lastSaved} onUpdate={onUpdate} />
    </div>
    <p class="footnote">
      指标（frontmatter）由右侧表单管理；此处编辑五个章节正文，保存自动写盘并同步 GUI。
    </p>
  {:else}
    <div class="placeholder">浏览器预览模式不支持编辑器（需要 Tauri 运行时）</div>
  {/if}
</section>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 860px;
  }

  .editor-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .date-info {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .date-text {
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .file-path {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    background-color: var(--color-surface-alt);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .editor-shell {
    width: 100%;
  }

  .placeholder {
    padding: var(--space-6) var(--space-3);
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
  }

  .footnote {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
