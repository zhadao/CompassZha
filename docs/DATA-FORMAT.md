# 数据格式

本项目的全部业务数据都是**普通 Markdown 文件**。没有数据库、没有专有格式、没有加密容器。
本文档是这些文件格式的权威说明——你手写、外部编辑器改写、脚本批处理都可以，
应用会遵守[章节级写回契约](ARCHITECTURE.md#三章节级写回契约)与之共存。

## 一、数据目录总览

```
<data_root>/
├─ config.json                 # 应用配置（见文末）
├─ daily/
│  └─ yyyy/
│     ├─ yyyy-mm-dd.md         # 每日文件
│     └─ star-yyyy-mm-dd.md    # 已收藏的日记（文件名即收藏状态）
├─ life/
│  └─ <板块名>/
│     ├─ <板块名>.md            # 默认文件，frontmatter 的 icon 决定卡片图标
│     └─ <任意名称>.md          # 板块内可自由新增多个文件
├─ corpus/                     # 统一语料库（阶段四 AI 检索使用）
├─ .index/                     # 派生索引，可随时整库重建
└─ .backup/                    # 同步冲突留副本（阶段五）
```

`<data_root>` 默认为 `%USERPROFILE%\CompassZha`（Windows 用户主目录下的 `CompassZha`），可在 `config.json` 的 `data_root` 字段覆盖。

## 二、每日文件

### 2.1 模板

```markdown
---
date: 2026-10-16
type: daily
sleep_hours: null
sleep_quality: null
sleep_bedtime: null
sleep_wake: null
weight_kg: null
spend_total: null
mood: null
focus_minutes: null
steps: null
energy_peak: null
habits: []
goals: []
---

## 日程

## 今日清单

## 临时记录

## 专注记录

## 今日收尾
```

### 2.2 frontmatter 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | 日期 | 该文件对应的日期，与文件名一致 |
| `type` | 字符串 | 固定 `daily` |
| `sleep_hours` | 数字 / null | 睡眠时长（小时） |
| `sleep_quality` | 数字 / null | 睡眠质量自评 |
| `sleep_bedtime` | 字符串 / null | 入睡时间，`"HH:mm"`，**必须加引号**，否则会被 YAML 解析成六十进制整数 |
| `sleep_wake` | 字符串 / null | 起床时间，同上 |
| `weight_kg` | 数字 / null | 体重（公斤） |
| `spend_total` | 数字 / null | 当日支出 |
| `mood` | 数字 / null | 心情自评（1–5） |
| `focus_minutes` | 数字 / null | 当日专注总分钟数，由番茄钟**自动累加** |
| `steps` | 数字 / null | 运动步数 |
| `energy_peak` | 任意 | 精力高峰时段（保留字段，应用不改写） |
| `habits` | 数组 | 习惯打卡（保留字段） |
| `goals` | 数组 | 目标（保留字段） |

> 应用只管理上表中列出的**指标键**；其它任何自定义 frontmatter 字段都会原样保留。
>
> **自定义追踪项**（设置 → 数据追踪 里新建）以 `x_<英文标识>` 为键写入同一份 frontmatter，
> 例如 `x_reading: 40`、`x_wake_mood: 4`、`x_gym: true`、`x_meditate_time: "07:30"`。
> 删掉某个追踪项不会删除已有 `x_` 键——历史数据原样留在文件里，只是不再显示。

### 2.3 章节格式

**`## 日程`** —— 由日历自动维护：

```markdown
- 09:00-10:00 深度工作
- 全天 · 散步
```

- 定时事件：`- HH:mm-HH:mm 标题`
- 全天事件：`- 全天 · 标题`
- 按开始时间排序，全天事件排在最后。

**`## 今日清单`** —— 任务列表：

```markdown
- [x] 写周报 #goal/事业
- [ ] 整理房间
```

- `- [ ]` 未完成，`- [x]`（或 `- [X]`）已完成，勾选状态写回文件。
- 任务可携带 `#goal/<板块名>` 标签：仪表盘的板块投入热力图就是统计这个标签的**提及次数**，
  与任务是否勾选无关——它衡量的是「今天有没有推进这件事」。

**`## 临时记录`** —— 自由文本，写什么都行，应用原样保留。

**`## 专注记录`** —— 由番茄钟自动追加：

```markdown
- 09:05 · 写周报 · 25 分钟 · 倒计时
- 14:20 · 读书 · 25 分钟 · 正计时
```

格式为 `- 开始时刻 · 标题 · N 分钟 · 模式`；每追加一条，frontmatter 的 `focus_minutes`
同步累加。

**`## 今日收尾`** —— 自由文本，用来做当天的小结。

### 2.4 手写容错

解析器容忍以下手写变体，你不必刻意迎合格式：

| 变体 | 是否接受 |
| --- | --- |
| `##日程`（`##` 后无空格） | 接受 |
| 全角空格 | 接受 |
| CRLF 换行 | 接受 |
| `- [X]` 大写完成标记 | 接受 |
| 无法识别的章节 / 行 | 原样保留，不报错、不改动 |
| frontmatter 中的未知字段 | 原样保留 |

### 2.5 收藏

收藏一篇日记 = 把文件**原子改名**为 `star-yyyy-mm-dd.md`（取消收藏则改回）。
收藏状态由文件名派生，因此：重启不丢、无需额外配置、直接用资源管理器改名同样生效。

## 三、人生板块文件

板块 = `life/` 下的**一级子文件夹**；文件夹内的每个 `.md` 文件都是一份独立笔记。

```markdown
---
icon: 💪
---

# 睡眠实验

记录最近的睡眠调整思路……
```

- 默认文件名为 `<板块名>.md`。
- 该默认文件 frontmatter 的 `icon` 字段（可为任意短字符串）决定板块卡片上显示的图标。
- 板块内文件可自由新建 / 重命名 / 删除，应用不做格式约束。

## 四、语料库

`corpus/` 是**统一大库**：不按主题分子目录，任何放进去的 Markdown 都视为语料。
主题（职业与方向、AI 与工具观、金钱、创作与设计、行业判断、价值判断方法、情绪与自我、健康）
只作为检索阶段的**标签路由**，与物理目录结构解绑。

## 五、派生数据

| 目录 | 内容 | 可重建 |
| --- | --- | --- |
| `.index/` | 检索与统计的加速索引 | 是，可整库重建 |
| `.backup/` | 同步冲突时保留的副本 | 不需要重建（仅供人工比对） |

这些目录**不构成数据权威来源**——删掉它们不会丢失任何信息。

## 六、config.json

```json
{
  "version": 6,
  "data_root": "",
  "paths": { "daily": "daily", "life": "life", "corpus": "corpus" },
  "git": { "enabled": false, "branch": "main", "remote": "" },
  "ai": { "provider": "deepseek", "base_url": "https://api.deepseek.com", "model": "deepseek-chat" },
  "ai_companion": { "enabled": false, "kind": "solomd" },
  "calendar": { "slot_min": "06:00", "slot_max": "24:00", "px_per_hour": 175,
                "ticks": { "every_hours": 1, "times": [] } },
  "ui": { "detail_by_section": { "today": true }, "calendar_daily_visible": true,
          "calendar_view_mode": "timeline", "chat_guide_seen": false },
  "trackers": [],
  "briefing": { "enabled": false, "weekday": 0, "time": "20:00", "last_shown": null },
  "corpus_topics": [
    { "id": "career", "name": "职业与方向" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `data_root` | 数据根目录覆盖值；仅在**默认根目录**的 `config.json` 中读取，用于把数据挪到别处（留空 = 用默认根目录） |
| `paths` | 三个业务目录相对根目录的名称 |
| `git.enabled` / `git.remote` | 远端推送开关与地址（阶段五启用；默认关闭且不推送） |
| `ai.*` | AI 服务的接口地址与模型名 |
| `calendar.*` | 日历时间范围（`slot_min` / `slot_max`）、时间轴缩放（`px_per_hour`）与刻度线（`every_hours` / `times`） |
| `ui.*` | 右栏详情按分区记忆、日历左侧日程栏显隐、日历视图（`timeline` / `todo`）、隆中对首开引导是否已看过 |
| `trackers` | 自定义追踪项数组（`key` 为 `x_<slug>`，含 `name` / `unit` / `kind` / `hidden` 等）；缺省 = 只有内置九项 |
| `briefing.*` | 每周罗盘简报：`enabled`、`weekday`（周日 = 0 … 周六 = 6）、`time`（HH:mm）、`last_shown`（上次弹出时刻，用于错过补发） |
| `corpus_topics` | 语料检索的主题标签表 |

> **安全约定**：任何 API Key、令牌、密码都**不会**写入 `config.json`，也不会进入 git 仓库——
> 它们只保存在操作系统的密钥链中。

## 七、让 AI 读你的数据

因为一切都是 Markdown，你可以直接把文件（或整个 `daily/` 目录）交给任意 AI，例如：

> 这是我近 30 天的 daily 文件。请分析我的睡眠时长、入睡时间与专注时长的关系，
> 指出最明显的三个问题，并给出下周可执行的三条调整建议。

不需要导出、不需要 API、不需要格式转换。
