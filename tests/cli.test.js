import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseArgs, findTool, runCli, helpText } from "../src/cli.js";
import { PROMPTS } from "../src/tools.js";

// 保证 cli.js 静态导入时 API_KEY 非空，成功路径可测
vi.hoisted(() => {
  process.env.API_KEY = "test-key";
});

describe("parseArgs (type-flag)", () => {
  it("解析位置参数与 flags", () => {
    const { positionals, flags } = parseArgs(["analyze_image", "a.png", "描述颜色"]);
    expect(positionals).toEqual(["analyze_image", "a.png", "描述颜色"]);
    expect(flags.help).toBe(false);
    expect(flags.version).toBe(false);
  });

  it("识别 -h / --help", () => {
    expect(parseArgs(["-h"]).flags.help).toBe(true);
    expect(parseArgs(["--help"]).flags.help).toBe(true);
  });

  it("识别 -v / --version", () => {
    expect(parseArgs(["-v"]).flags.version).toBe(true);
    expect(parseArgs(["--version"]).flags.version).toBe(true);
  });

  it("识别 --tools / -t", () => {
    expect(parseArgs(["--tools", "analyze_image,extract_text"]).flags.tools).toBe(
      "analyze_image,extract_text"
    );
    expect(parseArgs(["-t", "analyze_image"]).flags.tools).toBe("analyze_image");
  });
});

describe("findTool", () => {
  it("snake_case 命令匹配工具定义", () => {
    expect(findTool("analyze_image")?.name).toBe("analyze_image");
    expect(findTool("extract_text")?.name).toBe("extract_text");
  });

  it("kebab-case 自动映射为 snake_case", () => {
    expect(findTool("extract-text")?.name).toBe("extract_text");
    expect(findTool("code-from-screenshot")?.name).toBe("code_from_screenshot");
  });

  it("未知命令返回 undefined", () => {
    expect(findTool("foobar")).toBeUndefined();
    expect(findTool()).toBeUndefined();
  });
});

describe("helpText", () => {
  it("包含用法、全部命令与环境变量说明", () => {
    const text = helpText();
    expect(text).toContain("用法:");
    expect(text).toContain("mcp");
    for (const name of ["analyze_image", "extract_text", "code_from_screenshot"]) {
      expect(text).toContain(name);
    }
    for (const env of ["API_KEY", "BASE_URL", "VISION_MODEL", "TEMPERATURE", "MAX_TOKENS"]) {
      expect(text).toContain(env);
    }
  });
});

describe("runCli", () => {
  const mockAnalyze = vi.fn();
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    mockAnalyze.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("无参数时打印帮助并返回 0", async () => {
    const code = await runCli([]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("用法:"));
  });

  it("--help 打印帮助并返回 0", async () => {
    const code = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("用法:"));
  });

  it("--version 打印版本并返回 0", async () => {
    const code = await runCli(["--version"]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("v1.0.0"));
  });

  it("成功分析图片并输出模型文本", async () => {
    mockAnalyze.mockResolvedValue("图片描述结果");
    const code = await runCli(["analyze_image", "/x.png"], { client: { analyze: mockAnalyze } });
    expect(code).toBe(0);
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", PROMPTS.analyze);
    expect(logSpy).toHaveBeenCalledWith("图片描述结果");
  });

  it("analyze_image 支持自定义提示词", async () => {
    mockAnalyze.mockResolvedValue("ok");
    await runCli(["analyze_image", "/x.png", "只看文字"], { client: { analyze: mockAnalyze } });
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", "只看文字");
  });

  it("kebab-case 命令使用对应场景提示词", async () => {
    mockAnalyze.mockResolvedValue("ok");
    await runCli(["extract-text", "/x.png"], { client: { analyze: mockAnalyze } });
    expect(mockAnalyze).toHaveBeenCalledWith("/x.png", PROMPTS.extract_text);
  });

  it("未知命令输出提示并返回 2", async () => {
    const code = await runCli(["foobar", "/x.png"]);
    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("未知命令"));
  });

  it("缺少图片路径返回 2", async () => {
    const code = await runCli(["analyze_image"]);
    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("用法"));
  });

  it("视觉客户端异常时输出错误并返回 1", async () => {
    mockAnalyze.mockRejectedValue(new Error("boom"));
    const code = await runCli(["analyze_image", "/x.png"], { client: { analyze: mockAnalyze } });
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("错误: boom");
  });
});

describe("API_KEY 缺失", () => {
  it("未设置 API_KEY 时输出引导文案并返回 1", async () => {
    const prev = process.env.API_KEY;
    delete process.env.API_KEY;
    vi.resetModules();
    const { runCli } = await import("../src/cli.js");
    try {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const code = await runCli(["analyze_image", "/x.png"], { client: {} });
      expect(code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("API_KEY"));
      errorSpy.mockRestore();
    } finally {
      process.env.API_KEY = prev;
    }
  });
});

describe("index.js 入口分发（子进程）", () => {
  const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

  it("mcp 参数启动 MCP Server 并完成握手", () => {
    const res = spawnSync(
      process.execPath,
      ["index.js", "mcp"],
      {
        cwd: ROOT,
        input:
          '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}\n',
        encoding: "utf8",
        timeout: 30000,
      }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("llm-vision-mcp");
    expect(res.stdout).toContain('"tools"');
  });

  it("无参数时打印帮助", () => {
    const res = spawnSync(process.execPath, ["index.js"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 30000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("用法:");
    expect(res.stdout).toContain("mcp");
  });

  it("TOOLS 环境变量限制 tools/list 返回的工具", () => {
    const res = spawnSync(process.execPath, ["index.js", "mcp"], {
      cwd: ROOT,
      env: { ...process.env, TOOLS: "analyze_image" },
      input:
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}\n' +
        '{"jsonrpc":"2.0","method":"notifications/initialized"}\n' +
        '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n',
      encoding: "utf8",
      timeout: 30000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("analyze_image");
    expect(res.stdout).not.toContain("extract_text");
    expect(res.stdout).not.toContain("describe_ui");
  });

  it("--tools 参数限制 tools/list 返回的工具", () => {
    const res = spawnSync(
      process.execPath,
      ["index.js", "mcp", "--tools", "analyze_image,extract_text"],
      {
        cwd: ROOT,
        input:
          '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}\n' +
          '{"jsonrpc":"2.0","method":"notifications/initialized"}\n' +
          '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n',
        encoding: "utf8",
        timeout: 30000,
      }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("analyze_image");
    expect(res.stdout).toContain("extract_text");
    expect(res.stdout).not.toContain("describe_ui");
  });
});
