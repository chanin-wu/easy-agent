/**
 * 学习用驱动脚本:跑教学版 Agentic Loop (step/step4.js)
 *
 * 用法:node --env-file=.env learn/demo-step4-loop.js
 *
 * 目的:亲眼观察 agentic loop 的每一轮发生了什么——
 *   - 每轮结束打印 assistant 消息内容(text / tool_use)
 *   - 打印工具执行结果(tool_result)
 *   - 打印 stopReason 这个"循环分支开关"
 *   - 最后打印 messages 数组的总增长
 */
import { query } from '../step/step4.js';

// 教学版 step1.js 只读 ANTHROPIC_AUTH_TOKEN,而 .env 里的 key 存在 OPENAI_API_KEY 下,
// 这里桥接一下(生产版通过 settings.json profile 的 ${OPENAI_API_KEY} 插值解决同一问题)。
process.env.ANTHROPIC_AUTH_TOKEN ||= process.env.OPENAI_API_KEY;

const messages = [
  {
    role: 'user',
    content: '读 package.json 并告诉我里面的 version 字段是多少'
  }
];

const systemPrompt = 'You are a teaching demo agent. Use the Read tool when you need to see a file. Answer in the same language as the user.';

const toolContext = { cwd: process.cwd() };

console.log('===== 初始请求: 只有 1 条 user 消息 =====\n');

const gen = query({ messages, systemPrompt, toolContext, maxTurns: 5 });
let turn = 1;

while (true) {
  const { value, done } = await gen.next();
  if (done) {
    console.log(`\n===== 循环结束 =====`);
    console.log(`  结束原因 reason  : ${value.reason}`);
    console.log(`  共执行多少轮     : ${value.state.turnCount}`);
    console.log(`  token 用量       : ${JSON.stringify(value.usage)}`);
    console.log(`  最终 messages 长度: ${value.state.messages.length} 条`);
    console.log('  消息构成          : ' + value.state.messages.map(m => m.role).join(' -> '));
    break;
  }

  switch (value.type) {
    // 低层流事件,UI 层用它们做实时渲染;此处忽略
    case 'text':
    case 'tool_use_start':
    case 'message_start':
    case 'message_done':
      break;

    case 'assistant_message':
      console.log(`--- 第 ${turn} 轮:模型的完整回复 ---`);
      for (const block of value.message.content) {
        if (block.type === 'tool_use') {
          console.log(`   [tool_use] 工具=${block.name} 参数=${JSON.stringify(block.input)}`);
        } else {
          console.log(`   [text] ${block.text.replace(/\n/g, ' ').slice(0, 150)}`);
        }
      }
      console.log('   → 该回复已 push 进 messages 数组');
      turn += 1;
      break;

    case 'tool_result_message':
      console.log(`   [tool_result] 工具执行结果已装进 role=${value.message.role} 的消息:`);
      for (const block of value.message.content) {
        const text = String(block.content).replace(/\n/g, '\n                 ');
        console.log(`      ${text.slice(0, 400)}`);
      }
      console.log('   → 该结果也已 push 进 messages 数组');
      break;

    default:
      break;
  }
}
