<script lang="ts">
  // 阶段 1：自 SettingsPage 抽出的「数据」区块（保持组件单文件 ≤300 行）。
  // v4.22 §3.1 打开数据根目录；v4.25 §2.13 导出总数据（整个数据根 → 「下载」文件夹 zip）。
  import { onMount } from "svelte";
  import Icon from "../common/Icon.svelte";
  import { manual } from "../../stores/manual.svelte";
  import {
    gitSyncGetConfig,
    openDataRoot,
    persist,
    exportDataZip,
    exportStamp,
    revealPath,
  } from "../../lib/tauri-fs";

  let dataRoot = $state("");
  let dirMsg = $state("");
  let dirErr = $state(false);
  let exporting = $state(false);
  let exportPath = $state("");

  onMount(async () => {
    if (!persist) return; // 浏览器预览：无 Tauri 后端
    try {
      dataRoot = (await gitSyncGetConfig()).data_root;
    } catch (e) {
      dirMsg = `读取数据目录失败：${e}`;
      dirErr = true;
    }
  });

  /** v4.22 §3.1：在资源管理器中打开数据根目录。 */
  async function openDir() {
    dirMsg = "";
    dirErr = false;
    try {
      await openDataRoot();
    } catch (e) {
      dirMsg = `打开失败：${e}`;
      dirErr = true;
    }
  }

  /** v4.25 §2.13：一键导出整个数据根为 zip 到「下载」文件夹。 */
  async function exportZip() {
    exporting = true;
    exportPath = "";
    dirMsg = "";
    dirErr = false;
    try {
      exportPath = await exportDataZip(exportStamp());
      dirMsg = `已导出：${exportPath}`;
    } catch (e) {
      dirMsg = `导出失败：${e}`;
      dirErr = true;
    }
    exporting = false;
  }

  /** 导出反馈中的「打开所在文件夹」：资源管理器定位选中该 zip。 */
  async function revealZip() {
    try {
      await revealPath(exportPath);
    } catch {
      // 打开失败静默
    }
  }
</script>

<!-- 数据目录（v4.22 §3.1）：全部数据都是普通 Markdown 文件（CODE-008） -->
<section class="card block">
  <h2 class="block-title">数据</h2>
  <p class="block-hint">
    全部数据都是普通 Markdown 文件，可直接用任何编辑器打开与备份。
    <button class="link-btn" onclick={() => manual.openManual()}>目录说明见说明书</button>
  </p>

  <div class="field">
    <span class="label">数据目录</span>
    <input type="text" value={persist ? dataRoot || "读取中…" : "（桌面应用内显示）"} disabled />
  </div>

  <div class="actions">
    <button class="btn-secondary" onclick={openDir} disabled={!persist}>
      <Icon name="file" size={21} />
      打开数据目录
    </button>
    <!-- v4.25 §2.13：右下角「导出总数据」——整个 data 文件夹一键打包为 zip -->
    <button class="btn-secondary push-right" onclick={exportZip} disabled={!persist || exporting}>
      {exporting ? "正在打包…" : "导出总数据"}
    </button>
  </div>

  {#if dirMsg}
    <p class="feedback" class:err={dirErr}>
      {dirMsg}
      {#if exportPath}
        <button class="link-btn" onclick={revealZip}>打开所在文件夹</button>
      {/if}
    </p>
  {/if}
</section>

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 560px;
  }

  .block-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-title);
    margin: 0;
  }

  .block-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    line-height: 1.6;
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .field input {
    width: 100%;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .feedback {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .feedback.err {
    color: var(--color-danger);
  }

  /* v4.25：数据区操作行右端「导出总数据」（右下角入口） */
  .push-right {
    margin-left: auto;
  }

  /* v4.25：导出反馈行内「打开所在文件夹」文字按钮 */
  .link-btn {
    margin-left: var(--space-2);
    padding: 0;
    font-size: var(--font-size-sm);
    color: var(--color-primary);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
  }
</style>
