# 参与贡献

感谢你对 CompassZha 的关注。本文档说明如何提 Issue、提交代码，以及本项目遵循的工程约定。

## 目录

- [报告问题](#报告问题)
- [提出功能建议](#提出功能建议)
- [提交代码](#提交代码)
- [开发环境](#开发环境)
- [工程约定](#工程约定)
- [提交信息规范](#提交信息规范)

---

## 报告问题

提交 Issue 前请先搜索是否已有相同问题。Bug 报告请尽量包含：

- 操作系统版本（如 Windows 11 23H2）
- 复现步骤（越具体越好）
- 期望行为 vs 实际行为
- 截图或控制台报错（如有）

请使用仓库自带的 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md)。

## 提出功能建议

请在 Issue 中说明**你要解决的真实问题**，而不是直接给实现方案。本项目定位是
「轻录入、重回看」的个人工具，功能取舍以此为准：

- 录入动作应尽量少点击
- 价值体现在仪表盘 / 日历 / AI 复盘等「回看」场景
- 优先复用成熟开源组件（见 `docs/ARCHITECTURE.md`）

请使用 [功能建议模板](.github/ISSUE_TEMPLATE/feature_request.md)。

## 提交代码

1. Fork 本仓库并创建分支：`git checkout -b feat/your-feature`
2. 修改代码，确保 `npm run check` 零错误零警告
3. 提交（见[提交信息规范](#提交信息规范)）
4. 推送分支并创建 Pull Request，填写 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 内容

小改动（文档错别字、注释）可直接提 PR，无需先开 Issue。

## 开发环境

| 依赖 | 版本要求 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18 LTS（推荐 20+） | 前端构建 |
| Rust | ≥ 1.77（stable-msvc） | Tauri 后端 |
| WebView2 | Windows 10/11 自带 | 运行时 |
| 构建工具链 | MSVC（Visual Studio Build Tools） | 仅编译 Rust 需要 |

```bash
npm install          # 安装前端依赖
npm run check        # 类型检查（svelte-check）
npm run tauri dev    # 开发模式（热更新）
npm run tauri build -- --no-bundle   # 生成免安装可执行文件
```

## 工程约定

这些约定来自项目长期实践，PR 请一并遵守：

1. **前端严格类型**：TypeScript 严格模式，`npm run check` 必须 0 error 0 warning。
2. **组件体积**：单个 Svelte 组件建议 ≤ 300 行，超标请拆分。
3. **数据接缝单一**：所有业务数据读写统一走 `src/stores/app.svelte.ts`（AppState 单例），
   组件不得直接调用文件 API。
4. **路径安全**：前端只能传「相对 data_root 的路径」，绝对路径与 `..` 由 Rust 侧拒绝。
5. **章节级写回**：改写用户 Markdown 文件时，只替换被 UI 修改的章节，其余内容字节级保留，
   保证用户手改的文件不被规范化重排。
6. **异步命令**：Tauri command 一律 `#[tauri::command(async)]`，禁止同步命令阻塞主线程；
   子进程调用在 Windows 上必须带 `CREATE_NO_WINDOW`，避免黑窗闪烁。
7. **不引入重型依赖**：解析 YAML frontmatter 使用自带轻量实现，避免第三方 CJS 包在
   WebView 环境下的模块加载问题。
8. **设计变量集中**：颜色、间距、圆角等设计 token 统一放 `src/tokens.css`，组件不写死色值。
9. **用户数据永不上传**：任何代码路径不得把用户数据写到仓库或外发网络。

## 提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，中文描述即可：

```
feat: 番茄钟支持自定义时长
fix: 修复右键菜单点击冒泡导致删除失效
docs: 补充数据格式说明
refactor: 拆分 Sidebar 文件树子组件
```

类型：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore`。
