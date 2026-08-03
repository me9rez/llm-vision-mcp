import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Mock openai 模块：捕获 create 调用参数
// 注意：vitest 4 中可被 `new` 的 mock 实现必须用 function/class，不能用箭头函数
const { createMock, OpenAI } = vi.hoisted(() => {
  const createMock = vi.fn();
  const OpenAI = vi.fn(function () {
    return { chat: { completions: { create: createMock } } };
  });
  return { createMock, OpenAI };
});

vi.mock("openai", () => ({ default: OpenAI }));

// 1x1 透明 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let dir;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "llm-vision-mcp-test-"));
  createMock.mockReset();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

// 每个用例重新加载模块，保证环境变量/模块状态独立
async function load() {
  vi.resetModules();
  const [config, vision] = await Promise.all([
    import("../src/config.js"),
    import("../src/vision.js"),
  ]);
  return { ...config, ...vision };
}

describe("VisionClient.analyze", () => {
  it("发送正确的请求参数并返回模型文本", async () => {
    const { VisionClient, VISION_MODEL, BASE_URL } = await load();
    createMock.mockResolvedValue({ choices: [{ message: { content: "一张图片的描述" } }] });
    const p = path.join(dir, "sample.png");
    await writeFile(p, Buffer.from(PNG_BASE64, "base64"));

    const client = new VisionClient("test-key");
    const result = await client.analyze(p, "这是什么？");

    expect(result).toBe("一张图片的描述");
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: "test-key", baseURL: BASE_URL });
    expect(createMock).toHaveBeenCalledTimes(1);

    const args = createMock.mock.calls[0][0];
    expect(args.model).toBe(VISION_MODEL);
    expect(args.temperature).toBe(0.7);
    expect(args.max_tokens).toBe(8192);
    expect(args.messages).toEqual([
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) },
          },
          { type: "text", text: "这是什么？" },
        ],
      },
    ]);
  });

  it("base64 内容与文件一致", async () => {
    const { VisionClient } = await load();
    createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    const p = path.join(dir, "sample.png");
    await writeFile(p, Buffer.from(PNG_BASE64, "base64"));

    const client = new VisionClient("test-key");
    await client.analyze(p, "x");

    const url = createMock.mock.calls[0][0].messages[0].content[0].image_url.url;
    const b64 = url.slice("data:image/png;base64,".length);
    expect(Buffer.from(b64, "base64").toString("base64")).toBe(PNG_BASE64);
  });

  it("模型返回空 content 时返回空字符串", async () => {
    const { VisionClient } = await load();
    createMock.mockResolvedValue({ choices: [{ message: { content: null } }] });
    const p = path.join(dir, "sample.png");
    await writeFile(p, Buffer.from(PNG_BASE64, "base64"));

    const client = new VisionClient("test-key");
    await expect(client.analyze(p, "x")).resolves.toBe("");
  });

  it("非法图片路径直接报错，不调用 API", async () => {
    const { VisionClient } = await load();
    const client = new VisionClient("test-key");
    await expect(client.analyze(path.join(dir, "missing.png"), "x")).rejects.toThrow(
      /不是一个文件/
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("魔数不符报错，不调用 API", async () => {
    const { VisionClient } = await load();
    const p = path.join(dir, "fake.png");
    await writeFile(p, "not an image");
    const client = new VisionClient("test-key");
    await expect(client.analyze(p, "x")).rejects.toThrow(/不像是支持的图片格式/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("VISION_MODEL 环境变量可覆盖默认模型", async () => {
    const prev = process.env.VISION_MODEL;
    process.env.VISION_MODEL = "Qwen/Qwen3-VL-235B-A22B-Instruct";
    try {
      const { VisionClient, VISION_MODEL } = await load();
      expect(VISION_MODEL).toBe("Qwen/Qwen3-VL-235B-A22B-Instruct");

      createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
      const p = path.join(dir, "sample.png");
      await writeFile(p, Buffer.from(PNG_BASE64, "base64"));
      await new VisionClient("test-key").analyze(p, "x");
      expect(createMock.mock.calls[0][0].model).toBe("Qwen/Qwen3-VL-235B-A22B-Instruct");
    } finally {
      if (prev === undefined) delete process.env.VISION_MODEL;
      else process.env.VISION_MODEL = prev;
    }
  });

  it("BASE_URL / TEMPERATURE / MAX_TOKENS 环境变量可覆盖", async () => {
    const prev = {
      BASE_URL: process.env.BASE_URL,
      TEMPERATURE: process.env.TEMPERATURE,
      MAX_TOKENS: process.env.MAX_TOKENS,
    };
    process.env.BASE_URL = "http://localhost:8000/v1";
    process.env.TEMPERATURE = "0";
    process.env.MAX_TOKENS = "32768";
    try {
      const { VisionClient, BASE_URL, TEMPERATURE, MAX_TOKENS } = await load();
      expect(BASE_URL).toBe("http://localhost:8000/v1");
      expect(TEMPERATURE).toBe(0);
      expect(MAX_TOKENS).toBe(32768);

      createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
      const p = path.join(dir, "sample.png");
      await writeFile(p, Buffer.from(PNG_BASE64, "base64"));
      await new VisionClient("test-key").analyze(p, "x");

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "http://localhost:8000/v1",
      });
      const args = createMock.mock.calls[0][0];
      expect(args.temperature).toBe(0);
      expect(args.max_tokens).toBe(32768);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it("TEMPERATURE / MAX_TOKENS 非法值回退默认", async () => {
    const prev = { TEMPERATURE: process.env.TEMPERATURE, MAX_TOKENS: process.env.MAX_TOKENS };
    process.env.TEMPERATURE = "abc";
    process.env.MAX_TOKENS = "-5";
    try {
      const { TEMPERATURE, MAX_TOKENS } = await load();
      expect(TEMPERATURE).toBe(0.7);
      expect(MAX_TOKENS).toBe(8192);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
