<script lang="ts">
  // 对话说明弹层（v4.12 · 检查点 4.4）：三节——基础操作 / 后续功能 / 注意事项。
  // 文案对标「问问立正」使用说明，按本项目引用语义简化（喂入语料一律视为可信引用源）。
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onclose();
  }}
/>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="语料对话说明" tabindex="-1">
    <header class="panel-head">
      <h2>语料对话说明</h2>
      <button class="close" onclick={onclose} aria-label="关闭说明">✕</button>
    </header>

    <div class="panel-body">
      <section>
        <h3>一、基础操作</h3>
        <ul>
          <li>
            <b>怎么喂语料：</b>点上方「📂 资源跳转」会直接打开语料文件夹（数据目录下的
            <code>corpus\</code>）。把 Markdown 文件<b>直接丢在根目录即可</b>——
            <b>不用分类、不用建文件夹；一个文件放一处就行</b>，交叉主题的语料（既和职业又和健康相关）也只放一份，
            主题筛选是 AI 检索时做的，与文件放在哪无关。放进去下次提问即生效，无需其他操作。
            当前库里已有「立正」开源语料（在 <code>corpus\lizheng\</code>）。
          </li>
          <li>
            <b>怎么填 API：</b>去设置页「AI 配置」，填入你自己的 DeepSeek API Key
            （申请：DeepSeek 官网 → 注册 → API Keys → 创建）。Key 只存在你电脑的系统凭据管理器里，
            软件不写任何文件、不内置任何密钥。
          </li>
          <li>
            <b>隐私：</b>对话与语料全程只在你本机与 AI 服务之间进行；你的日记、每日记录
            <b>不会</b>被作为对话语料。
          </li>
        </ul>
      </section>

      <section>
        <h3>二、后续功能</h3>
        <ul>
          <li>
            <b>怎么对话：</b>像和普通 AI 聊天一样提问即可。区别是：AI
            会先检索你的语料库，再<b>以语料为依据</b>回答，并在回答下方列出「引用出处」——
            每条出处是语料库里的一个文件，可点「资源跳转」去原文核对。
          </li>
          <li>
            <b>索引卡：</b>点上方「🗂 索引卡」可以编辑几张主题卡。它们<b>不是文件夹</b>，
            是 AI 检索语料时的<b>筛选标签</b>——AI 会根据你的问题选中相关的卡，
            并用卡上的「关键词」补充检索你的语料库。所以<b>编辑卡的关键词 = 调整 AI 查语料的路由</b>；
            <b>索引卡是 AI 的路由依据，不建议频繁更改</b>——除非你明确了新的主题方向。
          </li>
        </ul>
      </section>

      <section>
        <h3>三、注意事项</h3>
        <ul>
          <li>
            AI 的回答 = <b>语料引用为基础 + AI 自身智能</b>。你主动喂入的语料一律视为可信引用源，
            不区分「谁说的」；但 AI 的整理和推断仍可能出错，重要的判断请按出处回看原文核对。
          </li>
          <li>
            语料里没有相关材料时，AI 会基于自身智能回答，并<b>明确提示「本次回答未得到语料库的充分支撑」</b>——
            这时你知道它代表 AI 自身观点，而不是语料里的内容。
          </li>
          <li>每次提问消耗你自己的 API 额度（约两次轻量调用），费用以你的 AI 账单为准。</li>
          <li>
            <b>立正语料的更新：</b><code>corpus\lizheng\</code> 是立正开源语料的正文；
            完整仓库（含更新历史）在数据目录的 <code>语料源\lizheng-open-context\</code>。
            想更新到最新版：在该仓库里 <code>git pull</code>，然后把它的 <code>corpus</code>
            子目录内容复制覆盖到 <code>corpus\lizheng\</code> 即可。
          </li>
        </ul>
      </section>

      <footer class="panel-foot">
        <button class="btn-primary" onclick={onclose}>知道了</button>
      </footer>
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
    width: min(640px, 100%);
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

  section h3 {
    font-size: var(--font-size-sm);
    margin: 0 0 var(--space-2);
    color: var(--color-primary);
  }

  ul {
    margin: 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  li {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  code {
    background-color: var(--color-surface-alt);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
  }

  .panel-foot {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-2);
  }
</style>
