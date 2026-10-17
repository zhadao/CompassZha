/**
 * 说明书章节数据（v4.30 §2.16）：全部为自撰静态 HTML，供 Manual.svelte 渲染。
 * 约定两种可点击标记（Manual 在正文容器上做事件委托统一处理）：
 *  - `<a class="kw" data-jump="ch-x">关键词</a>` → 主题色标亮，点击滚到对应章节/锚点（助读）。
 *  - `<a class="ext" data-url="https://…">文字 ↗</a>` → 打开系统浏览器。
 * 章内锚点可用 `<h4 id="…">` 自定，供 data-jump 命中。
 */

export interface Chapter {
  /** 唯一 id，同时作为目录跳转目标与正文容器锚点 */
  id: string;
  /** 目录分组名 */
  group: string;
  /** 目录与正文标题 */
  title: string;
  /** 正文 HTML */
  html: string;
}

/** 跳转关键词样式用的类名（Manual 内定义） */
export const CHAPTERS: Chapter[] = [
  {
    id: "ch-intro",
    group: "起步",
    title: "认识 CompassZha",
    html: `
<p><b>CompassZha（人生仪表盘）</b>是一个完全本地运行的个人桌面软件，回答三个问题：<b>今天该干什么 / 状态怎么样 / 人在往哪走</b>。</p>
<ul>
  <li>左侧导航依次是：<span class="kw" data-jump="ch-today">今日</span>、<span class="kw" data-jump="ch-calendar">日历</span>、<span class="kw" data-jump="ch-dashboard">仪表盘</span>、<span class="kw" data-jump="ch-life">人生板块</span>、<span class="kw" data-jump="ch-pomodoro">番茄钟</span>、<span class="kw" data-jump="ch-chat">隆中对</span>、<span class="kw" data-jump="ch-git">设置</span>。</li>
  <li>你的所有内容都是<b>普通 Markdown 文件</b>，存在「<span class="kw" data-jump="ch-data">数据目录</span>」里，可以用记事本或任意 Markdown 软件打开、备份、迁移。</li>
  <li>软件<b>不内置任何账号、密钥或仓库地址</b>；要用「数据同步」和「AI（隆中对 / 数据分析）」，需要你自己按本说明书配好两样东西：一个<span class="kw" data-jump="ch-git-create">私密仓库</span>和一个<span class="kw" data-jump="ch-ai">API Key</span>。</li>
</ul>
<p class="lead">下面按「设置 → 各功能 → 数据与隐私 → 常见问题」排布。第一次用，建议先看完「设置」两章（<span class="kw" data-jump="ch-git">数据同步</span> 与 <span class="kw" data-jump="ch-ai">AI</span>），再按需查功能章节。</p>
`,
  },

  {
    id: "ch-git",
    group: "设置 · 数据同步",
    title: "一、为什么要同步、怎么同步",
    html: `
<p>同步 = 把你的「数据目录」推送到你自己的一个<b>私密 Git 仓库</b>（GitHub 或 Gitee），这样换电脑、误删、想回看历史都不怕。数据仓库必须<b>私密</b>；同时，<b>程序代码</b>将来会开源到另一个公开仓库，两者分开。</p>
<h4>同步是怎么发生的</h4>
<ul>
  <li>软件只对「数据目录」做本地提交，再推送到你填的远端仓库；<b>不会</b>动你的程序代码仓。</li>
  <li>软件<b>不管理你的密码</b>——认证交给本机 git（详见 <span class="kw" data-jump="ch-git-auth">怎么选认证方式</span>）。</li>
</ul>
<h4>开始前，你只需要做两件事</h4>
<ol>
  <li>建一个私密仓库 → 见 <span class="kw" data-jump="ch-git-create">创建私密仓库</span>。</li>
  <li>选一种认证方式（<b>推荐「自动」</b>，完全免输入）→ 见 <span class="kw" data-jump="ch-git-auth">选哪种认证方式</span>。</li>
</ol>
<p class="tip">国内网络更顺滑的话，选 <b>Gitee</b>；要用 GitHub 也完全没问题。两者步骤基本一致。</p>
`,
  },

  {
    id: "ch-git-create",
    group: "设置 · 数据同步",
    title: "二、创建私密仓库",
    html: `
<h4 id="repo-github">GitHub 建库</h4>
<ol>
  <li>登录 GitHub，打开 <a class="ext" data-url="https://github.com/new">github.com/new ↗</a>（或右上角 <b>+</b> → <b>New repository</b>）。</li>
  <li>填仓库名（如 <code>my-compass-data</code>），可见性选 <b>Private</b>。</li>
  <li><b>不要</b>勾选 Add a README / .gitignore / license，保持空仓库。</li>
  <li>点 <b>Create repository</b>，记下地址，形如 <code>https://github.com/你的用户名/仓库名.git</code>。</li>
</ol>
<h4 id="repo-gitee">Gitee 建库</h4>
<ol>
  <li>登录 Gitee，打开 <a class="ext" data-url="https://gitee.com/projects/new">gitee.com/projects/new ↗</a>（或右上角 <b>+</b> → 新建仓库）。</li>
  <li>填仓库名，权限选 <b>私有</b>；<b>不要</b>勾「初始化仓库」，保持空仓库。</li>
  <li>记下地址，形如 <code>https://gitee.com/你的用户名/仓库名.git</code>。</li>
</ol>
<p class="tip">建库只做一次。把仓库地址复制好，下一步要用。</p>
<p>建完就直接跳到 <span class="kw" data-jump="ch-git-auth">选哪种认证方式</span>。</p>
`,
  },

  {
    id: "ch-git-auth",
    group: "设置 · 数据同步",
    title: "三、选哪种认证方式（推荐「自动」）",
    html: `
<p>「设置 → 数据同步」顶部有一个<b>认证方式</b>下拉，两个选项：</p>
<h4 id="auth-auto">「自动」（默认，推荐）——一次都不用输密码</h4>
<ul>
  <li>软件<b>不读、不存、不传</b>任何密码，认证完全交给本机 git：<code>https://</code> 地址走 <b>系统凭据管理器</b>（Windows 的 Git 凭据管理器，首次登录一次后长期免输入）；<code>git@…</code> 地址走 <b>本机 SSH 密钥</b>。</li>
  <li>如果你已经在本机配过 GitHub/Gitee 的登录或 SSH，选它即可<b>开箱即用</b>。</li>
  <li>上手步骤：<span class="kw" data-jump="ch-git-ssh">用 SSH 公钥（最省心）</span>。</li>
</ul>
<h4 id="auth-token">「私人令牌」——显式填一串令牌</h4>
<ul>
  <li>令牌只存系统凭据管理器，推送时一次性使用、绝不落盘。</li>
  <li>适合：本机没有可用的凭据管理器、或你想明确用某个令牌的场景。</li>
  <li>上手步骤：<span class="kw" data-jump="ch-git-token">用私人令牌</span>。</li>
</ul>
<p class="tip">拿不定主意就选 <b>自动</b>。它对应「<b>一次都不用交账号密码</b>」的体验，也是本软件最推荐的方式。</p>
<p class="lead">选好后按对应教程走：<span class="kw" data-jump="ch-git-ssh">SSH 公钥教程</span> 或 <span class="kw" data-jump="ch-git-token">私人令牌教程</span>；然后对照 <span class="kw" data-jump="ch-git-fields">设置页字段</span> 填写。</p>
`,
  },

  {
    id: "ch-git-ssh",
    group: "设置 · 数据同步",
    title: "四、方案 A · 用 SSH 公钥",
    html: `
<p>「自动」模式 + SSH 地址 = 完全免输入密码。<b>按顺序照做</b>：</p>
<h4 id="ssh-key">第 1 步：生成密钥（只需一次）</h4>
<ol>
  <li>在 Windows 上按 <code>Win + R</code>，输入 <code>cmd</code> 回车，打开命令行。</li>
  <li>粘贴执行：<code>ssh-keygen -t ed25519 -C "你的邮箱"</code>，一路回车（连按几次 Enter，密码留空即可）。</li>
  <li>生成两个文件：私钥 <code>~/.ssh/id_ed25519</code>（<b>绝不外传</b>）、公钥 <code>~/.ssh/id_ed25519.pub</code>（要贴给对方）。</li>
  <li>查看并复制公钥内容：<code>type %USERPROFILE%\.ssh\id_ed25519.pub</code>，把输出的一整行（以 <code>ssh-ed25519</code> 开头）复制下来。</li>
</ol>
<h4 id="ssh-add">第 2 步：把公钥贴到平台</h4>
<ul>
  <li><b>GitHub</b>：打开 <a class="ext" data-url="https://github.com/settings/keys">github.com/settings/keys ↗</a> → <b>New SSH key</b> → Title 随便填 → Key 框粘贴刚才复制的一行 → <b>Add SSH key</b>。</li>
  <li><b>Gitee</b>：打开 <a class="ext" data-url="https://gitee.com/profile/sshkeys">gitee.com/profile/sshkeys ↗</a> → 填标题 → 粘贴公钥 → 确定。</li>
</ul>
<h4 id="ssh-use">第 3 步：在软件里用 SSH 地址</h4>
<ol>
  <li>「设置 → 数据同步」→ <b>认证方式</b> 选 <b>自动</b>。</li>
  <li><b>仓库地址</b> 填 SSH 形式：<code>git@github.com:你的用户名/仓库名.git</code> 或 <code>git@gitee.com:你的用户名/仓库名.git</code>。</li>
  <li>点 <b>保存配置</b>，再点 <b>立即同步</b>。首次连接软件会自动记录该主机指纹（<code>accept-new</code>），之后若指纹变了会拒绝（防中间人）。</li>
</ol>
<p class="tip">提示「权限被拒 / Permission denied (publickey)」= 公钥没贴好或没生效，重做第 2 步；「主机密钥校验失败」= 之前记录过不同指纹，可在命令行执行 <code>ssh-keygen -R 主机名</code> 清除后重试。</p>
<p>还差设置页几个字段 → 见 <span class="kw" data-jump="ch-git-fields">字段对照</span>，然后 <span class="kw" data-jump="ch-git-verify">验证与排错</span>。</p>
`,
  },

  {
    id: "ch-git-token",
    group: "设置 · 数据同步",
    title: "五、方案 B · 用私人令牌",
    html: `
<p>想显式使用一串令牌时选这条路。<b>按平台照做</b>：</p>
<h4 id="token-github">GitHub 个人访问令牌（PAT）</h4>
<ol>
  <li>打开 <a class="ext" data-url="https://github.com/settings/tokens/new?scopes=repo&description=CompassZha%20data%20sync">github.com/settings/tokens/new ↗</a>（已预勾 <code>repo</code> 权限）。</li>
  <li>Note 随便填（如 <code>CompassZha data sync</code>），Expiration 按需选择，权限<b>只勾 <code>repo</code></b> 这一项。</li>
  <li>点 <b>Generate token</b>，立刻复制以 <code>ghp_</code> 开头的一串——<b>它只显示这一次</b>，关掉页面就再也看不到，只能重新生成。</li>
</ol>
<h4 id="token-gitee">Gitee 私人令牌</h4>
<ol>
  <li>打开 <a class="ext" data-url="https://gitee.com/profile/personal_access_tokens">gitee.com/profile/personal_access_tokens ↗</a>（或 头像 → 设置 → 安全设置 → 私人令牌）。</li>
  <li>点「生成新令牌」，勾选 <code>projects</code> 权限，生成后<b>只显示一次</b>，立即复制保存。</li>
</ol>
<h4 id="token-use">在软件里填入</h4>
<ol>
  <li>「设置 → 数据同步」→ <b>认证方式</b> 选 <b>私人令牌</b>。</li>
  <li><b>仓库地址</b> 填 <code>https://</code> 形式（此模式必须 https）。</li>
  <li>把令牌粘贴进 <b>访问令牌</b> 输入框，点 <b>保存配置</b>（此时令牌才写入系统凭据管理器），再点 <b>立即同步</b>。</li>
</ol>
<p class="tip">令牌输入框旁的「<b>获取令牌</b>」按钮会按当前平台直接用浏览器打开对应的令牌生成页，省得自己找。令牌等同于账号密码，<b>不要发给任何人、不要贴进聊天或文档</b>；怀疑泄漏就回原页面 Revoke（吊销）后重新生成。</p>
<p>接着对照 <span class="kw" data-jump="ch-git-fields">字段对照</span>，再 <span class="kw" data-jump="ch-git-verify">验证与排错</span>。</p>
`,
  },

  {
    id: "ch-git-fields",
    group: "设置 · 数据同步",
    title: "六、设置页字段对照表",
    html: `
<table>
  <thead><tr><th>字段</th><th>填什么</th></tr></thead>
  <tbody>
    <tr><td>同步平台</td><td>GitHub 或 Gitee（决定令牌类型与「获取令牌」按钮目标）</td></tr>
    <tr><td>认证方式</td><td><b>自动</b>（推荐，免输入，见 <span class="kw" data-jump="ch-git-auth">说明</span>）或 <b>私人令牌</b></td></tr>
    <tr><td>同步时机</td><td>默认只勾「打开软件时同步」；「每次保存后同步」「定时同步」按需开启；也可随时点「立即同步」</td></tr>
    <tr><td>仓库地址</td><td><code>https://主机/用户名/仓库名.git</code>，或 SSH 形式 <code>git@主机:用户名/仓库名.git</code></td></tr>
    <tr><td>同步分支</td><td>默认 <code>main</code>；若报 <code>src refspec … does not match any</code>，请改填你数据仓的<b>实际分支名</b>（例如本地数据仓是 <code>master</code> 就填 <code>master</code>）</td></tr>
    <tr><td>访问令牌</td><td>仅「认证方式 = 私人令牌」时需要，填 <span class="kw" data-jump="ch-git-token">上一步生成的令牌</span></td></tr>
  </tbody>
</table>
<p class="tip"><b>首次同步提示</b>：若远端仓库里已有内容，软件会自动做一次<b>安全对齐</b>后重试——只把远端历史接续为本地基线，<b>不会删除或改动你的任何数据文件</b>，也不会自动合并。</p>
<p>下一步：<span class="kw" data-jump="ch-git-verify">验证与排错</span>。</p>
`,
  },

  {
    id: "ch-git-verify",
    group: "设置 · 数据同步",
    title: "七、验证与排错",
    html: `
<h4>怎么验证成功</h4>
<ol>
  <li>先点 <b>保存配置</b>，再点 <b>立即同步</b>（这是唯一会把错误回显给你的按钮）。</li>
  <li>看到成功提示后，回到你的仓库网页刷新，就能看到你的数据文件了。</li>
  <li>之后可把「打开软件时同步」留在开，平时就自动对齐。</li>
</ol>
<h4>常见报错对照</h4>
<ul>
  <li><code>Unauthorized</code> / <code>Authentication failed</code>：地址或认证不对。确认 <span class="kw" data-jump="ch-git-auth">认证方式</span> 选择正确；令牌模式请确认令牌权限（GitHub <code>repo</code> / Gitee <code>projects</code>）且未过期。</li>
  <li><code>src refspec … does not match any</code>：<b>同步分支</b>与实际不符——把它改成本地数据仓真实的分支名即可。</li>
  <li><code>403</code> / 权限不足：令牌权限不够或已过期，重新生成并勾对权限，见 <span class="kw" data-jump="ch-git-token">私人令牌教程</span>。</li>
  <li>找不到远端 / 仓库不存在：仓库地址写错，或建库时没保持空仓。</li>
  <li>Gitee 认证失败：确认地址是 <code>https://gitee.com/你的用户名/仓库名.git</code>（第一段是你的 <b>用户名</b>；组织仓库暂不支持），令牌具备 <code>projects</code> 权限。</li>
  <li>想彻底不推送：关闭两个自动开关、定时设为「关闭」，或点「清除已存令牌」。</li>
</ul>
<p>排障时也别担心：软件对数据的任何同步操作都<b>只增不删</b>，你的文件始终在原处。</p>
`,
  },

  {
    id: "ch-ai",
    group: "设置 · AI",
    title: "配置 AI（隆中对 & 数据分析）",
    html: `
<p>「隆中对」对话和仪表盘的「AI 数据分析」都要用到一个 <b>AI API Key</b>。默认推荐 <b>DeepSeek</b>（新账号通常有免费额度），但<b>不是唯一选择</b>。</p>
<h4 id="ai-deepseek">获取 DeepSeek API Key</h4>
<ol>
  <li>打开 <a class="ext" data-url="https://api-docs.deepseek.com/zh-cn/">DeepSeek 开放平台 ↗</a>（设置页 AI 区也有「<b>DeepSeek 开放平台</b>」直达按钮），注册并登录。</li>
  <li>左侧菜单 <b>API keys</b> → <b>创建 API key</b>，命名随意。</li>
  <li>复制以 <code>sk-</code> 开头的密钥——同样<b>只显示一次</b>，请立即保存。</li>
  <li>回到「设置 → AI 配置」，把密钥粘贴进 <b>DeepSeek API Key</b>，点 <b>保存配置</b>（密钥只写入 Windows 凭据管理器，不写任何文件）。</li>
</ol>
<h4 id="ai-compat">换用其它服务商（兼容 OpenAI 协议）</h4>
<p>凡兼容 OpenAI <code>chat/completions</code> 协议的服务都能用——把「接口地址」和「模型」改成对应服务商的即可（多数需要带 <code>/v1</code>）：</p>
<table>
  <thead><tr><th>服务商</th><th>接口地址</th></tr></thead>
  <tbody>
    <tr><td>DeepSeek（推荐默认）</td><td><code>https://api.deepseek.com</code> · <a class="ext" data-url="https://api-docs.deepseek.com/zh-cn/">文档 ↗</a></td></tr>
    <tr><td>月之暗面 Kimi</td><td><code>https://api.moonshot.cn/v1</code> · <a class="ext" data-url="https://platform.moonshot.cn/">平台 ↗</a></td></tr>
    <tr><td>阿里云百炼·通义千问</td><td><code>https://dashscope.aliyuncs.com/compatible-mode/v1</code> · <a class="ext" data-url="https://bailian.console.aliyun.com/">控制台 ↗</a></td></tr>
    <tr><td>智谱 GLM</td><td><code>https://open.bigmodel.cn/api/paas/v4</code> · <a class="ext" data-url="https://open.bigmodel.cn/">平台 ↗</a></td></tr>
    <tr><td>硅基流动</td><td><code>https://api.siliconflow.cn/v1</code> · <a class="ext" data-url="https://cloud.siliconflow.cn/">平台 ↗</a></td></tr>
    <tr><td>OpenAI 官方</td><td><code>https://api.openai.com/v1</code> · <a class="ext" data-url="https://platform.openai.com/">平台 ↗</a></td></tr>
    <tr><td>本地 Ollama / LM Studio</td><td>以其文档给出的本机地址为准（如 <code>http://localhost:11434/v1</code>）</td></tr>
  </tbody>
</table>
<h4 id="ai-data">数据分析 API（可选）</h4>
<p>仪表盘的「AI 数据分析」可以单独再配一个 API，让它与隆中对<b>分开缓存、各提升命中率</b>；只有一个 API 时留空即可，自动与上方主 API 共用。</p>
<h4 id="ai-corpus">语料文件夹</h4>
<p>「语料文件夹」只读显示，指向 <span class="kw" data-jump="ch-chat">corpus 目录</span>——往里放 Markdown 就是给隆中对喂语料（详见 <span class="kw" data-jump="ch-chat">隆中对</span>）。</p>
<p class="tip">费用说明：DeepSeek 等按用量计费，从你账号余额扣；密钥只存 Windows 凭据管理器，不写进任何文件，也不随数据同步上传。</p>
`,
  },

  {
    id: "ch-today",
    group: "功能使用",
    title: "今日 / 日记（daily）",
    html: `
<p>「今日」是每天的主入口：看今天的日程与清单，随手记录当天状态与日记。</p>
<ul>
  <li>内容写入「<span class="kw" data-jump="ch-data">数据目录</span>」的 <code>daily/年/</code> 下，文件名 <code>yyyy-mm-dd.md</code>，一天一个文件。</li>
  <li>文件头是结构化字段（睡眠时长 / 入睡起床时间 / 体重 / 支出 / 心情 / 专注分钟 / 步数等），这些字段会自动汇入 <span class="kw" data-jump="ch-dashboard">仪表盘</span> 的指标与趋势曲线。</li>
  <li>正文里的「日程」会与 <span class="kw" data-jump="ch-calendar">日历</span> 联动。日记不参与 AI 语料检索。</li>
</ul>
<p class="tip">轻录入、重回看：不用写很多字，状态字段填了，仪表盘就有数据。</p>
`,
  },

  {
    id: "ch-calendar",
    group: "功能使用",
    title: "日历",
    html: `
<p>日历基于 FullCalendar，用来放日程与<b>循环事件</b>（如每周例会、每月还款）。</p>
<ul>
  <li>点击某天可查看/添加当日安排；当日安排也会写回对应的 <code>daily/…md</code>「日程」段。</li>
  <li><b>循环事件</b>保存在 <code>events/循环事件.md</code>——每一条规则一节，由规则驱动「懒物化」到具体日期；可用内置编辑器手改，也是 Markdown，AI 也能读到。</li>
  <li>日历里的日程可用 Markdown 编辑，与笔记同一编辑器。</li>
</ul>
<p class="tip">日历内容同样落入 daily 与 events，配合 <span class="kw" data-jump="ch-git">数据同步</span> 一并备份。</p>
`,
  },

  {
    id: "ch-dashboard",
    group: "功能使用",
    title: "仪表盘",
    html: `
<p>仪表盘把你的量化数据变成一眼能看懂的画面，回答「状态怎么样」。</p>
<ul>
  <li><b>指标卡</b>：睡眠时长、入睡时间、起床时间、体重、当日支出、心情、<b>运动步数</b>、专注时长。</li>
  <li><b>趋势曲线</b>：以上指标各有折线趋势，时间范围可选 7 / 30 / 90 天。</li>
  <li><b>板块投入热力图</b>：GitHub contribution 风格日历热力图，按每个 <span class="kw" data-jump="ch-life">人生板块</span> 每天被任务关联的次数着色（越绿投入越多），统计近一年。</li>
  <li><b>AI 数据分析</b>：仪表盘顶部按钮，弹出对话窗——<b>只回答与已捕捉量化数据相关</b>的问题（睡眠、起床、体重、心情、专注、运动、支出等），可基于近 7/30/90 天给建议；非数据类提问会统一回复「该工作区只能回答数据相关的问题」。</li>
</ul>
<p class="tip">数据来源 = <span class="kw" data-jump="ch-today">每日文件</span> 的结构化字段 + 任务/板块记录；AI 数据分析需要先在 <span class="kw" data-jump="ch-ai">AI 配置</span> 里配好 Key。</p>
`,
  },

  {
    id: "ch-life",
    group: "功能使用",
    title: "人生板块",
    html: `
<p>人生板块是你自建的人生分类（如「事业」「健康」「学习」），用来回答「人在往哪走」。</p>
<ul>
  <li>每个板块 = <code>life/</code> 下的<b>一个子文件夹</b>；文件夹里可以建多个 Markdown 文件。点板块卡片进入对应文件夹，用内置编辑器<b>实时编辑</b>。</li>
  <li>板块图标可在创建时选择（与 <span class="kw" data-jump="ch-dashboard">热力图</span> 标题、卡片、面包屑、任务菜单保持一致）。</li>
  <li><b>关联任务</b>：对清单任务右键 → 「关联板块」，即可把任务挂到某板块（无需手写标签）；仪表盘据此统计该板块每天投入。</li>
  <li><b>板块改名</b>：会把所有关联任务里的旧板块标签一并替换为新名，历史热力图数据完整保留并迁移到新名下。</li>
  <li><b>板块删除</b>：可选「保留历史热力图数据」或「全部清除」；保留时会明确告诉你数据存档位置。</li>
</ul>
<p class="tip">板块内容都是普通 Markdown，放在 <span class="kw" data-jump="ch-data">life/ 目录</span>，随同步一起备份。</p>
`,
  },

  {
    id: "ch-pomodoro",
    group: "功能使用",
    title: "番茄钟（双模式）",
    html: `
<p>番茄钟帮助专注，并把专注时长汇入 <span class="kw" data-jump="ch-dashboard">仪表盘</span>。</p>
<ul>
  <li><b>倒计时模式</b>：可选 10 / 25 / 40 分钟或自定义时长，并可为本次专注设置任务标题。</li>
  <li><b>正计时模式</b>：秒表计时，<b>停表即结束并记录</b>这段专注时长。</li>
  <li>两种模式的专注数据都会同步到仪表盘的「专注时长」指标。</li>
</ul>
`,
  },

  {
    id: "ch-chat",
    group: "功能使用",
    title: "隆中对（对话 & 语料怎么喂）",
    html: `
<p>「隆中对」是你的私人 AI 助手：通过配置 AI + 培养语料，慢慢长成「属于你的诸葛孔明」。它<b>优先基于你的语料检索结果回答</b>；找不到相关语料时，AI 会直接兜底回答，并提示「语料支撑不足」。</p>
<h4 id="chat-setup">先配好 AI</h4>
<p>需要先在 <span class="kw" data-jump="ch-ai">AI 配置</span> 里填入 API Key。没有 Key 时无法对话。</p>
<h4 id="chat-corpus">怎么喂语料（关键）</h4>
<ol>
  <li>语料就是 <b>Markdown 文件</b>，统一放进「<span class="kw" data-jump="ch-data">数据目录</span>」的 <code>corpus/</code> 文件夹——<b>直接放根目录即可，无需按主题分文件夹</b>。</li>
  <li>想打开语料文件夹：隆中对页面有「<b>资源跳转</b>」按钮，一键在资源管理器中打开；设置页 AI 区也显示语料文件夹路径。</li>
  <li>放好文件后<b>重启软件或刷新索引</b>，新的 Markdown 就会成为可检索语料。</li>
  <li>目前引擎只识别 <code>.md</code> 文件——<b>其它格式（如 .txt / .json）会被静默跳过</b>；PDF / EPUB 可用隆中对里的「<b>语料转化</b>」入口转成 Markdown（扫描版 PDF 需先 OCR）。</li>
</ol>
<p class="tip">初始语料可选地用「立正」公开语料库；之后你手动添加的 Markdown 直接丢进 <code>corpus/</code> 根目录就行。跨主题的语料放一份即可，不用重复。</p>
<h4 id="chat-save">保存对话</h4>
<p>会话页有「<b>保存</b>」按钮：把当前会话存成 Markdown，命名 <code>yyyy-mm-dd_hh-mm_简短标题.md</code>，落到 <code>conversations/</code>；保存成功会有提示，并可一键「打开所在文件夹」。</p>
<p class="tip">页面上的「<b>说明</b>」按钮另有简版指引（API 使用、语料存放、隐私说明）。</p>
`,
  },

  {
    id: "ch-data",
    group: "数据与隐私",
    title: "数据目录与隐私（各文件夹怎么管）",
    html: `
<p>你的所有数据都是本地 Markdown，存在「数据目录」里（「设置 → 数据」区块可只读查看并「打开数据目录」）。目录结构如下：</p>
<table>
  <thead><tr><th>目录 / 文件</th><th>放什么 · 怎么管</th></tr></thead>
  <tbody>
    <tr><td><code>daily/年/</code></td><td><b>日记 + 当日日程</b>，一天一个 <code>yyyy-mm-dd.md</code>；随 <span class="kw" data-jump="ch-today">今日</span> 与 <span class="kw" data-jump="ch-calendar">日历</span> 写入，可手改</td></tr>
    <tr><td><code>life/&lt;板块名&gt;/</code></td><td><b>人生板块</b>，每板块一子文件夹，内含多个 md；见 <span class="kw" data-jump="ch-life">人生板块</span></td></tr>
    <tr><td><code>events/循环事件.md</code></td><td><b>日历循环规则库</b>，每规则一节，应用维护、可手改</td></tr>
    <tr><td><code>corpus/</code></td><td><b>隆中对语料</b>，往里丢 Markdown 即成语料（不限主题）；见 <span class="kw" data-jump="ch-chat">隆中对</span></td></tr>
    <tr><td><code>conversations/</code></td><td><b>AI 对话归档</b>，<code>yyyy-mm-dd_hh-mm_标题.md</code>，应用保存、可手改</td></tr>
    <tr><td><code>README.md</code></td><td>目录说明（首次启动自动生成，纯说明文件）</td></tr>
    <tr><td><code>config.json</code></td><td>应用设置（数据根 / 关闭行为 / AI / 同步 / 外观），由应用读写</td></tr>
    <tr><td><code>tasks.db</code></td><td>任务 / 板块 / 热力图数据（SQLite，随功能开发启用）</td></tr>
  </tbody>
</table>
<h4>怎么备份 / 换电脑</h4>
<ul>
  <li>「设置 → 数据」有「<b>导出总数据</b>」：把整个数据根打包成一个 zip 存到「下载」文件夹，并给出「打开所在文件夹」。换电脑时整体拷过去即可。</li>
  <li>或者直接用 <span class="kw" data-jump="ch-git">数据同步</span>：新电脑上用同一个私密仓地址配置一次，数据就回来了。</li>
  <li>也可以用任何 Markdown 软件或记事本直接打开这些文件编辑。</li>
</ul>
<h4>隐私与安全</h4>
<ul>
  <li>软件<b>不内置任何账号、密钥或仓库地址</b>；令牌与 API Key 只写入 <b>Windows 凭据管理器</b>，不写进任何文件、配置或仓库。</li>
  <li>数据同步时，只有<b>数据文件夹</b>会推到你的<b>私密</b>仓；将来程序代码另行开源到公开仓，两者分开。</li>
  <li>软件以 <b>MIT 协议开源</b>，源码里不含任何人的账号、密钥或仓库地址，可以放心分发。</li>
</ul>
`,
  },

  {
    id: "ch-faq",
    group: "数据与隐私",
    title: "常见问题 FAQ",
    html: `
<ul>
  <li><b>提示「尚未保存令牌」</b>：说明「认证方式」选了 <b>私人令牌</b>。要么去 <span class="kw" data-jump="ch-git-token">生成并粘贴令牌</span> 再保存配置；要么改用默认的 <b>自动</b>（免令牌）。</li>
  <li><b>同步报权限 / 403</b>：令牌权限不足或已过期。GitHub 重新生成时务必勾 <code>repo</code>，Gitee 勾 <code>projects</code>。</li>
  <li><b>同步报找不到远端</b>：仓库地址写错，或分支名与实际不符（见 <span class="kw" data-jump="ch-git-fields">字段对照</span> 的「同步分支」）。</li>
  <li><b>Gitee 认证失败</b>：确认地址形如 <code>https://gitee.com/你的用户名/仓库名.git</code>，第一段是你的用户名，令牌有 <code>projects</code> 权限。</li>
  <li><b>换电脑怎么继续用</b>：新电脑上用同一个私密库地址与认证方式配置一次即可（见 <span class="kw" data-jump="ch-data">数据目录与隐私</span>）。</li>
  <li><b>不想自动同步了</b>：关掉「打开软件时同步」「每次保存后同步」，定时设为「关闭」，需要时再点「立即同步」；彻底不推送可点「清除已存令牌」。</li>
  <li><b>AI 答不出我的问题</b>：隆中对是「先检索语料再回答」，语料不足时会提示。往 <code>corpus/</code> 里多放对应 Markdown 即可（见 <span class="kw" data-jump="ch-chat">隆中对</span>）。</li>
  <li><b>仪表盘 AI 不回答非数据问题</b>：这是设计如此——数据分析对话只处理已捕捉的量化数据，其它一律回复固定话术。</li>
</ul>
<p class="tip">还有问题？可以在设置页右下角「软件作者」查看更多信息。</p>
`,
  },
];
