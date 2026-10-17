<script lang="ts">
  // v4.22 §2.11-A：自定义窗口标题栏。
  // 窗口已关闭原生装饰（tauri.conf.json decorations:false），本组件即全宽置顶一体化标题条：
  // - 高 36px、背景 --color-surface、下边框 --color-border，与 Sidebar 视觉一体；
  // - 左侧留白区整条为拖拽区（data-tauri-drag-region）；右侧三角色按钮不参与拖拽；
  // - 按钮图标为用户手绘 SVG 原样内联（决策 D3：保留手绘原色，不套色卡）；
  // - 最大化/还原复用同一图标，仅切 title / aria-label（决策 D2：不新造资产）。
  import { onMount } from "svelte";
  import {
    winMinimize,
    winToggleMaximize,
    winRequestClose,
    winIsMaximized,
  } from "../../lib/win";

  let maximized = $state(false);

  onMount(() => {
    const refresh = () => {
      void winIsMaximized().then((v) => (maximized = v));
    };
    refresh();
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  });
</script>

<header class="app-header">
  <!-- 拖拽填充区：整条留白区可拖动窗口 -->
  <div class="drag-fill" data-tauri-drag-region></div>

  <div class="win-buttons">
    <button
      class="win-btn"
      type="button"
      title="最小化"
      aria-label="最小化窗口"
      onclick={() => void winMinimize()}
    >
      <svg viewBox="0 0 512 512" aria-hidden="true">
        <g transform="matrix(1,0,0,1,-0,6.929323)">
          <g transform="matrix(1,0,0,1,0,-6.929323)">
            <g transform="matrix(1.440953,0,0,1.440953,-173.625135,-133.685807)">
              <path
                d="M386.983,92.776C436.01,92.776 475.814,132.579 475.814,181.606L475.814,359.266C475.814,408.293 436.01,448.096 386.983,448.096L209.323,448.096C160.297,448.096 120.493,408.293 120.493,359.266L120.493,181.606C120.493,132.579 160.297,92.776 209.323,92.776L386.983,92.776Z"
                fill="rgb(235,235,235)"
              />
            </g>
            <g transform="matrix(1.435947,0,0,1,-49.648082,13.858647)">
              <path
                d="M328.688,210.363C332.408,210.363 335.427,214.699 335.427,220.04L335.427,239.394C335.427,244.735 332.408,249.071 328.688,249.071L97.022,249.071C93.303,249.071 90.283,244.735 90.283,239.394L90.283,220.04C90.283,214.699 93.303,210.363 97.022,210.363L328.688,210.363Z"
                fill="rgb(48,48,48)"
              />
            </g>
          </g>
        </g>
      </svg>
    </button>

    <button
      class="win-btn"
      type="button"
      title={maximized ? "还原" : "最大化"}
      aria-label={maximized ? "还原窗口" : "最大化窗口"}
      onclick={() => void winToggleMaximize()}
    >
      <svg viewBox="0 0 512 512" aria-hidden="true">
        <g transform="matrix(1,0,0,1,-0,6.929323)">
          <g transform="matrix(1,0,0,1,0,-6.929323)">
            <g transform="matrix(1.440953,0,0,1.440953,-173.625135,-133.685807)">
              <path
                d="M386.983,92.776C436.01,92.776 475.814,132.579 475.814,181.606L475.814,359.266C475.814,408.293 436.01,448.096 386.983,448.096L209.323,448.096C160.297,448.096 120.493,408.293 120.493,359.266L120.493,181.606C120.493,132.579 160.297,92.776 209.323,92.776L386.983,92.776Z"
                fill="rgb(235,235,235)"
              />
            </g>
            <g transform="matrix(1.322747,0,0,0.98207,-51.512061,-2.269176)">
              <path
                d="M308.287,156.462C340.116,156.462 365.957,191.267 365.957,234.138L365.957,354.369C365.957,397.24 340.116,432.046 308.287,432.046L157.09,432.046C125.26,432.046 99.419,397.24 99.419,354.369L99.419,234.138C99.419,191.267 125.26,156.462 157.09,156.462L308.287,156.462ZM308.287,191.584L157.09,191.584C139.652,191.584 125.495,210.652 125.495,234.138L125.495,354.369C125.495,377.856 139.652,396.924 157.09,396.924L308.287,396.924C325.724,396.924 339.881,377.856 339.881,354.369L339.881,234.138C339.881,210.652 325.724,191.584 308.287,191.584Z"
                fill="rgb(48,48,48)"
              />
            </g>
            <g transform="matrix(1.54045,0,0,1,-93.240619,-16.894816)">
              <path
                d="M334.173,103.806C337.925,103.806 340.971,108.498 340.971,114.277L340.971,135.219C340.971,140.998 337.925,145.69 334.173,145.69L119.254,145.69C115.503,145.69 112.457,140.998 112.457,135.219L112.457,114.277C112.457,108.498 115.503,103.806 119.254,103.806L334.173,103.806Z"
                fill="rgb(48,48,48)"
              />
            </g>
          </g>
        </g>
      </svg>
    </button>

    <button
      class="win-btn"
      type="button"
      title="关闭"
      aria-label="关闭窗口"
      onclick={() => void winRequestClose()}
    >
      <svg viewBox="0 0 512 512" aria-hidden="true">
        <g transform="matrix(1,0,0,1,-0,6.929323)">
          <g transform="matrix(1,0,0,1,0,-6.929323)">
            <g transform="matrix(1.440953,0,0,1.440953,-173.625135,-133.685807)">
              <path
                d="M386.983,92.776C436.01,92.776 475.814,132.579 475.814,181.606L475.814,359.266C475.814,408.293 436.01,448.096 386.983,448.096L209.323,448.096C160.297,448.096 120.493,408.293 120.493,359.266L120.493,181.606C120.493,132.579 160.297,92.776 209.323,92.776L386.983,92.776Z"
                fill="rgb(235,235,235)"
              />
            </g>
            <g transform="matrix(1,0,0,1,-8.761445,1.832121)">
              <g transform="matrix(1.334171,-1.334171,0.707107,0.707107,-125.923454,468.433077)">
                <path
                  d="M335.421,103.806C338.484,103.806 340.971,108.498 340.971,114.277L340.971,135.219C340.971,140.998 338.484,145.69 335.421,145.69L118.007,145.69C114.944,145.69 112.457,140.998 112.457,135.219L112.457,114.277C112.457,108.498 114.944,103.806 118.007,103.806L335.421,103.806Z"
                  fill="rgb(48,48,48)"
                />
              </g>
              <g transform="matrix(1.334171,1.334171,-0.707107,0.707107,50.496247,-136.51702)">
                <path
                  d="M335.421,103.806C338.484,103.806 340.971,108.498 340.971,114.277L340.971,135.219C340.971,140.998 338.484,145.69 335.421,145.69L118.007,145.69C114.944,145.69 112.457,140.998 112.457,135.219L112.457,114.277C112.457,108.498 114.944,103.806 118.007,103.806L335.421,103.806Z"
                  fill="rgb(48,48,48)"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </button>
  </div>
</header>

<style>
  .app-header {
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
    padding: 0 var(--space-2) 0 0;
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    user-select: none;
  }

  .drag-fill {
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }

  .win-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .win-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    transition: transform var(--transition-fast), opacity var(--transition-fast);
  }

  .win-btn svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .win-btn:hover {
    transform: scale(1.08);
  }

  .win-btn:active {
    transform: scale(0.94);
    opacity: 0.8;
  }
</style>
