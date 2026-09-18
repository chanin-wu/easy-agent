# Easy Agent 学习指南(Agent 新手版)

> 适用读者:会 Node.js / TypeScript,但第一次接触 "AI Agent" 概念,想通过阅读本项目源码学会"如何从零构建一个 Coding Agent"。

---

## 目录

1. [什么是 Coding Agent](#1-什么是-coding-agent)
2. [本项目的核心概念速查表](#2-本项目的核心概念速查表)
3. [最重要的发现:step/ 目录就是官方教程](#3-最重要的发现-step-目录就是官方教程)
4. [五层架构总览](#4-五层架构总览)
5. [推荐学习路线(4 个阶段)](#5-推荐学习路线4-个阶段)
6. [核心源码阅读顺序(带文件链接)](#6-核心源码阅读顺序带文件链接)
7. [动手实验:调试与验证](#7-动手实验调试与验证)
8. [毕业设计:自己写一个迷你 Agent](#8-毕业设计自己写一个迷你-agent)
9. [常见困惑 FAQ](#9-常见困惑-faq)

---

## 1. 什么是 Coding Agent

一句话:**Agent = 大模型 + 工具 + 循环**。

普通聊天机器人只会"说";Agent 会"做"。它的工作方式是一个循环:

```
用户提问
  → 把对话历史 + 可用工具清单 发给大模型
  → 模型回复:要么直接给答案(结束),要么说"我要调用 Read 工具读某个文件"
  → 你的代码真正去执行这个工具(读文件/跑命令/改代码)
  → 把执行结果塞回对话,再次发给模型
  → 模型看到结果后继续决策……直到它认为任务完成
```

这个循环就叫 **Agentic Loop(智能体循环)**。本项目里它的实现只有几十行核心逻辑,在 [step/step4.js](./step/step4.js)(教学版)和 [src/core/agenticLoop.ts](./src/core/agenticLoop.ts)(生产版)——两者骨架完全一样,先读前者。

**为什么需要循环?** 因为大模型本身是无状态的:它不能真的读文件、跑命令。它只能在回复里输出一种特殊结构(`tool_use`),意思是"请帮我调用 X 工具,参数是 Y"。你的程序负责替它执行,再把结果(`tool_result`)喂回去。模型看到结果后继续下一步——就像你雇了一个只能靠"递纸条"指挥助理的专家。

---

## 2. 本项目的核心概念速查表

| 概念 | 英文 | 一句话解释 | 在哪看 |
|---|---|---|---|
| 消息 | Message | 对话的基本单位:`{role, content}`,content 是内容块数组 | [src/types/message.ts](./src/types/message.ts) |
| 内容块 | Content Block | 模型回复的片段类型:`text`(文字)、`tool_use`(要调工具)、`tool_result`(工具结果)、`thinking`(思考过程) | [step/step1.js](./step/step1.js) |
| 工具 | Tool | 一个对象:`name + description + inputSchema + call()`。description 会进 prompt,让模型知道"有什么能用" | [src/tools/Tool.ts](./src/tools/Tool.ts) |
| 流式输出 | Streaming | 模型逐 token 吐字,SSE 事件一段段到达;你要边收边渲染、最后拼装完整消息 | [src/services/api/streaming.ts](./src/services/api/streaming.ts) |
| 停止原因 | stopReason | 模型说停的类型:`end_turn`(答完了)/ `tool_use`(要用工具)——循环的分支开关 | [step/step4.js](./step/step4.js#L74) |
| 系统提示词 | System Prompt | 每次请求最前面注入的"人设+规则"长文本,决定 Agent 的行为风格 | [src/context/systemPrompt.ts](./src/context/systemPrompt.ts) |
| 上下文窗口 | Context Window | 模型一次能看的 token 上限;超了就要压缩(compaction) | [src/context/compaction.ts](./src/context/compaction.ts) |
| 权限模式 | Permission Mode | `default`(每次问)/ `plan`(只读)/ `auto`(AI 分类器决定) | [src/permissions/permissions.ts](./src/permissions/permissions.ts) |
| 子代理 | Sub-Agent | Agent 派生另一个 Agent 干子任务(独立对话、共享工具) | [src/agents/runAgent.ts](./src/agents/runAgent.ts) |
| MCP | Model Context Protocol | 一种标准协议,让外部进程给 Agent 提供工具(插件生态) | [src/services/mcp/](./src/services/mcp/) |
| Skill | 技能 | 一段按需加载的 Markdown 教程,教 Agent 做特定任务 | [src/services/skills/](./src/services/skills/) |
| 模型 Profile | 模型档案 | 具名的"协议+模型名+端点+密钥"组合,支持多家供应商 | [src/services/api/providers/profile.ts](./src/services/api/providers/profile.ts) |

---

## 3. 最重要的发现:step/ 目录就是官方教程

摸不着头脑很正常——`src/` 有 200+ 个文件、37 个功能阶段。但作者已经把学习路径铺好了:

**`step/step1.js` ~ `step/step36.js` 是同一项目的 36 个"渐进式快照"。** 每个文件只依赖前面的文件,每个阶段只加一个概念:

| 快照 | 教什么 | 必读程度 |
|---|---|---|
| step1 | 最小流式 LLM 客户端(消息、内容块、SSE 事件拼装) | ★★★ 核心 |
| step2 | React/Ink 终端 UI(用 JSX 写命令行界面) | ★★ |
| step3 | Tool 接口 + 第一个工具 | ★★★ 核心 |
| step4 | **Agentic Loop(全文最重要的 90 行)** | ★★★ 灵魂 |
| step5 | 完整核心工具集(Read/Write/Edit/Bash/Glob/Grep) | ★★ |
| step6 | System Prompt 与上下文工程 | ★★ |
| step7 | 权限系统(allow/deny/ask 规则) | ★★ |
| step8 | QueryEngine 多轮编排 | ★★ |
| step9-12 | 会话持久化 / 记忆 / 上下文压缩 / token 预算 | ★ |
| step13-15 | Plan Mode / TodoWrite / 任务图 | ★ |
| step16-17 | MCP / Skills | ★ |
| step18 | Sandbox 沙箱 | ★ |
| step19-21 | Sub-Agent / 后台执行 / Agent Teams | ★★(进阶重点) |
| step22-36 | Hooks、UI 打磨、韧性、多 Provider、插件…… | 按需 |

**读 stepN.js 的方法**:先自己猜"这一步该怎么实现",再看代码对答案;然后到 `src/` 里找对应模块,对比"教学版 vs 生产版"多了什么(通常多的是错误处理、边界情况、安全加固)。这个对比本身就是最好的工程课。

---

## 4. 五层架构总览

README 里的架构图,对应到具体目录:

```text
┌─────────────────────────────────────────────────┐
│ ① 终端 UI          src/ui/        (Ink + React) │  你看到的界面
├─────────────────────────────────────────────────┤
│ ② QueryEngine      src/core/queryEngine.ts      │  一次会话的"总调度"
│    管理:模型切换/权限模式/会话历史/斜杠命令       │
├─────────────────────────────────────────────────┤
│ ③ Agentic Loop     src/core/agenticLoop.ts      │  推理→工具→观察 循环
├─────────────────────────────────────────────────┤
│ ④ 工具 + 权限      src/tools/ src/permissions/   │  真正"做事"的地方
├─────────────────────────────────────────────────┤
│ ⑤ Provider API     src/services/api/             │  与模型通信(流式/重试/翻译)
│    anthropic 原生 + openai/gemini 协议转换        │
└─────────────────────────────────────────────────┘
     入口:src/entrypoint/cli.ts(交互)/ headless.ts(-p 模式)
     配置:src/config/ + src/utils/loadEnv.ts(.env 与 settings.json 合并链)
```

一次提问的数据流(建议对照这个流程读代码):

```
用户在 InputPrompt 敲回车
 → useAgentSession 提交给 QueryEngine.submitMessage()
 → QueryEngine 组装 messages + systemPrompt + tools,调用 runAgenticLoop()
 → 循环:streamMessage() 发请求 → 收流事件 → UI 实时渲染
    → 模型要工具? checkPermission() 决定放行/询问/拒绝
    → 放行则 tool.call() 执行 → tool_result 塞回 messages → 下一轮
    → 模型不要工具? stopReason=end_turn,循环结束
 → 会话写入 ~/.easy-agent/projects/...(jsonl 格式,可 --resume 恢复)
```

---

## 5. 推荐学习路线(4 个阶段)

### 阶段 0:跑起来(半天)

先当用户,不当读者。配置好 `.env` 和 `~/.easy-agent/settings.json`(你已完成),然后:

```bash
npm install
npm run dev                 # 启动交互式 REPL
npm run dev -- -p "这个仓库是干什么的"   # headless 模式
```

在 REPL 里体验并观察:`/status`(看当前模型来源)、`/context`(看上下文占用)、`/permissions`、随便让它读改一个文件(观察权限弹窗和工具卡片渲染)。**先建立"它应该是什么样"的直觉,再去看代码。**

### 阶段 1:核心循环(2~3 天)

只读 4 个文件,顺序如下,每个都要能复述逻辑:

1. [step/step1.js](./step/step1.js) — 理解消息/内容块/流式拼装
2. [step/step3.js](./step/step3.js) — 理解 Tool 接口
3. [step/step4.js](./step/step4.js) — 理解 Agentic Loop(**全文最重要**)
4. [step/step7.js](./step/step7.js) — 理解权限拦截发生在哪一步

自测标准:能回答"模型回复 `stopReason=tool_use` 时,代码里发生了什么?结果以什么格式回到 `messages` 数组?"

### 阶段 2:生产实现对照(1~2 周)

对每个教学版,找到 `src/` 里的生产版,列出"多了什么":

| 教学版 | 生产版 | 生产版多出的关键点 |
|---|---|---|
| step1.js | [streaming.ts](./src/services/api/streaming.ts) | 重试/退避、错误分类、thinking 参数、max_tokens 升级恢复 |
| step4.js | [agenticLoop.ts](./src/core/agenticLoop.ts) | Hooks、自动压缩、token 预警、文件历史快照 |
| step8.js | [queryEngine.ts](./src/core/queryEngine.ts) | 斜杠命令、模型热切换、子代理上下文注入 |
| step10-11 | [src/context/](./src/context/) | 记忆检索、compaction 摘要策略 |

### 阶段 3:专题深入(按需)

- **想学 UI**:`step/step2.js` → `src/ui/App.tsx` → `MessageList.tsx`(Ink 布局、虚拟滚动)
- **想学多模型适配**:`step/step30.js` → [providerStream.ts](./src/services/api/providers/providerStream.ts)(协议翻译在边缘完成,上层只认 Anthropic 事件流)
- **想学多 Agent 协作**:`step/step19.js` → `src/agents/runAgent.ts` → `src/tools/agentTool.ts` → step21(Agent Teams)
- **想学安全**:`step/step18.js`(沙箱)+ `src/permissions/autoClassifier.ts`(用另一个 LLM 判断危险操作)

---

## 6. 核心源码阅读顺序(带文件链接)

完整精读清单(约 20 个文件,按此顺序):

```
入口与配置
  1. src/entrypoint/cli.ts            — 参数解析、设置链、启动 Ink
  2. src/utils/loadEnv.ts             — .env 与 settings.json 的优先级
  3. src/config/sources.ts            — 五层设置源合并(user→project→local→flag→policy)

API 层
  4. src/services/api/client.ts       — Anthropic SDK 单例 + per-profile 客户端
  5. src/services/api/streaming.ts    — streamOnce / streamMessage(重试外壳)
  6. src/services/api/errors.ts       — 错误分类(你上次遇到的 404→model_not_found 就在这)
  7. src/services/api/providers/profile.ts       — 模型档案解析
  8. src/services/api/providers/providerStream.ts — OpenAI/Gemini 协议翻译

循环与编排
  9.  src/core/agenticLoop.ts         — 核心循环
  10. src/core/queryEngine.ts         — 会话总调度
  11. src/context/systemPrompt.ts     — 系统提示词组装

工具与权限
  12. src/tools/Tool.ts               — 工具接口
  13. src/tools/index.ts              — 工具注册表
  14. src/tools/fileReadTool.ts       — 最简单的读工具,精读
  15. src/tools/fileEditTool.ts       — 编辑工具(old_string/new_string 匹配逻辑)
  16. src/tools/bashTool.ts           — shell 执行 + 流式输出
  17. src/permissions/permissions.ts  — allow/deny/ask 规则引擎

上下文管理
  18. src/context/compaction.ts       — 对话摘要压缩
  19. src/session/storage.ts          — jsonl 会话持久化

UI(了解即可)
  20. src/ui/hooks/useAgentSession.ts — UI 与引擎的胶水层
```

阅读技巧:
- 本项目注释密度极高,大量注释直接写明"Reference: claude-code-source-code/..."(参考 Claude Code 源码)和"Stage N:..."(哪个阶段引入的)。**跟着注释里的 Stage 编号回 `step/` 找教学版,是最省力的理解方式。**
- 用 `npm run typecheck` 确认没改坏;用 IDE 的"查找引用"从入口顺着调用链走,不要随机翻文件。

---

## 7. 动手实验:调试与验证

### 7.1 打印真实请求(强烈推荐)

在 [step/step4.js](./step/step4.js) 的 `query()` 里加一行日志,亲眼看 `messages` 数组如何随轮次增长:

```js
console.error("[debug] turn", state.turnCount, JSON.stringify(state.messages, null, 2).slice(0, 2000));
```

然后写一个 10 行脚本调用它,问一个需要两步工具的问题(如"读 package.json 并告诉我版本号"),观察:第 1 轮模型发出 `tool_use` → 第 2 轮收到 `tool_result` → 输出答案 → `end_turn`。**看完这一次,Agent 的原理就通了。**

### 7.2 用测试脚本当"可执行文档"

`package.json` 里的 test 脚本都是不用搭环境就能跑的活教材:

```bash
npm run test:streaming      # 流式层怎么工作(需要 API key)
npm run test:tools          # 工具注册与调用
npm run test:agents         # 子代理系统
npm run test:stage30        # 多协议 Provider 验证
npm run test:resilience     # 错误分类与重试(纯逻辑,不需要 key)
```

### 7.3 自己加一个工具(最好的检验)

在 `src/tools/` 新建一个 `wordCountTool.ts`(输入文件路径,返回字数),在 [src/tools/index.ts](./src/tools/index.ts) 注册,重启 REPL 让 Agent 用它。能做完这一步,说明 Tool 接口、注册表、权限、循环全打通了。照着最简单的 [fileReadTool.ts](./src/tools/fileReadTool.ts) 抄结构即可。

### 7.4 调试疑难行为

- `/doctor`、`/status`、`/config list` 先看配置最终生效值
- 想看发给模型的原始流:`src/utils/streamDebug.ts` 提供了 debug 输出开关
- 上次那个 "model gpt not found" 就是典型案例:错误消息里的名字是**handle**不是真实模型,顺着 `resolveProfile → streamViaProvider → errors.ts` 三层就能定位

---

## 8. 毕业设计:自己写一个迷你 Agent

学完阶段 1 后,合上本项目,从零实现一个 150 行的迷你版(`my-agent.js` 单文件即可):

**需求(按此顺序实现,每步都可运行):**

1. 读 `.env` 拿到 key,封装一个 `streamMessage(messages)`(参考 step1)
2. 实现 `read_file` 和 `write_file` 两个工具,转成 Anthropic 的 tools JSON Schema(参考 step3)
3. 写 agentic loop:`while` 调模型 → 有 `tool_use` 就执行并回传 → 没有就退出(参考 step4)
4. 加一个 `bash` 工具 + 执行前 y/n 确认(参考 step7)
5. 加分支:未知工具返回 `is_error: true` 的 tool_result 而不是崩溃(模型会自我纠正——这是 Agent 韧性的第一课)

**验收标准**:问它"帮我在 tmp 目录建一个 hello.txt 写入 hi,然后 cat 出来",它能自主完成 3 步工具调用。做到这一步,你已经比"会用 Claude Code"更进一步——你理解了它。

然后再回看 `src/` 的 200 个文件,你会发现它们全是围绕这 5 步的"加固":重试、压缩、持久化、沙箱、多协议、子代理、插件。**架构不再神秘,只是需求堆叠的必然结果。**

---

## 9. 常见困惑 FAQ

**Q1: 为什么 `src/` 和 `step/` 有两套代码?**
`step/` 是教学快照(单文件、无错误处理、只讲原理),`src/` 是生产实现。学习读 `step/`,工程读 `src/`。

**Q2: 模型怎么"知道"有哪些工具可用?**
每次请求都把工具的 `name/description/inputSchema` 序列化进 `tools` 字段发给模型。所以 description 写得好坏,直接决定模型会不会用、用得对不对——这就是"上下文工程"的一部分。

**Q3: tool_result 为什么 role 是 "user"?**
Anthropic 协议规定工具结果作为 user 侧消息回传(见 [step/step4.js](./step/step4.js#L40))。可以理解为"环境替用户转述工具的输出"。

**Q4: 上下文超了怎么办?**
两条路:自动压缩([compaction.ts](./src/context/compaction.ts) 用模型把旧对话摘要成一段文本)和 token 预警拦截([autoCompact.ts](./src/context/autoCompact.ts))。这是长任务 Agent 的必修课。

**Q5: 权限检查插在循环的哪一步?**
模型发出 `tool_use` 之后、真正 `call()` 之前。规则引擎先判(allow/deny 列表),判不了才弹交互询问;auto 模式则交给一个分类器小模型决定。

**Q6: 多模型(OpenAI/Gemini)是怎么兼容的?**
上层永远只说 Anthropic 的"方言";[providerStream.ts](./src/services/api/providers/providerStream.ts) 在最底层把请求翻译成各家协议、再把各家流翻译回 Anthropic 事件格式。翻译只发生在边缘——一个非常干净的多协议架构范例。

**Q7: 我需要先学 React/Ink 吗?**
不需要。UI 是壳,循环是核。先学完阶段 1 再回头看 UI。

**Q8: 这个项目参考了什么?**
代码注释多处标注参考 Claude Code 源码;README 的 37 阶段路线图就是它的构建顺序。理解了"阶段 N 解决什么问题",就理解了每个模块存在的理由。

---

## 附:一周速成日程参考

| 天 | 内容 |
|---|---|
| D1 | 当用户跑通 REPL + 读 README 路线图 + 精读 step1 |
| D2 | 精读 step3 + step4,做 7.1 的日志实验 |
| D3 | 读 step7 + 生产版对照(agenticLoop.ts / streaming.ts / errors.ts) |
| D4 | 读 queryEngine + systemPrompt + 工具注册表 |
| D5 | 读 compaction + session 持久化;跑 test:resilience |
| D6 | 做 7.3(自己加一个工具) |
| D7 | 做第 8 节毕业设计;回顾 src/ 全貌 |
