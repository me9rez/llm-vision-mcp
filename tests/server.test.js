import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMcpServer, setVisionClient } from "../src/mcp.js";
import { PROMPTS, TOOL_DEFS, filterToolDefs } from "../src/tools.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/config.js";

const EXPECTED_TOOLS = TOOL_DEFS.map((d) => d.name);

describe("服务与工具注册", () => {
  let server;

  beforeEach(() => {
    server = createMcpServer();
  });

  it("服务名与版本正确", () => {
    expect(SERVER_NAME).toBe("llm-vision-mcp");
    expect(SERVER_VERSION).toBe("1.0.0");
  });

  it("注册了全部 7 个磁盘图片工具", () => {
    expect(Object.keys(server._registeredTools).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("PROMPTS 覆盖全部 7 个场景提示词", () => {
    expect(Object.keys(PROMPTS).sort()).toEqual(
      [
        "analyze",
        "extract_text",
        "describe_ui",
        "diagnose_error",
        "understand_diagram",
        "analyze_chart",
        "code_from_screenshot",
      ].sort()
    );
  });

  it("analyze_image schema：image_path 必填、prompt 可选", () => {
    const schema = server._registeredTools.analyze_image.inputSchema;
    expect(schema.safeParse({ image_path: "/a.png" }).success).toBe(true);
    expect(schema.safeParse({ image_path: "/a.png", prompt: "只看文字" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ prompt: "x" }).success).toBe(false);
  });

  it("其余工具 schema 仅要求 image_path", () => {
    for (const name of EXPECTED_TOOLS.slice(1)) {
      const schema = server._registeredTools[name].inputSchema;
      expect(schema.safeParse({ image_path: "/a.png" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    }
  });
});

describe("工具回调", () => {
  let server;
  const mockAnalyze = vi.fn();

  beforeEach(() => {
    server = createMcpServer();
    setVisionClient({ analyze: mockAnalyze });
  });

  afterEach(() => {
    setVisionClient(null);
    mockAnalyze.mockReset();
  });

  it("未注入视觉客户端时返回 API Key 引导文案", async () => {
    setVisionClient(null);
    const res = await server._registeredTools.analyze_image.handler({ image_path: "/a.png" });
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text).toContain("API_KEY");
    expect(res.content[0].text).toContain("modelscope.cn/my/myaccesstoken");
    expect(res.content[0].text).toContain("ms-");
  });

  it("analyze_image 默认使用 analyze 提示词", async () => {
    mockAnalyze.mockResolvedValue("ok");
    await server._registeredTools.analyze_image.handler({ image_path: "/x.png" });
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", PROMPTS.analyze);
  });

  it("analyze_image 支持自定义 prompt 覆盖", async () => {
    mockAnalyze.mockResolvedValue("ok");
    await server._registeredTools.analyze_image.handler({
      image_path: "/x.png",
      prompt: "只看文字",
    });
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", "只看文字");
  });

  it.each([
    ["extract_text", "extract_text"],
    ["describe_ui", "describe_ui"],
    ["diagnose_error", "diagnose_error"],
    ["understand_diagram", "understand_diagram"],
    ["analyze_chart", "analyze_chart"],
    ["code_from_screenshot", "code_from_screenshot"],
  ])("%s 使用对应的场景提示词", async (toolName, promptKey) => {
    mockAnalyze.mockResolvedValue("ok");
    await server._registeredTools[toolName].handler({ image_path: "/x.png" });
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", PROMPTS[promptKey]);
  });

  it("返回模型文本作为 text content", async () => {
    mockAnalyze.mockResolvedValue("描述结果");
    const res = await server._registeredTools.extract_text.handler({ image_path: "/x.png" });
    expect(res).toEqual({ content: [{ type: "text", text: "描述结果" }] });
  });

  it("视觉客户端抛错时返回「错误: …」文本", async () => {
    mockAnalyze.mockRejectedValue(new Error("boom"));
    const res = await server._registeredTools.analyze_image.handler({ image_path: "/x.png" });
    expect(res.content[0].text).toBe("错误: boom");
  });
});

describe("工具过滤 (filterToolDefs / parseToolsList)", () => {
  it("未配置时启用全部工具", () => {
    expect(filterToolDefs(null)).toHaveLength(TOOL_DEFS.length);
    expect(filterToolDefs("")).toHaveLength(TOOL_DEFS.length);
    expect(filterToolDefs(undefined)).toHaveLength(TOOL_DEFS.length);
  });

  it("逗号分隔白名单（容忍空白）", () => {
    const defs = filterToolDefs("analyze_image, extract_text");
    expect(defs.map((d) => d.name)).toEqual(["analyze_image", "extract_text"]);
  });

  it("kebab-case 自动映射为 snake_case", () => {
    const defs = filterToolDefs("extract-text");
    expect(defs.map((d) => d.name)).toEqual(["extract_text"]);
  });

  it("未知名称被忽略并输出警告", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const defs = filterToolDefs("analyze_image,foobar");
      expect(defs.map((d) => d.name)).toEqual(["analyze_image"]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("foobar"));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("createMcpServer 工具白名单", () => {
  it("按配置只注册指定工具", () => {
    const server = createMcpServer({ tools: "analyze_image" });
    expect(Object.keys(server._registeredTools)).toEqual(["analyze_image"]);
  });

  it("配置多个工具时按序注册", () => {
    const server = createMcpServer({ tools: "extract_text,analyze_image" });
    expect(Object.keys(server._registeredTools).sort()).toEqual([
      "analyze_image",
      "extract_text",
    ]);
  });

  it("未配置时注册全部工具", () => {
    const server = createMcpServer();
    expect(Object.keys(server._registeredTools)).toHaveLength(TOOL_DEFS.length);
  });
});
