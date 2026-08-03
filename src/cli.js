/**
 * CLI 模式 — 直接分析图片，参数解析用 type-flag。
 *
 * 用法:
 *   llm-vision-mcp mcp                       启动 MCP Server（stdio）
 *   llm-vision-mcp <命令> <图片路径> [提示词]  直接分析图片
 */

import { typeFlag } from "type-flag";
import { SERVER_NAME, SERVER_VERSION, API_KEY, API_KEY_MESSAGE } from "./config.js";
import { VisionClient } from "./vision.js";
import { TOOL_DEFS, PROMPTS } from "./tools.js";

export function parseArgs(argv) {
  /** 解析命令行参数：位置参数 [_] + flags { help, version }。 */
  const parsed = typeFlag(argv, {
    help: { type: Boolean, alias: "h" },
    version: { type: Boolean, alias: "v" },
  });
  return {
    flags: parsed.flags,
    positionals: parsed._,
  };
}

export function findTool(command) {
  /** 命令名 → 工具定义；kebab-case 自动映射为 snake_case。 */
  const name = (command ?? "").replace(/-/g, "_");
  return TOOL_DEFS.find((d) => d.name === name);
}

export function helpText() {
  const commands = TOOL_DEFS.map((d) => {
    const extra = d.supportsPrompt ? " [提示词]" : "";
    return `  ${d.name.padEnd(22)} ${d.zh}${extra}`;
  }).join("\n");

  return `${SERVER_NAME} — 给文本模型装上眼睛 (v${SERVER_VERSION})

用法:
  ${SERVER_NAME} mcp                       启动 MCP Server（stdio，供 Claude Code 等客户端调用）
  ${SERVER_NAME} <命令> <图片路径> [提示词]  直接分析图片
  ${SERVER_NAME} help | --help | -h        显示帮助
  ${SERVER_NAME} --version | -v            显示版本

命令:
${commands}
  （下划线可替换为短横线，如 extract-text）

环境变量:
  API_KEY        供应商密钥（必填；ModelScope 令牌去掉 ms- 前缀）
  BASE_URL       接口地址（默认 https://api-inference.modelscope.cn/v1）
  VISION_MODEL   模型名（默认 Qwen/Qwen3-VL-8B-Instruct）
  TEMPERATURE    采样温度（默认 0.3）
  MAX_TOKENS     最大生成长度（默认 32768）`;
}

export async function runCli(argv, deps = {}) {
  /** 执行 CLI。返回进程退出码（0 成功 / 1 运行错误 / 2 用法错误）。 */
  const { flags, positionals } = parseArgs(argv);
  const [command, imagePath, ...rest] = positionals;

  if (flags.help || flags.version || !command || command === "help") {
    console.log(helpText());
    return 0;
  }

  const def = findTool(command);
  if (!def) {
    console.error(`未知命令: ${command}\n`);
    console.error(helpText());
    return 2;
  }

  if (!imagePath) {
    console.error(`用法: ${SERVER_NAME} ${def.name} <图片路径> [提示词]`);
    return 2;
  }

  if (!API_KEY) {
    console.error(API_KEY_MESSAGE);
    return 1;
  }

  const client = deps.client ?? new VisionClient(API_KEY);
  const prompt = rest[0] ?? PROMPTS[def.promptKey];
  try {
    const text = await client.analyze(imagePath, prompt);
    console.log(text);
    return 0;
  } catch (e) {
    console.error(`错误: ${e.message ?? e}`);
    return 1;
  }
}
