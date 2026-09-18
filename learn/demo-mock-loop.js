/**
 * 学习用:用"模拟模型"驱动 agentic loop 骨架
 *
 * 用法: node learn/demo-mock-loop.js
 *
 * 与 step/step4.js 的骨架完全同构,唯一区别:
 *   - 真实版:  streamMessage() 连真实模型(Anthropic 协议)
 *   - 本文件:  fakeModel.respond() 按剧本返回内容(第1轮要工具、第2轮给答案)
 *
 * 好处: 0 费用、0 网络、每次运行结果一模一样 —— 可以反复观察
 * "模型回复 → 执行工具 → 回传结果 → 再问 → 结束"这个循环本身。
 */
import { readTool } from "../step/step3.js";

// ---- 工具注册(和生产版同构:name + description + inputSchema + call) ----
const tools = [readTool];

function getToolsApiParams() {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

// ---- 模拟模型:有剧本的状态机 ----
// 第 1 轮: 回复 tool_use(要调用 Read 读 package.json)
// 第 2 轮: 回复 text(看到 tool_result 后的"最终答案")
const fakeModel = {
  turn: 0,
  async *respond() {
    this.turn += 1;
    if (this.turn === 1) {
      yield { type: "message_start", messageId: "mock-msg-1" };
      yield { type: "tool_use_start", id: "toolu_mock_1", name: "Read" };
      yield {
        type: "message_done",
        stopReason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      return {
        assistantMessage: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_mock_1", name: "Read", input: { file_path: "package.json", limit: 5 } },
          ],
        },
        usage: { input_tokens: 10, output_tokens: 5 },
        stopReason: "tool_use",
      };
    }
    yield { type: "message_start", messageId: "mock-msg-2" };
    yield {
      type: "message_done",
      stopReason: "end_turn",
      usage: { input_tokens: 20, output_tokens: 6 },
    };
    return {
      assistantMessage: {
        role: "assistant",
        content: [
          { type: "text", text: "（模拟模型）我看到了 tool_result，这是最终答案。注意:真实模型的 text 也会像这样作为 assistant 消息返回。" },
        ],
      },
      usage: { input_tokens: 20, output_tokens: 6 },
      stopReason: "end_turn",
    };
  },
};

// ---- agentic loop 骨架(与 step/step4.js 的 query() 同构) ----
async function runTools(contentBlocks, toolContext) {
  const results = [];
  for (const block of contentBlocks) {
    if (block.type !== "tool_use") continue;
    const tool = tools.find((t) => t.name === block.name);
    const result = tool
      ? await tool.call(block.input, toolContext)
      : { content: `Error: unknown tool ${block.name}`, isError: true };
    results.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: result.content,
      ...(result.isError ? { is_error: true } : {}),
    });
  }
  return { role: "user", content: results }; // ← 注意:工具结果用 role=user 回传!
}

const state = { messages: [{ role: "user", content: "读 package.json 告诉我 version" }], turnCount: 0 };

while (state.turnCount < 3) {
  state.turnCount += 1;
  console.log(`\n════════ 第 ${state.turnCount} 轮:发给模型的消息数组 messages ════════`);
  console.log(state.messages.map((m) => `  [${m.role}] ${JSON.stringify(m.content).slice(0, 120)}`).join("\n"));
  console.log("  ↑ 注意每轮发给模型的内容 = 上一轮结束后的完整 messages 数组");

  // 注意:respond 是 async generator,必须像 step4.js 那样逐事件消费,
  // 迭代结束后才能拿到最终组装好的 result(assistantMessage + stopReason)。
  const stream = fakeModel.respond(state.messages, getToolsApiParams());
  let result;
  while (true) {
    const { value, done } = await stream.next();
    if (done) {
      result = value;
      break;
    }
  }
  state.messages.push(result.assistantMessage);
  console.log(`\n  ← 模型回复 stopReason = ${result.stopReason}`);

  if (result.stopReason !== "tool_use") {
    console.log(`  ← end_turn:模型认为任务完成,循环结束 ✓`);
    break;
  }

  const toolResultMessage = await runTools(result.assistantMessage.content, { cwd: process.cwd() });
  state.messages.push(toolResultMessage);
  console.log(`  ← 循环继续:执行工具并把结果回传……`);
  for (const block of toolResultMessage.content) {
    console.log(`     [tool_result] ${String(block.content).replace(/\n/g, " ").slice(0, 140)}`);
  }
}

console.log(`\n────────────────────────`);
console.log(`循环结束:共 ${state.turnCount} 轮,messages 最终有 ${state.messages.length} 条消息`);
console.log("消息构成: " + state.messages.map((m) => m.role).join(" -> "));