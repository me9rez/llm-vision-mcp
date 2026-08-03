#!/usr/bin/env node
/**
 * llm-vision-mcp — 给文本模型装上眼睛
 *
 * 图片文件 → OpenAI 兼容视觉模型 → 文字描述
 *
 * 双模式入口：
 *   node index.js mcp    → MCP Server（stdio）
 *   node index.js ...    → CLI 直接分析图片
 */

import "dotenv/config";
import { runMcpServer } from "./src/mcp.js";
import { runCli, parseArgs } from "./src/cli.js";
import { TOOLS } from "./src/config.js";

const [mode, ...rest] = process.argv.slice(2);

if (mode === "mcp") {
  // --tools 参数优先，TOOLS 环境变量兜底
  const { flags } = parseArgs(rest);
  runMcpServer({ tools: flags.tools ?? TOOLS }).catch((err) => {
    console.error(`[llm-vision-mcp] 启动失败: ${err}`);
    process.exit(1);
  });
} else {
  const argv = mode === undefined ? [] : [mode, ...rest];
  runCli(argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`错误: ${err.message ?? err}`);
      process.exitCode = 1;
    });
}
