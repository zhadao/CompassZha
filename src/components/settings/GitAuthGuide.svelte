<script lang="ts">
  // 认证引导（v4.40 C-2 从 GitSyncSection 拆出，CODE-003）：把认证做成按钮式傻瓜流程。
  //  · 自动 + SSH 地址 → 生成密钥 / 复制公钥 / 打开添加密钥页 / 测试连接
  //  · 私人令牌      → 获取令牌（创建页权限已预填）/ 粘贴 → 测试并保存 / 清除已存令牌
  //  · 自动 + https  → 认证交给系统凭据管理器，点「测试连接」即可
  // 测试成功统一显示「✅ 同步已就绪」，失败回显 git 原始报错。
  import {
    gitSshGenerateKey,
    gitTestConnection,
    openUrlHttps,
    type GitPlatform,
    type GitAuth,
  } from "../../lib/tauri-fs";

  interface Props {
    platform: GitPlatform;
    auth: GitAuth;
    remote: string;
    /** 令牌输入（父组件持有，双向绑定） */
    token: string;
    tokenSaved: boolean;
    busy: boolean;
    /** 令牌路线第 3 步：父组件先保存配置（含令牌，失败会抛出）再测试 */
    onSaveTest: () => Promise<void>;
    /** 清除系统凭据管理器里的令牌 */
    onClearToken: () => void;
  }
  let { platform, auth, remote, token = $bindable(""), tokenSaved, busy, onSaveTest, onClearToken }: Props = $props();

  /** 令牌创建页（GitHub 已预勾 repo 权限，即「打开创建页 = 权限预填」） */
  const TOKEN_URL: Record<GitPlatform, string> = {
    github: "https://github.com/settings/tokens/new?scopes=repo&description=CompassZha%20data%20sync",
    gitee: "https://gitee.com/profile/personal_access_tokens",
  };
  /** SSH 公钥添加页 */
  const SSH_KEYS_URL: Record<GitPlatform, string> = {
    github: "https://github.com/settings/keys",
    gitee: "https://gitee.com/profile/sshkeys",
  };

  const hostLabel = $derived(platform === "gitee" ? "Gitee" : "GitHub");
  const tokenLabel = $derived(platform === "gitee" ? "Gitee 私人令牌" : "GitHub 访问令牌（PAT）");
  const tokenHint = $derived(
    tokenSaved ? "已保存——输入新值可替换" : platform === "gitee" ? "Gitee 私人令牌（只存系统凭据管理器）" : "ghp_…（只存系统凭据管理器）",
  );
  const isToken = $derived(auth === "token");
  const isSsh = $derived(auth === "auto" && (remote.trim().startsWith("git@") || remote.trim().startsWith("ssh://")));

  let publicKey = $state("");
  let keyNote = $state("");
  let copied = $state(false);
  let working = $state(false);
  let result = $state("");
  let ok = $state(false);

  /** 外链直达浏览器；Tauri 外链失败回退 window.open（沿用 AuthorDialog 范式） */
  async function openExt(url: string) {
    try {
      await openUrlHttps(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  /** 第 1 步：生成密钥（本机已有则直接复用，绝不覆盖） */
  async function genKey() {
    working = true;
    keyNote = "";
    result = "";
    try {
      const r = await gitSshGenerateKey();
      publicKey = r.public_key;
      keyNote = r.created ? "已生成新的密钥对（~/.ssh/id_ed25519）" : "本机已有密钥，已直接复用（未覆盖原密钥）";
    } catch (e) {
      keyNote = `${e}`;
    }
    working = false;
  }

  /** 第 2 步：复制公钥（被系统拒绝时下方公钥文本可手动选中复制） */
  async function copyKey() {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      keyNote = "自动复制被系统拒绝——请手动选中下方公钥文本复制";
    }
  }

  /** 测试连通性（只读 ls-remote，不改动任何数据） */
  async function test() {
    working = true;
    result = "";
    ok = false;
    try {
      result = await gitTestConnection();
      ok = true;
    } catch (e) {
      result = `${e}`;
    }
    working = false;
  }

  /** 令牌路线第 3 步：先由父组件保存配置（含令牌），成功后再测连通性 */
  async function saveAndTest() {
    working = true;
    result = "";
    ok = false;
    try {
      await onSaveTest();
      result = await gitTestConnection();
      ok = true;
    } catch (e) {
      result = `${e}`;
    }
    working = false;
  }
</script>

<div class="sub-block">
  <h3 class="sub-title">认证怎么做（跟着按钮走即可）</h3>

  {#if isSsh}
    <p class="sub-note">「自动 + SSH 地址」= 一次都不用输密码，三步走：</p>
    <ol class="steps">
      <li>
        <p class="step-title">生成密钥（只需一次；本机已有则自动复用）</p>
        <div class="actions">
          <button class="btn-secondary" onclick={() => void genKey()} disabled={busy || working}>生成密钥</button>
        </div>
        {#if keyNote}<p class="note" class:ok={!!publicKey}>{keyNote}</p>{/if}
      </li>
      <li>
        <p class="step-title">复制公钥，到 {hostLabel} 网页粘贴保存</p>
        <div class="actions">
          <button class="btn-secondary" onclick={() => void copyKey()} disabled={busy || !publicKey}>
            {copied ? "已复制 ✓" : "复制公钥"}
          </button>
          <button class="btn-secondary" onclick={() => void openExt(SSH_KEYS_URL[platform])}>打开添加密钥页</button>
        </div>
        {#if publicKey}<code class="pubkey">{publicKey}</code>{/if}
      </li>
      <li>
        <p class="step-title">仓库地址填成 SSH 形式后，测试连接</p>
        <div class="actions">
          <button class="btn-secondary" onclick={() => void test()} disabled={busy || working}>测试连接</button>
        </div>
      </li>
    </ol>
  {:else if isToken}
    <p class="sub-note">三步：打开创建页 → 粘贴令牌 → 测试并保存。</p>
    <ol class="steps">
      <li>
        <p class="step-title">打开 {hostLabel} 令牌创建页（权限已预填）</p>
        <div class="actions">
          <button class="btn-secondary" onclick={() => void openExt(TOKEN_URL[platform])}>获取令牌</button>
        </div>
      </li>
      <li>
        <p class="step-title">复制令牌（只显示一次），粘贴到这里</p>
        <label class="field">
          <span class="label">{tokenLabel}</span>
          <input type="password" bind:value={token} placeholder={tokenHint} autocomplete="off" />
        </label>
        {#if tokenSaved}
          <button class="link-btn" onclick={onClearToken} disabled={busy}>清除已存令牌</button>
        {/if}
      </li>
      <li>
        <p class="step-title">仓库地址填成 https:// 形式后，测试并保存</p>
        <div class="actions">
          <button class="btn-secondary" onclick={() => void saveAndTest()} disabled={busy || working}>测试并保存</button>
        </div>
      </li>
    </ol>
  {:else}
    <p class="sub-note">
      「自动 + https 地址」= 认证交给系统凭据管理器（Windows 的 Git 凭据管理器），首次登录一次后长期免输入。
    </p>
    <div class="actions">
      <button class="btn-secondary" onclick={() => void test()} disabled={busy || working}>测试连接</button>
    </div>
  {/if}

  {#if result}
    <p class="result" class:ok>{#if ok}✅ 同步已就绪 —— {/if}{result}</p>
  {/if}
</div>

<style>
  .sub-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: 8px;
  }
  .sub-title {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-title);
  }
  .sub-note {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.6;
  }
  .steps {
    margin: 0;
    padding-left: var(--space-5, 20px);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .step-title {
    margin: 0 0 var(--space-1);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field input {
    width: 100%;
  }
  .label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .note {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.6;
    word-break: break-all;
  }
  .note.ok {
    color: var(--color-success);
  }
  .pubkey {
    display: block;
    margin-top: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface-alt);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    word-break: break-all;
    user-select: all;
  }
  .result {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-danger);
    line-height: 1.6;
    word-break: break-word;
  }
  .result.ok {
    color: var(--color-success);
  }
  .link-btn {
    align-self: flex-start;
    padding: 0;
    background: none;
    border: none;
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    cursor: pointer;
    text-decoration: underline;
    white-space: nowrap;
  }
</style>
