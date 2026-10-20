<script lang="ts">
  /**
   * D-6（v4.41）：封存盒 = life/_archived/ 下已封存板块的列表（可折叠）。
   * 每条可「重启」——把文件夹搬回 life/ 并清除 archived 标记；同名冲突时给出行内提示。
   */
  import { app } from "../../stores/app.svelte";

  let open = $state(false);
  let err = $state<string | null>(null);
  let busy = $state(false);

  async function restore(name: string): Promise<void> {
    err = null;
    busy = true;
    const msg = await app.restoreBoard(name);
    busy = false;
    if (msg) err = msg;
    else if (app.archivedBoards.length === 0) open = false; // 清空则自动收起
  }
</script>

<section class="archive-box card">
  <button class="box-head" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="chev" class:open>▸</span>
    <span class="box-title">封存盒</span>
    <span class="box-count">{app.archivedBoards.length} 个已封存板块</span>
  </button>

  {#if open}
    <div class="box-body">
      <p class="box-desc">
        这里存放已封存的板块（文件位于 <code>life/_archived/</code>）。封存不删数据，可随时重启。
      </p>
      {#if err}
        <p class="box-err">{err}</p>
      {/if}
      <ul class="list">
        {#each app.archivedBoards as a (a.name)}
          <li class="row">
            <span class="row-name">{a.name}</span>
            <span class="row-date">{a.archivedAt ? `封存于 ${a.archivedAt}` : "未标记封存日期"}</span>
            <button class="btn-secondary" disabled={busy} onclick={() => restore(a.name)}>
              重启
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .archive-box {
    margin-top: var(--space-3);
    padding: 0;
    overflow: hidden;
  }

  .box-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .box-head:hover {
    background-color: var(--color-surface-alt);
  }

  .chev {
    color: var(--color-text-tertiary);
    transition: transform var(--transition-fast);
    flex-shrink: 0;
  }

  .chev.open {
    transform: rotate(90deg);
  }

  .box-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    flex-shrink: 0;
  }

  .box-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .box-body {
    padding: var(--space-2) var(--space-3) var(--space-3);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .box-desc {
    margin: 0;
    font-size: var(--font-size-xs);
    line-height: 1.7;
    color: var(--color-text-secondary);
  }

  .box-desc code {
    font-size: 11px;
  }

  .box-err {
    margin: 0;
    font-size: var(--font-size-xs);
    line-height: 1.7;
    color: var(--color-danger);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .row-name {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
