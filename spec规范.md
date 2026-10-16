# CompassZha spec 规范（新技术选型与可行性评估）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.4 |
| 创建日期 | 2026-10-15 |
| 最后更新 | 2026-10-16（v1.4：红线区新增 SPEC-107——Tauri command 必须 async 化；实测同步 `git_auto_commit` 每次保存冻结主线程秒级致窗口「未响应」） |
| 文档性质 | 本项目技术选型、可行性评估与改动规范的**唯一权威来源**；与《CompassZha-总需求文档-v4.0.md》配套使用 |
| 效力 | 对所有写代码的人（用户 + AI Agent）具有强制约束力；违反红线 = 无条件返工 |
| 变更规则 | 先改本文档并升版本号，再改代码；禁止代码先行文档后补 |

---

# 1. 选型结论（最终决策，2026-10-15 用户批准）

## 1.1 路线：B 为主体 + C 兜底

**主体（路线 B）**：以已有原型代码库（`归档/prototype验证原型/`，Tauri 2 + Svelte 5，已通过门禁验证）为基础继续开发（阶段 1 已整体迁入 `工程/主工程compass/`），其中 Markdown 编辑器由 CodeMirror 6 升级为成熟成品 **@milkdown/crepe**（MIT，即插即用所见即所得）。

**兜底（路线 C 的轻量版）**：AI 对话 / 语料检索层不自研，直接安装 **SoloMD** 成品（MIT，Tauri 2）指向同一 Markdown 数据目录，复用其 Agent Panel、本地 RAG、MCP/REST API。阶段 4 再评估「继续用 SoloMD vs 自研 RAG」。

**否决项**：fork 任何大编辑器项目（SoloMD/nomo/MarkFlowy/markra）作代码基底 —— 日历/仪表盘/番茄钟/录入在任何基底上都要自己写，而 fork 意味着在陌生大代码库（Vue、69MB、上游漂移）里重写我们已在 Svelte 中验证过的功能，工作量与风险双高。

## 1.2 技术栈总表

| 层级 | 选型 | 协议 | 说明 |
| --- | --- | --- | --- |
| 桌面壳 | Tauri 2 | MIT/Apache | Rust + WebView2，安装包目标 <15MB（不含模型） |
| 前端框架 | Svelte 5（runes）+ Vite + TypeScript 严格模式 | MIT | 已有原型同栈，AI 辅助生成质量高 |
| Markdown 编辑器 | @milkdown/crepe v7.22.3（**阶段 2 已接入**：GUI/编辑器双模式，2026-10-16 WebView 探针验证） | MIT | 即插即用 WYSIWYG，自带表格/LaTeX/代码块/工具栏/图片块；CodeMirror 6 保底方案已取消 |
| 日历组件 | FullCalendar v6 | MIT | 已在原型接入并验证 |
| 图表组件 | Apache ECharts | Apache-2.0 | 已在原型接入并验证 |
| Markdown/frontmatter 解析 | 手写 YAML-lite（`src/lib/markdown.ts`，标量/null/引号串/流式数组/注释；纯 ESM 无 Node 依赖） | 项目自有（MIT） | gray-matter 在 Tauri WebView 中崩溃后替代（2026-10-16 实证） |
| 本地索引 | SQLite（派生数据，阶段 3 启用） | 公有领域 | 可整库删除重建 |
| 同步 | 系统 git CLI（阶段 5） | — | 不引 Git 库，直接 shell 调用 |
| AI 对话/语料层 | SoloMD 成品应用（阶段 4 评估）；自研兜底为 transformers.js + bge-small-zh-v1.5 + DeepSeek API | MIT / Apache-2.0 | 同一数据目录，不耦合主体代码 |
| UI 风格基准 | usememos/memos（浅色卡片化、左侧竖导航，主色 #2563eb） | — | tokens.css 已定稿 |

---

# 2. 可行性评估（全部经实证，2026-10-15）

## 2.1 基底候选评估表

| 候选 | 协议 | 技术栈 | 实证事实 | 结论 |
| --- | --- | --- | --- | --- |
| zditor/zditor-docs | 文档仓（应用闭源） | Tauri 2（应用本体） | 公开仓只有文档 + skills；build 工作流（`.github/workflows/build_app.yml`）用 `secrets.REPO` 拉私有源码；本机已装 release（`%APPDATA%\com.zditor.ai`） | ❌ 闭源无法二开；可作日常写作工具保留 |
| nomo-md/nomo | AGPL-3.0 | Tauri 2 + Svelte 5 | 267★，2026-05 创建（极年轻）；栈与本项目完全一致 | ❌ AGPL 传染，与 MIT 开源目标冲突；可作代码参考样本（可读不可抄） |
| drl990114/MarkFlowy | AGPL-3.0 | Tauri + React | 2398★，活跃 | ❌ 协议冲突 |
| markrahq/markra | AGPL-3.0 | Tauri + React | 917★，WYSIWYG + native AI | ❌ 协议冲突 |
| zhitongblog/solomd | **MIT** | Tauri 2 + Vue | 1252★/85 forks，活跃；自带 Agent Panel（14 家 BYOK 含 DeepSeek、密钥入系统密钥链）、本地 RAG、AutoGit、GitHub 私密仓同步（可选 E2EE）、bundled MCP server（16 工具，默认只读）+ localhost REST API、scheduled recipes | ✅ 不 fork，作阶段 4 AI 对话层成品组件 |
| Milkdown/milkdown（@milkdown/crepe） | **MIT** | ProseMirror 内核 | v7.22.3 活跃维护；即插即用 WYSIWYG；feature/latex、table、toolbar、code-mirror、image-block、link-tooltip | ✅ 作编辑器组件（阶段 2） |

**证据可复核**：GitHub 仓库主页 / `api.github.com/repos/<owner>/<repo>` / npm registry `@milkdown/crepe`。

## 2.2 关键可行性结论

1. **「以大的开源编辑器为基底改动更小」不成立**：日历（FullCalendar 式）、仪表盘（ECharts）、番茄钟、量化录入这四块没有任何开源 Markdown 编辑器自带，选谁都要自己写；而原型中这四块已写好并通过 22 项断言验证。基底只能省「编辑器/文件树/同步/AI 对话」，其中编辑器用 Crepe 组件即可解决，AI 对话用 SoloMD 成品解决。
2. **许可证可行性**：最终栈全部 MIT/Apache-2.0/公有领域，项目可如期以 MIT 开源。
3. **环境可行性**：本机 Node v24.12.0、Rust 1.99.0（`%USERPROFILE%\.cargo\bin`）、git 2.55 均已实证在位；pnpm 未装但 corepack 一键可装（仅 SoloMD 源码场景才需要，主体开发用 npm）。
4. **功能可行性**：FullCalendar/ECharts 在原型中已实证可运行；Crepe 为框架无关挂载（Svelte 中 vanilla mount 即可）；SoloMD 的 MCP 默认只读，指向同一数据目录无写冲突风险（写操作需 `--allow-write` 显式开启，阶段 4 再决策）。

## 2.3 旧版失败复盘（本次选型的直接依据）

旧版烂尾**不是功能代码烂**（svelte-check 0 错 0 警、22 项断言全过、npm 0 漏洞），而是环境与启动链路：依赖与构建产物整体丢失、用户桌面无可双击入口、AI 会话后台进程非常驻、Tauri dev 被沙箱拦截、浏览器自动化验证全线不可用。全部教训已浓缩进《Agent工作日志.md》环境速查表与本规范 §3.3 环境红线。

---

# 3. 改动规范（红线）

## 3.1 旧红线处置（v3.1 SPEC-001~012 逐条状态）

| 旧规范 | 内容摘要 | 状态 | 备注 |
| --- | --- | --- | --- |
| SPEC-001 | 用户数据全 Markdown | **继承** | 项目核心原则不变 |
| SPEC-002 | .index/.backup 不进 Git | **继承** | |
| SPEC-003 | frontmatter 变更同步索引 schema 并整库重建 | **继承** | 阶段 3 生效 |
| SPEC-004 | AI 生成内容必须标注来源 | **继承** | 阶段 4 生效 |
| SPEC-005 | RAG 库内判断/网络事实双通道 | **继承** | 阶段 4 生效 |
| SPEC-006 | v1 禁止向量嵌入依赖 | **修订** | 阶段 4 若用 SoloMD 则其内置 RAG、本项目零嵌入依赖；仅当阶段 4 评估自研时才允许引入 transformers.js |
| SPEC-007 | 同步失败本地保留副本 | **继承** | 阶段 5 生效 |
| SPEC-008 | 外部 API 必须超时重试 | **继承** | |
| SPEC-009 | 原型阶段禁止接真数据 | **废止** | 原型期已结束；新路线直接在真数据上小步前进 |
| SPEC-010 | 阶段门禁 | **继承** | 阶段编号改为 0~5（见需求 v4.0 §4） |
| SPEC-011 | mock 集中管理且与真实 schema 同型 | **继承（修订）** | mock 仅作开发期内部手段，集中 `src/mock/` |
| SPEC-012 | 密钥入系统密钥链 | **继承** | |

## 3.2 新增红线（SPEC-101 ~ 106）

| 规范 ID | 规范内容 | 违反后果 |
| --- | --- | --- |
| SPEC-101 | 禁止 fork AGPL/GPL 项目作为代码基底；新增依赖只许 MIT / Apache-2.0 / BSD / ISC / 公有领域，引入前必须查 license 并登记到本文档 §1.2 | MIT 开源目标被破坏 |
| SPEC-102 | 禁止自造已有成熟 MIT 成品的轮子（编辑器/日历/图表/Markdown 解析）；确需自造须先改本文档说明理由 | 重蹈旧版覆辙 |
| SPEC-103 | 先改文档再改代码：需求或规范变更，先改《总需求 v4.0》或本文档，再动代码 | 文档失真、返工 |
| SPEC-104 | 每次 Agent 任务（agent spec / agent plan / 任何让 AI 改代码或文档的任务）结束后，必须在《Agent工作日志.md》顶部追加规定格式的记录 | Agent 接力断链、重复踩坑 |
| SPEC-105 | 任何可交付状态必须提供用户可双击的启动入口（bat / 安装包）；禁止「只有 AI 会话后台进程能跑」的交付 | 旧版「项目打不开」复发 |
| SPEC-106 | 依赖与构建产物丢失应急预案常备：`package-lock.json` 必须提交 Git；恢复步骤（npm install → build → 启动）写入《Agent工作日志.md》环境速查表 | 旧版「依赖丢失瘫痪」复发 |
| SPEC-107 | **Tauri command 必须 `#[tauri::command(async)]`**：同步 command 在 WebView 主线程执行，任何含 IO/子进程的 command（如 `git_auto_commit` 串行等待 4 个 git 子进程）都会冻结窗口秒级致「未响应」；新写 command 一律 async，存量同步化 | 窗口「未响应」、体验不可接受 |

## 3.3 环境红线（旧版血泪登记）

| 项 | 规则 |
| --- | --- |
| cargo 联网 | 必须显式 `CARGO_HTTP_PROXY=http://127.0.0.1:17890`（系统代理为 mixed 端口） |
| git 代理 | 全局代理曾指向死端口 7897 导致 git 网络操作失败；任何 git 网络报错先查 `git config --global --get http.proxy` |
| PATH | 新 shell 需确认 `%USERPROFILE%\.cargo\bin` 在 PATH 中 |
| 验证通道 | 本机 AI 侧浏览器自动化全线受限（Edge 无头被沙箱拦截、browser_use 超时、Chrome 未装）；运行时验证以用户实机走查为准，AI 侧只做 HTTP 层与静态检查 |
| Tauri dev | 沙箱会拦截 Tauri 运行时创建应用数据目录；需非沙箱模式运行 |

## 3.4 代码/测试/UI 规范（继承 v3.1，不变）

- CODE-001 TS 严格模式禁 any；CODE-002 异步必须错误处理；CODE-003 组件 ≤300 行超标必拆；CODE-004 禁内联事件；CODE-005 UTF-8 无 BOM；CODE-006 样式只许引用 tokens.css 变量
- TEST-001 核心读写有单测；TEST-002 发布前手验 Git 同步；TEST-003 RAG 溯源测试（阶段 4）；TEST-004 mock/真实回归对照
- UI-001 三栏固定禁拖拽面板；UI-002 分区必须侧边栏注册；UI-003 操作三态反馈；UI-004 表单字段与 frontmatter 一一对应；UI-005 空态引导；UI-006（废止：原型期角标规则随 SPEC-009 一同废止）

---

# 4. 旧资产处置（位置按 v4.8 工作空间重整更新）

| 资产 | 位置 | 处置 |
| --- | --- | --- |
| 旧原型 `prototype验证原型/` | `归档/prototype验证原型/` | 归档只读；内容已被阶段一~三完全取代，不再改动 |
| 总需求 v3.1（文件名误标 v3.0） | `归档/旧版本文档/` | 归档不删；被《CompassZha-总需求文档-v4.0.md》取代 |
| Prototype 需求 v1.1（文件名误标 v1.0） | `归档/旧版本文档/` | 归档不删（原型期已结束） |
| 版本更新和提交记录 | `归档/旧版本文档/` | 归档不删；历史记录职能由《Agent工作日志.md》接管 |
| zditor-docs 参考文档 | `归档/参考资料-Zditor/zditor-docs-main/` | 归档保留；Zditor release 可作日常 Markdown 阅读器使用，与本项目无代码耦合 |
| SoloMD | —— | 阶段 4 安装成品并指向本项目数据目录；不 fork、不 vendored |

## 4.1 工作空间结构（2026-10-16 v4.8 重整后，权威）

`D:\Coding\CompassZha\` 本身是**运行时数据根**（`fs_cmds.rs` 的 `DEFAULT_DATA_ROOT` 写死，不可更改），所以根目录只放运行时数据与权威文档；其余开发资产按职能收进三个目录：

```
D:\Coding\CompassZha\
├─ daily\  life\  corpus\  .git\  config.json      ← 运行时数据（应用读写，禁止手工搬迁/重命名）
├─ CompassZha-总需求文档-v4.0.md                    ← 权威需求（根目录常驻）
├─ spec规范.md                                      ← 技术选型与红线（根目录常驻）
├─ Agent工作日志.md                                 ← 接力日志（SPEC-104 强制）
├─ .trae\                                           ← Agent 工作文档（specs / documents）
├─ 工程\主工程compass\                               ← 开发主线：源码 + release\CompassZha.exe
├─ 开源发布\Compass-public\                          ← 已公开于 github.com/zhadao/CompassZha 的副本；日常开发不维护
└─ 归档\                                            ← 已废弃，只读留存
   ├─ prototype验证原型\
   ├─ 旧版本文档\
   └─ 参考资料-Zditor\zditor-docs-main\
```

> 约定：新增开发资产一律进 `工程\` 或 `归档\`，不得再堆在根目录；根目录只允许出现上图中的条目。

---

# 5. 依赖登记册（SPEC-101 强制）

| 依赖 | 版本 | 协议 | 引入阶段 | 状态 |
| --- | --- | --- | --- | --- |
| @fullcalendar/core + daygrid/timegrid/list/interaction | v6.1.x（迁移时统一同版，以 npm 实查为准） | MIT | 已在原型 | 在用 |
| echarts | v5/v6 | Apache-2.0 | 已在原型 | 在用 |
| @codemirror/*（state/view/language + markdown 语言包） | v6 | MIT | 阶段 2（保底编辑器） | **不再引入（2026-10-16）**：Crepe 探针全绿后保底方案取消 |
| @milkdown/crepe + @milkdown/kit | v7.22.3 | MIT | 阶段 2 | **在用（2026-10-16 引入）**：Edge 无头探针验证 WebView 兼容（挂载/可编辑/roundtrip/监听全绿）；7.22 API 实证：无 `setMarkdown`，初始内容走构造参数 `defaultValue`，读取用 `getMarkdown()`，变更监听 `on(api => api.markdownUpdated((ctx, md) => …))`，卸载 `destroy()`；主题路径 `@milkdown/crepe/theme/frame.css`（非 frame/style.css） |
| gray-matter | 4.x | MIT | 阶段 1 | **已移除（2026-10-16）**：曾短暂引入后移除——CJS 内部 `require('fs')` 在 Tauri WebView 浏览器 bundle 加载即崩，整页 JS 失效；替换为 `src/lib/markdown.ts` 手写 YAML-lite（34 项往返自测全过） |
| tauri-plugin-sql（Rust crate，sqlite 特性）+ @tauri-apps/plugin-sql（前端） | 随 Tauri 2 生态 | MIT / Apache-2.0 | 阶段 3 | 待引入（已定，替代原「rusqlite/sql.js 待定」） |
| transformers.js + Xenova/bge-small-zh-v1.5 | — | Apache-2.0 | 阶段 4（仅自研分支） | 备选 |
| svelte / vite / typescript / tauri | 原型已锁定 | MIT | 已在原型 | 在用 |

> 新增任何依赖前：查 license → 登记本表 → 再安装。

---

**文档结束**
