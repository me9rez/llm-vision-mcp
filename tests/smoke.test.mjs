/**
 * 本地冒烟测试 — 无需 ModelScope API Key。
 *
 * 校验图片路径 / 魔数逻辑是否正确：
 *  1. 合法 PNG 通过校验
 *  2. 非图片扩展名被拒绝
 *  3. 扩展名合法但内容不符的伪图片被拒绝
 *
 * 用法: npx vitest run tests/smoke.test.mjs
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateImagePath, validateMagic } from "../src/validation.js";

// 1x1 透明 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("冒烟测试（无需 API Key）", () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "llm-vision-mcp-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("合法 PNG 通过扩展名与魔数校验", async () => {
    const pngPath = path.join(dir, "sample.png");
    await writeFile(pngPath, Buffer.from(PNG_BASE64, "base64"));
    expect(() => validateImagePath(pngPath)).not.toThrow();
    const data = await readFile(pngPath);
    expect(() => validateMagic(data)).not.toThrow();
  });

  it("非图片扩展名被拒绝", async () => {
    const txtPath = path.join(dir, "note.txt");
    await writeFile(txtPath, "hello");
    expect(() => validateImagePath(txtPath)).toThrow(/仅允许图片格式/);
  });

  it("伪图片 .png 因魔数不符被拒绝", async () => {
    const fakePath = path.join(dir, "fake.png");
    await writeFile(fakePath, "not an image");
    const data = await readFile(fakePath);
    expect(() => validateMagic(data)).toThrow(/不像是支持的图片格式/);
  });
});
