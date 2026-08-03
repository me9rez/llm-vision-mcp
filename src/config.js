/**
 * 全局配置 — 环境变量解析与常量。
 */

export const SERVER_NAME = "llm-vision-mcp";
export const SERVER_VERSION = "0.0.1";

// 通用 OpenAI 兼容供应商配置（均可通过环境变量覆盖）
export const DEFAULT_MODEL = "Qwen/Qwen3-VL-8B-Instruct";
export const BASE_URL = process.env.BASE_URL || "https://api-inference.modelscope.cn/v1";
export const API_KEY = process.env.API_KEY || "";
export const TOOLS = process.env.TOOLS || "";
export const VISION_MODEL = process.env.VISION_MODEL || DEFAULT_MODEL;
export const TEMPERATURE = (() => {
  const t = Number(process.env.TEMPERATURE);
  return Number.isFinite(t) ? t : 0.7;
})();
export const MAX_TOKENS = (() => {
  const n = Number.parseInt(process.env.MAX_TOKENS, 10);
  return Number.isInteger(n) && n > 0 ? n : 32768;
})();

// 安全检查
export const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAGIC_PREFIXES = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
  Buffer.from([0xff, 0xd8, 0xff]), // JPEG
  Buffer.from("GIF87a"),
  Buffer.from("GIF89a"),
  Buffer.from("RIFF"), // WEBP
  Buffer.from("BM"), // BMP
];

export const API_KEY_MESSAGE = `❌ 未设置 API_KEY 环境变量。

支持任意 OpenAI 兼容的视觉模型供应商，可通过环境变量配置：
1. API_KEY=你的密钥
2. BASE_URL=接口地址 （默认 https://api-inference.modelscope.cn/v1）
3. VISION_MODEL=模型名 （默认 Qwen/Qwen3-VL-8B-Instruct）
4. TEMPERATURE=0.7 / MAX_TOKENS=32768 （可选调参）

ModelScope 免费 Key（每天2000次，单模型500次）：https://modelscope.cn/my/myaccesstoken
⚠️ 令牌格式为 ms-xxxxxxxx，使用时去掉 ms- 前缀！

API_KEY not set. Set API_KEY, BASE_URL and VISION_MODEL to use any
OpenAI-compatible vision provider. Free ModelScope key:
https://modelscope.cn/my/myaccesstoken (2000 calls/day, remove ms- prefix).`;
