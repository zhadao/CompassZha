<script lang="ts">
  import StaticBadge from "../layout/StaticBadge.svelte";

  const purpose =
    "配置：Git 仓库同步、DeepSeek API key（存系统密钥链）、数据目录路径——随后续阶段逐项启用。";

  // 表单骨架暂禁用（当前阶段不落盘任何配置）
  const FIELDS: Array<{ label: string; placeholder: string }> = [
    { label: "Git 仓库地址", placeholder: "https://github.com/你的用户名/你的仓库.git" },
    { label: "同步分支", placeholder: "main" },
    { label: "DeepSeek API Key", placeholder: "存入系统密钥链，不写入任何文件" },
    { label: "数据目录", placeholder: "daily/ life/ corpus/ 的根目录" },
  ];
</script>

<div class="page">
  <StaticBadge />
  <p class="purpose">{purpose}</p>

  <section class="card block">
    <div class="banner">⚙️ 原型阶段不可用 —— 配置项将在阶段三（Git 同步 / 设置）接通</div>
    {#each FIELDS as f (f.label)}
      <label class="field">
        <span class="label">{f.label}</span>
        <input type="text" placeholder={f.placeholder} disabled />
      </label>
    {/each}
    <button class="btn-primary" disabled>保存配置</button>
  </section>
</div>

<style>
  .page {
    position: relative;
  }

  .purpose {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 520px;
  }

  .banner {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
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
</style>
