<script lang="ts">
  // 软件作者弹窗（v4.16）：设置页底部「软件作者」按钮点开。
  // 首行作者公开库链接 → 基于的开源项目 → 项目与 MIT 简介 → 「捐献作者」展开收款码。
  // 链接点击经后端 open_url_https 打开系统默认浏览器（仅 https://）。
  import qrcode from "../../assets/donate-qrcode.jpg";
  import { persist, openUrlHttps } from "../../lib/tauri-fs";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let showDonate = $state(false);

  const repoUrl = "https://github.com/zhadao/CompassZha";
  const basedOn: { name: string; url: string; note: string }[] = [
    { name: "Tauri", url: "https://github.com/tauri-apps/tauri", note: "桌面应用框架（MIT/Apache-2.0）" },
    { name: "Svelte", url: "https://github.com/sveltejs/svelte", note: "前端框架（MIT）" },
    { name: "FullCalendar", url: "https://github.com/fullcalendar/fullcalendar", note: "日历视图（MIT）" },
    { name: "Milkdown", url: "https://github.com/Milkdown/milkdown", note: "所见即所得编辑器（MIT）" },
    { name: "ECharts", url: "https://github.com/apache/echarts", note: "趋势图表（Apache-2.0）" },
    { name: "usememos/memos", url: "https://github.com/usememos/memos", note: "界面风格参考（仅视觉借鉴，未使用其代码）" },
  ];

  /** 桌面内走后端命令（默认浏览器）；浏览器预览模式退化为新标签页。 */
  async function openLink(url: string) {
    if (persist) {
      try {
        await openUrlHttps(url);
        return;
      } catch {
        // 后端打开失败时回落到新标签页，不让弹窗卡住
      }
    }
    window.open(url, "_blank", "noopener");
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="软件作者" tabindex="-1">
    <header class="panel-head">
      <h2>软件作者</h2>
      <button class="close" onclick={onclose} aria-label="关闭软件作者">✕</button>
    </header>

    <div class="panel-body">
      <p class="lead">
        CompassZha 由
        <button class="link" onclick={() => void openLink(repoUrl)}>zhadao</button>
        开发并开源——仓库地址：
        <button class="link" onclick={() => void openLink(repoUrl)}>{repoUrl}</button>
      </p>

      <section>
        <h3>基于的开源项目</h3>
        <ul class="based-list">
          {#each basedOn as item}
            <li>
              <button class="link" onclick={() => void openLink(item.url)}>{item.name}</button>
              <span class="note">{item.note}</span>
            </li>
          {/each}
        </ul>
      </section>

      <section>
        <h3>关于本项目</h3>
        <p class="about">
          CompassZha 是一个 Windows 本地「人生仪表盘」：回答「今天该干什么 / 状态怎么样 /
          人在往哪走」。所有数据以 Markdown 文件存放在你自己的目录里，可以同步到你自己的
          GitHub 私密仓库；软件不内置任何账号、密钥或默认仓库。
        </p>
        <p class="license">
          本项目基于 <b>MIT 协议</b>开源——你可以自由使用、修改和分发，详见仓库中的
          LICENSE 文件。
        </p>
      </section>

      <div class="donate-row">
        <button class="btn-secondary donate-btn" onclick={() => (showDonate = !showDonate)}>
          {showDonate ? "收起二维码" : "捐献作者"}
        </button>
        {#if showDonate}
          <figure class="donate-fig">
            <img src={qrcode} alt="捐献作者收款二维码（支付宝）" />
            <figcaption>支付宝扫一扫 · 金额随意，感谢支持</figcaption>
          </figure>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background-color: rgb(0 0 0 / 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-4);
  }

  .panel {
    background-color: var(--color-surface);
    border-radius: var(--radius-md, 10px);
    width: min(480px, 100%);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-head h2 {
    font-size: var(--font-size-md);
    margin: 0;
  }

  .close {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-md);
  }

  .panel-body {
    padding: var(--space-3) var(--space-4);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .lead {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.7;
  }

  h3 {
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary, inherit);
  }

  .based-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .based-list li {
    font-size: var(--font-size-sm);
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .link {
    color: var(--color-primary, #2563eb);
    font-size: inherit;
    padding: 0;
    word-break: break-all;
  }

  .link:hover {
    text-decoration: underline;
  }

  .note {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .about,
  .license {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.7;
  }

  .donate-row {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .donate-btn {
    align-self: flex-start;
  }

  .donate-fig {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .donate-fig img {
    width: min(280px, 80%);
    height: auto;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .donate-fig figcaption {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
</style>
