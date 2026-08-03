/**
 * 视觉客户端 — OpenAI 兼容 API 调用。
 */

import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { BASE_URL, VISION_MODEL, TEMPERATURE, MAX_TOKENS } from "./config.js";
import { validateImagePath, validateMagic } from "./validation.js";

export class VisionClient {
  /** 视觉客户端 (OpenAI 兼容 API，默认通义千问VL via ModelScope) */

  constructor(apiKey) {
    this.client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }

  async analyze(imagePath, prompt) {
    const p = validateImagePath(imagePath);
    const data = await readFile(p);
    validateMagic(data);
    const b64 = data.toString("base64");

    const response = await this.client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
            { type: "text", text: prompt },
          ],
        },
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    });
    return response.choices?.[0]?.message.content ?? "";
  }
}
