<script lang="ts">
  /**
   * 自绘 SVG 图标渲染（v4.17）：
   * - 静态 import ?raw 全部手绘图标，按名取图（保留手绘原色，不套色卡）；
   * - 剥离 Affinity 导出的 XML 声明头（<?xml?> / <!DOCTYPE>），仅内联 <svg> 本体；
   * - 生命板块等旧数据存 emoji 字符串时由调用方回退文本渲染，本组件只管 SVG。
   */
  import logoRaw from "../../assets/icons/logo/compassLOGO主logo.svg?raw";

  import sidebarTodayRaw from "../../assets/icons/misc/时钟钟表.svg?raw";
  import sidebarCalendarRaw from "../../assets/icons/sidebar/日历.svg?raw";
  import sidebarDashboardRaw from "../../assets/icons/sidebar/仪表.svg?raw";
  import sidebarLifeRaw from "../../assets/icons/sidebar/板块.svg?raw";
  import sidebarPomodoroRaw from "../../assets/icons/sidebar/番茄钟.svg?raw";
  import sidebarChatRaw from "../../assets/icons/sidebar/对话功能-隆中对.svg?raw";
  import sidebarSettingsRaw from "../../assets/icons/sidebar/设置.svg?raw";

  import mSleepRaw from "../../assets/icons/dashboard/睡眠时长.svg?raw";
  import mBedtimeRaw from "../../assets/icons/dashboard/入睡时间.svg?raw";
  import mWakeRaw from "../../assets/icons/dashboard/起床时间.svg?raw";
  import mWeightRaw from "../../assets/icons/dashboard/体重.svg?raw";
  import mExpenseRaw from "../../assets/icons/dashboard/当日支出.svg?raw";
  import mMoodRaw from "../../assets/icons/dashboard/心情.svg?raw";
  import mFocusRaw from "../../assets/icons/dashboard/专注时长.svg?raw";
  import mStepsRaw from "../../assets/icons/dashboard/运动步数.svg?raw";

  import lifeIdeaRaw from "../../assets/icons/life/点子.svg?raw";
  import lifeChatRaw from "../../assets/icons/life/对话.svg?raw";
  import lifeHouseRaw from "../../assets/icons/life/房子.svg?raw";
  import lifeToolsRaw from "../../assets/icons/life/工具.svg?raw";
  import lifeWorkRaw from "../../assets/icons/life/工作.svg?raw";
  import lifeFireRaw from "../../assets/icons/life/火焰.svg?raw";
  import lifeChickenRaw from "../../assets/icons/life/鸡腿.svg?raw";
  import lifeGeometryRaw from "../../assets/icons/life/几何.svg?raw";
  import lifeInteractRaw from "../../assets/icons/life/交互.svg?raw";
  import lifeFriendsRaw from "../../assets/icons/life/交友.svg?raw";
  import lifeMoneyRaw from "../../assets/icons/life/金钱.svg?raw";
  import lifeEnergyRaw from "../../assets/icons/life/能量.svg?raw";
  import lifeBrainRaw from "../../assets/icons/life/人脑.svg?raw";
  import lifeWritingRaw from "../../assets/icons/life/写作.svg?raw";
  import lifeStarRaw from "../../assets/icons/life/星星.svg?raw";
  import lifeMedicalRaw from "../../assets/icons/life/医疗.svg?raw";
  import lifeArtRaw from "../../assets/icons/life/艺术.svg?raw";
  import lifeSportRaw from "../../assets/icons/life/运动.svg?raw";

  import miscCloseRaw from "../../assets/icons/misc/叉号-关闭.svg?raw";
  import miscClockRaw from "../../assets/icons/misc/时钟钟表.svg?raw";
  import miscHelpRaw from "../../assets/icons/misc/说明、详情.svg?raw";
  import miscIndexRaw from "../../assets/icons/misc/索引卡.svg?raw";
  import miscFileRaw from "../../assets/icons/misc/文件图标.svg?raw";
  import miscAiRaw from "../../assets/icons/misc/AI标志.svg?raw";
  import miscGithubRaw from "../../assets/icons/misc/github.svg?raw";
  import miscTagRaw from "../../assets/icons/misc/TAG提及功能键.svg?raw";
  import miscCollapseRaw from "../../assets/icons/misc/箭头.svg?raw";
  import miscPenRaw from "../../assets/icons/misc/写作.svg?raw";

  /** 图标名 → 原始 SVG 文本 */
  const ICONS: Record<string, string> = {
    logo: logoRaw,
    today: sidebarTodayRaw,
    calendar: sidebarCalendarRaw,
    dashboard: sidebarDashboardRaw,
    life: sidebarLifeRaw,
    pomodoro: sidebarPomodoroRaw,
    chat: sidebarChatRaw,
    settings: sidebarSettingsRaw,
    "metric-sleep": mSleepRaw,
    "metric-bedtime": mBedtimeRaw,
    "metric-wake": mWakeRaw,
    "metric-weight": mWeightRaw,
    "metric-expense": mExpenseRaw,
    "metric-mood": mMoodRaw,
    "metric-focus": mFocusRaw,
    "metric-steps": mStepsRaw,
    点子: lifeIdeaRaw,
    对话: lifeChatRaw,
    房子: lifeHouseRaw,
    工具: lifeToolsRaw,
    工作: lifeWorkRaw,
    火焰: lifeFireRaw,
    鸡腿: lifeChickenRaw,
    几何: lifeGeometryRaw,
    交互: lifeInteractRaw,
    交友: lifeFriendsRaw,
    金钱: lifeMoneyRaw,
    能量: lifeEnergyRaw,
    人脑: lifeBrainRaw,
    写作: lifeWritingRaw,
    星星: lifeStarRaw,
    医疗: lifeMedicalRaw,
    艺术: lifeArtRaw,
    运动: lifeSportRaw,
    close: miscCloseRaw,
    clock: miscClockRaw,
    help: miscHelpRaw,
    "index-card": miscIndexRaw,
    file: miscFileRaw,
    ai: miscAiRaw,
    github: miscGithubRaw,
    tag: miscTagRaw,
    collapse: miscCollapseRaw,
    writing: miscPenRaw,
  };

  /** 剥离 XML 声明头，仅保留 <svg> 本体（Affinity 导出文件含 <?xml?> 与 <!DOCTYPE>） */
  function stripProlog(raw: string): string {
    const m = raw.match(/<svg[\s\S]*<\/svg>/i);
    return m ? m[0] : "";
  }

  let { name, size = 27 }: { name: string; size?: number } = $props();

  const svg = $derived(stripProlog(ICONS[name] ?? ""));
</script>

{#if svg}
  <span class="icon" style:width="{size}px" style:height="{size}px" role="img" aria-label={name}>{@html svg}</span>
{/if}

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 0;
  }

  .icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
