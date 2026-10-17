<script lang="ts">
  /**
   * 开屏加载动画（v4.17）：黑底白罗盘（双环旋转 + 刻度 + 罗盘针），
   * 约 3.5 秒、右上角「跳过」；无实义纯氛围。父级在 splash=false 或
   * prefers-reduced-motion 时不渲染本组件。
   * 交互形态参考 uiverse.io（Nawsome 加载器），配色与结构为本项目重实现。
   */
  import { onMount } from "svelte";

  let { onDone }: { onDone: () => void } = $props();

  const DURATION = 3500;
  const FADE = 320;
  let leaving = $state(false);
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    leaving = true;
    window.setTimeout(onDone, FADE);
  }

  onMount(() => {
    const timer = window.setTimeout(finish, DURATION);
    return () => window.clearTimeout(timer);
  });
</script>

<div class="splash" class:leaving role="presentation">
  <button class="skip" onclick={finish}>跳过</button>

  <div class="body">
    <svg class="pl" viewBox="0 0 160 160" width="150px" height="150px" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="pl-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff"></stop>
          <stop offset="100%" stop-color="#000"></stop>
        </linearGradient>
        <mask id="pl-mask-outer">
          <rect x="0" y="0" width="160" height="160" fill="url(#pl-fade)"></rect>
        </mask>
        <mask id="pl-mask-inner">
          <rect x="28" y="28" width="104" height="104" fill="url(#pl-fade)"></rect>
        </mask>
      </defs>

      <!-- 外环（双份：一份整体被下缘渐隐遮罩） -->
      <g>
        <g class="pl-ring-rotate">
          <circle
            class="pl-ring-stroke"
            cx="80" cy="80" r="72" fill="none"
            stroke="#ffffff" stroke-width="14"
            stroke-dasharray="452.39 452.39" stroke-dashoffset="452"
            stroke-linecap="round" transform="rotate(-45,80,80)"
          ></circle>
        </g>
      </g>
      <g mask="url(#pl-mask-outer)">
        <g class="pl-ring-rotate">
          <circle
            class="pl-ring-stroke"
            cx="80" cy="80" r="72" fill="none"
            stroke="#ffffff" stroke-opacity="0.55" stroke-width="14"
            stroke-dasharray="452.39 452.39" stroke-dashoffset="452"
            stroke-linecap="round" transform="rotate(-45,80,80)"
          ></circle>
        </g>
      </g>

      <!-- 刻度环 -->
      <g stroke-width="4" stroke-dasharray="12 12" stroke-dashoffset="12" stroke-linecap="round" transform="translate(80,80)">
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(-135,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(-90,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(-45,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(0,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(45,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(90,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(135,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" points="0,2 0,14" transform="rotate(180,0,0) translate(0,40)"></polyline>
      </g>
      <g mask="url(#pl-mask-inner)" stroke-width="4" stroke-dasharray="12 12" stroke-dashoffset="12" stroke-linecap="round" transform="translate(80,80)">
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(-135,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(-90,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(-45,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(0,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(45,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(90,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(135,0,0) translate(0,40)"></polyline>
        <polyline class="pl-tick" stroke="#ffffff" stroke-opacity="0.55" points="0,2 0,14" transform="rotate(180,0,0) translate(0,40)"></polyline>
      </g>

      <!-- 罗盘针 -->
      <g>
        <g transform="translate(64,28)">
          <g class="pl-arrows" transform="rotate(45,16,52)">
            <path fill="#ffffff" d="M17.998,1.506l13.892,43.594c.455,1.426-.56,2.899-1.998,2.899H2.108c-1.437,0-2.452-1.473-1.998-2.899L14.002,1.506c.64-2.008,3.356-2.008,3.996,0Z"></path>
            <path fill="#ffffff" fill-opacity="0.55" d="M14.009,102.499L.109,58.889c-.453-1.421,.559-2.889,1.991-2.889H29.899c1.433,0,2.444,1.468,1.991,2.889l-13.899,43.61c-.638,2.001-3.345,2.001-3.983,0Z"></path>
          </g>
        </g>
      </g>
    </svg>

    <div class="title">CompassZha</div>
    <div class="tagline">人生仪表盘</div>
  </div>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background-color: #000000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transition: opacity 320ms ease;
  }

  .splash.leaving {
    opacity: 0;
  }

  .skip {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    color: #ffffff;
    opacity: 0.7;
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .skip:hover {
    opacity: 1;
    border-color: #ffffff;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .title {
    color: #ffffff;
    font-size: var(--font-size-2xl);
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .tagline {
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-sm);
    letter-spacing: 0.3em;
  }

  /* ---- 动画（时长 2s，循环；总展示时长由 JS 控制） ---- */
  .pl-arrows,
  .pl-ring-rotate,
  .pl-ring-stroke,
  .pl-tick {
    animation-duration: 2s;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  .pl-arrows {
    animation-name: pl-arrows-spin;
    transform-origin: 16px 52px;
  }

  .pl-ring-rotate,
  .pl-ring-stroke {
    transform-origin: 80px 80px;
  }

  .pl-ring-rotate {
    animation-name: pl-ring-rotate;
  }

  .pl-ring-stroke {
    animation-name: pl-ring-stroke;
    transform: rotate(-45deg);
  }

  .pl-tick {
    animation-name: pl-tick;
  }

  .pl-tick:nth-child(2) { animation-delay: -1.75s; }
  .pl-tick:nth-child(3) { animation-delay: -1.5s; }
  .pl-tick:nth-child(4) { animation-delay: -1.25s; }
  .pl-tick:nth-child(5) { animation-delay: -1s; }
  .pl-tick:nth-child(6) { animation-delay: -0.75s; }
  .pl-tick:nth-child(7) { animation-delay: -0.5s; }
  .pl-tick:nth-child(8) { animation-delay: -0.25s; }

  @keyframes pl-arrows-spin {
    from { transform: rotate(45deg); }
    to { transform: rotate(405deg); }
  }

  @keyframes pl-ring-rotate {
    from { transform: rotate(0); }
    to { transform: rotate(720deg); }
  }

  @keyframes pl-ring-stroke {
    from,
    to {
      stroke-dashoffset: 452;
      transform: rotate(-45deg);
    }
    50% {
      stroke-dashoffset: 169.5;
      transform: rotate(-180deg);
    }
  }

  @keyframes pl-tick {
    from,
    3%,
    47%,
    to {
      stroke-dashoffset: -12;
    }
    14%,
    36% {
      stroke-dashoffset: 0;
    }
  }
</style>
