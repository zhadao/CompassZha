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
        GitHub、让 AI 读你的笔记，需要你自己准备两样东西：一个<b>私密仓库</b>（配访问令牌）和一个
        <b>AI API Key</b>。下面按顺序照做即可。
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
        <h3>② 创建访问令牌（PAT）</h3>
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
          令牌相当于你的账号密码，不要发给任何人、不要贴到聊天或文档里。若怀疑泄漏，回到同一页面
          Revoke（吊销）后重新生成即可。
        </p>
      </section>

      <section>
        <h3>③ 在设置页填写（本页下方表单）</h3>
        <table>
          <thead>
            <tr><th>字段</th><th>填什么</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>开启自动同步</td>
              <td>想让每次保存后自动上传就勾上；只手动同步可不勾</td>
            </tr>
            <tr>
              <td>仓库地址</td>
              <td>第 ① 步复制的 <code>https://…​.git</code> 地址</td>
            </tr>
            <tr>
              <td>同步分支</td>
              <td>保持默认 <code>main</code> 即可</td>
            </tr>
            <tr>
              <td>GitHub 访问令牌</td>
              <td>第 ② 步生成的 <code>ghp_…</code> 令牌</td>
            </tr>
            <tr>
              <td>数据目录</td>
              <td>只读展示，无需填写</td>
            </tr>
          </tbody>
        </table>
        <p class="tip">
          先点 <b>保存配置</b>（令牌此时才写入系统凭据管理器），再点 <b>立即同步</b> 验证。同步成功后
          回到 GitHub 仓库页面，就能看到你的笔记文件。
        </p>
      </section>

      <section>
        <h3>④ 配置 AI（DeepSeek API Key）</h3>
        <ol>
          <li>
            打开 <code>platform.deepseek.com</code>，注册并登录（新账号通常有免费额度）。
          </li>
          <li>左侧菜单 <b>API keys</b> → <b>创建 API key</b>，命名随意。</li>
          <li>
            复制以 <code>sk-</code> 开头的密钥——同样<b>只显示一次</b>，请立即保存。
          </li>
          <li>
            回到本软件的设置页，填入 AI 配置区并保存（该表单随 AI 对话功能一同上线，届时本页会出现
            「AI 配置」字段）。
          </li>
        </ol>
        <p class="tip">
          DeepSeek 按用量计费，费用从你账号的余额扣。密钥同样只存 Windows 凭据管理器，不写进任何文件。
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
            <b>提示「尚未保存令牌」</b>：先在上方令牌框粘贴 <code>ghp_…</code> 并点保存配置。
          </li>
          <li>
            <b>推送失败、提示权限或 403</b>：令牌权限不足或已过期——重新生成时务必勾选
            <code>repo</code>。
          </li>
          <li>
            <b>推送失败、提示找不到远端</b>：仓库地址写错，或分支名与实际不符（新建仓库默认
            <code>main</code>）。
          </li>
          <li>
            <b>换电脑怎么继续用</b>：新电脑上用同一个私密库地址与令牌配置一次即可；若想直接拿回历史，
            可把数据目录指向从该库 clone 下来的文件夹。
          </li>
          <li><b>不想同步了</b>：关掉「开启自动同步」开关，或点「清除已存令牌」。</li>
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
