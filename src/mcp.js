/**
 * MCP 模式 — stdio Server 构建与运行。
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION, API_KEY, API_KEY_MESSAGE } from "./config.js";
import { VisionClient } from "./vision.js";
import { PROMPTS, filterToolDefs } from "./tools.js";

let visionClient = null;

/** 注入/清空视觉客户端（runMcpServer 启动时使用，测试中用于注入 mock）。 */
export function setVisionClient(client) {
  visionClient = client;
}

async function run(promptKey, imagePath, override = null) {
  const prompt = override ?? PROMPTS[promptKey];
  return visionClient.analyze(imagePath, prompt);
}

function handleError(e) {
  return { content: [{ type: "text", text: `错误: ${e.message ?? e}` }] };
}

export function createMcpServer({ tools } = {}) {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const defs = filterToolDefs(tools);

  for (const def of defs) {
    const inputSchema = def.supportsPrompt
      ? {
          image_path: z.string().describe("图片路径"),
          prompt: z.string().optional().describe("自定义问题"),
        }
      : {
          image_path: z
            .string()
            .describe("图片文件的绝对路径 / Absolute path to the image file."),
        };

    server.registerTool(
      def.name,
      { description: `${def.zh} / ${def.en}`, inputSchema },
      async (args) => {
        try {
          if (!visionClient) return { content: [{ type: "text", text: API_KEY_MESSAGE }] };
          const text = await run(def.promptKey, args.image_path, args.prompt);
          return { content: [{ type: "text", text }] };
        } catch (e) {
          return handleError(e);
        }
      }
    );
  }

  return server;
}

export async function runMcpServer({ tools } = {}) {
  if (API_KEY) {
    setVisionClient(new VisionClient(API_KEY));
  }

  const server = createMcpServer({ tools });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
