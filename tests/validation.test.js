import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateImagePath, validateMagic } from "../src/validation.js";
import { MAX_IMAGE_BYTES } from "../src/config.js";

// 1x1 透明 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let dir;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "llm-vision-mcp-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("validateImagePath", () => {
  it("合法 PNG 文件通过校验并返回绝对路径", async () => {
    const p = path.join(dir, "ok.png");
    await writeFile(p, Buffer.from(PNG_BASE64, "base64"));
    expect(validateImagePath(p)).toBe(path.resolve(p));
  });

  it("大写扩展名 .PNG 也通过（大小写不敏感）", async () => {
    const p = path.join(dir, "UPPER.PNG");
    await writeFile(p, Buffer.from(PNG_BASE64, "base64"));
    expect(() => validateImagePath(p)).not.toThrow();
  });

  it("不存在的路径报错", () => {
    expect(() => validateImagePath(path.join(dir, "missing.png"))).toThrow(/不是一个文件/);
  });

  it("目录路径报错", () => {
    expect(() => validateImagePath(dir)).toThrow(/不是一个文件/);
  });

  it("非图片扩展名被拒绝", async () => {
    const p = path.join(dir, "note.txt");
    await writeFile(p, "hello");
    expect(() => validateImagePath(p)).toThrow(/仅允许图片格式/);
  });

  it("超过 20MB 的图片被拒绝", async () => {
    const p = path.join(dir, "big.png");
    await writeFile(p, Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(() => validateImagePath(p)).toThrow(/图片过大/);
  });
});

describe("validateMagic", () => {
  const validCases = [
    ["PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["JPEG", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ["GIF87a", Buffer.from("GIF87a")],
    ["GIF89a", Buffer.from("GIF89a")],
    ["WEBP (RIFF)", Buffer.from("RIFF....WEBPVP8 ")],
    ["BMP", Buffer.from("BM1234")],
  ];

  it.each(validCases)("%s 魔数通过校验", (_label, data) => {
    expect(() => validateMagic(data)).not.toThrow();
  });

  it("文本内容被拒绝", () => {
    expect(() => validateMagic(Buffer.from("hello world"))).toThrow(/不像是支持的图片格式/);
  });

  it("空数据被拒绝", () => {
    expect(() => validateMagic(Buffer.alloc(0))).toThrow();
  });
});
