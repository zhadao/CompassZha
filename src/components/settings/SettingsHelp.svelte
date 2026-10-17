<script lang="ts">
  // 设置说明弹层（v4.11）：集中说明如何配置「自己的」GitHub 私密库与 AI API。
  // 软件本身不内置任何凭据或仓库地址，一切由用户按本说明自助配置。
  import Icon from "../common/Icon.svelte";

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
  <div class="panel" role="dialog" aria-modal="true" aria-label="设置说明" tabindex="-1">
    <header class="panel-head">
      <h2>设置说明</h2>
      <button class="close" onclick={onclose} aria-label="关闭说明">
        <Icon name="close" size={24} />
      </button>
    </header>

    <div class="panel-body">
      <p class="lead">
        CompassZha 是一个本地软件，它<b>不内置任何账号、密钥或仓库地址</b>。想让数据同步到自己的
        GitHub 或 Gitee、让 AI 读你的笔记，需要你自己准备两样东西：一个<b>私密仓库</b>（配访问令牌）
        和一个<b>AI API Key</b>。下面按顺序照做即可。
      </p>

      <section>
        <h3>① 创建你的 GitHub 私密仓库</h3>
        <ol>
          <li>登录 GitHub，点右上角 <b>+</b> → <b>New repository</b>。</li>
          <li>
            填写仓库名（例如 <code>my-compass-data</code>），可见性选 <b>Private</b>
            （私密，别人看不到）。
          </li>
          <li>不要勾选 Add a README / .gitignore / license，保持空仓库。</li>
          <li>
            点 <b>Create repository</b>，在跳转页复制仓库地址，形如
            <code>https://github.com/你的用户名/仓库名.git</code>。
          </li>
        </ol>
        <p class="tip">
          建议专门建一个只放数据的私密仓库，与放代码的公开仓库分开——数据是你的隐私，代码要开源。
        </p>
      </section>

      <section>
        <h3>①′ 改用 Gitee？创建 Gitee 私密仓库</h3>
        <ol>
          <li>登录 Gitee，右上角 <b>+</b> → <b>新建仓库</b>。</li>
          <li>填写仓库名，权限选 <b>私有</b>；不要勾选「初始化仓库」（保持空仓库）。</li>
          <li>
            创建后复制仓库地址，形如 <code>https://gitee.com/你的用户名/仓库名.git</code>。
          </li>
        </ol>
        <p class="tip">
          设置页的「同步平台」选 <b>Gitee</b> 时，仓库地址的<b>第一段必须是你的 Gitee 用户名</b>
          （Gitee 的 HTTPS 认证需要用户名 + 私人令牌）。建在<b>组织</b>下的仓库暂不支持。
        </p>
      </section>

      <section>
        <h3>② 创建访问令牌（PAT / 私人令牌）</h3>
        <ol>
          <li>GitHub 右上角头像 → <b>Settings</b>。</li>
          <li>左侧栏拉到最底部 → <b>Developer settings</b>。</li>
          <li>
            <b>Personal access tokens</b> → <b>Tokens (classic)</b> →
            <b>Generate new token (classic)</b>。
          </li>
          <li>
            Note 随便填（如 <code>CompassZha data sync</code>），Expiration 按需选择，
            权限<b>只勾 <code>repo</code></b> 这一项（推送私密仓库必需）。
          </li>
          <li>
            点 <b>Generate token</b>，立刻复制以 <code>ghp_</code> 开头的一串字符——
            <b>它只显示这一次</b>，关掉页面就再也看不到，只能重新生成。
          </li>
        </ol>
        <p class="tip">
          GitHub 令牌相当于你的账号密码，不要发给任何人、不要贴到聊天或文档里。若怀疑泄漏，回到同一页面
          Revoke（吊销）后重新生成即可。
        </p>
        <p class="tip">
          <b>Gitee 私人令牌</b>：打开 <code>https://gitee.com/profile/personal_access_tokens</code>
          （或头像 → 设置 → 安全设置 → 私人令牌），点「生成新令牌」，勾选 <code>projects</code> 权限，
          生成后<b>只显示一次</b>，请立即复制保存。Gitee 已弃用账号密码推送，<b>必须用私人令牌替代密码</b>。
        </p>
        <p class="tip">
          设置页令牌框旁的「<b>获取令牌</b>」按钮会按当前选择的平台，直接用浏览器打开对应的令牌生成页
          （GitHub 已预勾 <code>repo</code> 权限）。
        </p>
      </section>

      <section>
        <h3>③ 在设置页填写</h3>
        <table>
          <thead>
            <tr><th>字段</th><th>填什么</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>同步平台</td>
              <td>GitHub 或 Gitee（决定令牌类型与认证方式）</td>
            </tr>
            <tr>
              <td>同步时机</td>
              <td>
                「打开软件时同步」（默认开）／「每次保存后同步」／「定时同步（5/15/30/60 分钟）」
                ——均按需勾选；也可随时点「立即同步」手动同步
              </td>
            </tr>
            <tr>
              <td>仓库地址</td>
              <td>第 ①（或 ①′）步复制的 <code>https://…​.git</code> 地址</td>
            </tr>
            <tr>
              <td>同步分支</td>
              <td>保持默认 <code>main</code> 即可</td>
            </tr>
            <tr>
              <td>访问令牌</td>
              <td>第 ② 步生成的 <code>ghp_…</code>（GitHub）或 Gitee 私人令牌</td>
            </tr>
          </tbody>
        </table>
        <p class="tip">
          先点 <b>保存配置</b>（令牌此时才写入系统凭据管理器），再点 <b>立即同步</b> 验证。同步成功后
          回到仓库页面，就能看到你的笔记文件。
        </p>
        <p class="tip">
          <b>首次同步提示</b>：若远端仓库里已经有内容，软件会自动做一次<b>安全对齐</b>后重试——
          只把远端历史接续为本地基线，<b>不会删除或改动你的任何数据文件</b>，也不会自动合并。
          若同步仍失败，请确认令牌具备仓库读写权限（GitHub <code>repo</code> / Gitee <code>projects</code>）、
          且网络能访问对应平台。
        </p>
      </section>

      <section>
        <h3>④ 配置 AI（API Key）</h3>
        <ol>
          <li>
            打开 <code>https://api-docs.deepseek.com/zh-cn/</code>（设置页 AI 区的
            「<b>DeepSeek 开放平台</b>」按钮可直达），注册并登录（新账号通常有免费额度）。
          </li>
          <li>左侧菜单 <b>API keys</b> → <b>创建 API key</b>，命名随意。</li>
          <li>
            复制以 <code>sk-</code> 开头的密钥——同样<b>只显示一次</b>，请立即保存。
          </li>
          <li>回到本软件的设置页，填入 AI 配置区并保存。</li>
        </ol>
        <p class="tip">
          DeepSeek <b>只是推荐默认</b>，并非唯一选择——凡兼容 OpenAI
          <code>chat/completions</code> 协议的服务都能用：把「接口地址」与「模型」改成对应服务商的
          即可。例如：月之暗面 Kimi（<code>https://api.moonshot.cn/v1</code>）、阿里云百炼·通义千问
          （<code>https://dashscope.aliyuncs.com/compatible-mode/v1</code>）、智谱 GLM
          （<code>https://open.bigmodel.cn/api/paas/v4</code>）、硅基流动
          （<code>https://api.siliconflow.cn/v1</code>）、OpenAI 官方
          （<code>https://api.openai.com/v1</code>），以及 Ollama / LM Studio 等本地服务。
          填写时以服务商文档给出的地址为准（多数需要带 <code>/v1</code>）。
        </p>
        <p class="tip">
          DeepSeek 按用量计费，费用从你账号的余额扣。密钥只存 Windows 凭据管理器，不写进任何文件。
        </p>
      </section>

      <section>
        <h3>⑤ 你的数据存在哪、安全吗</h3>
        <ul>
          <li>
            全部数据都是<b>本地 Markdown 文件</b>，存放在「数据目录」（设置页只读显示）下的
            <code>daily/</code>、<code>life/</code>、<code>corpus/</code> 三个子目录，可直接用
            记事本打开、也可用其它 Markdown 软件编辑。
          </li>
          <li>
            令牌与 API Key 只写入 <b>Windows 凭据管理器</b>，<b>不写入任何文件、配置或仓库</b>；
            推送时临时注入、用完即弃。
          </li>
          <li>
            软件以 MIT 协议开源，源码里不含任何人的账号、密钥或仓库地址，可以放心分发。
          </li>
        </ul>
      </section>

      <section>
        <h3>⑥ 常见问题</h3>
        <ul>
          <li>
            <b>提示「尚未保存令牌」</b>：先在设置页令牌框粘贴 <code>ghp_…</code>（或 Gitee 私人令牌）
            并点保存配置。
          </li>
          <li>
            <b>推送失败、提示权限或 403</b>：令牌权限不足或已过期——GitHub 重新生成时务必勾选
            <code>repo</code>，Gitee 勾选 <code>projects</code>。
          </li>
          <li>
            <b>推送失败、提示找不到远端</b>：仓库地址写错，或分支名与实际不符（新建仓库默认
            <code>main</code>）。
          </li>
          <li>
            <b>Gitee 认证失败</b>：确认仓库地址形如 <code>https://gitee.com/你的用户名/仓库名.git</code>
            （第一段是你的 Gitee 用户名；组织仓库暂不支持），且令牌具备 <code>projects</code> 权限。
          </li>
          <li>
            <b>换电脑怎么继续用</b>：新电脑上用同一个私密库地址与令牌配置一次即可；若想直接拿回历史，
            可把数据目录指向从该库 clone 下来的文件夹。
          </li>
          <li>
            <b>不想自动同步了</b>：关掉「打开软件时同步」「每次保存后同步」并把「定时同步」设为关闭，
            需要时再点「立即同步」；彻底不推送可点「清除已存令牌」。
          </li>
        </ul>
      </section>
    </div>

    <footer class="panel-foot">
      <button class="btn-primary" onclick={onclose}>知道了</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: rgb(17 24 39 / 32%);
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: min(720px, calc(100vw - 48px));
    max-height: calc(100vh - 80px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-head h2 {
    margin: 0;
    font-size: var(--font-size-md, 16px);
  }

  .close {
    display: inline-flex;
    color: var(--color-text-tertiary);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-alt);
  }

  .panel-body {
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    font-size: var(--font-size-sm, 13px);
    line-height: 1.75;
    color: var(--color-text-secondary);
  }

  .lead {
    margin: 0;
    color: var(--color-text-primary);
  }

  section h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-sm, 13px);
    color: var(--color-text-primary);
  }

  section ol,
  section ul {
    margin: 0;
    padding-left: var(--space-5, 20px);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-xs, 12px);
  }

  th,
  td {
    border: 1px solid var(--color-border);
    padding: var(--space-1) var(--space-2);
    text-align: left;
    vertical-align: top;
  }

  th {
    background: var(--color-surface-alt);
    color: var(--color-text-tertiary);
    font-weight: 600;
  }

  code {
    font-size: 0.92em;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--color-surface-alt);
    color: var(--color-text-primary);
  }

  .tip {
    margin: var(--space-2) 0 0;
    font-size: var(--font-size-xs, 12px);
    color: var(--color-text-tertiary);
  }

  .panel-foot {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
  }
</style>
