<script lang="ts">
  /**
   * 板块图标渲染（v4.17）：icon 字段「svg:键名」→ 自绘 SVG；
   * 旧数据 emoji 字符串原样回退（兼容不迁移）。
   */
  import Icon from "./Icon.svelte";

  let { icon, size = 27 }: { icon: string; size?: number } = $props();
</script>

{#if icon.startsWith("svg:")}
  <Icon name={icon.slice(4)} {size} />
{:else}
  <span class="emoji" style:font-size="{size}px">{icon}</span>
{/if}

<style>
  .emoji {
    line-height: 1;
  }
</style>
