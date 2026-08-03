/**
 * 图片校验 — 路径白名单 / 大小限制 / 魔数校验。
 */

import { statSync } from "node:fs";
import path from "node:path";
import { ALLOWED_EXTENSIONS, MAX_IMAGE_BYTES, IMAGE_MAGIC_PREFIXES } from "./config.js";

export function validateImagePath(pathStr) {
  /** 校验图片路径，拒绝非图片文件和超大文件。 */
  const p = path.resolve(pathStr);
  let stats;
  try {
    stats = statSync(p);
  } catch {
    throw new Error(`不是一个文件: ${pathStr}`);
  }
  if (!stats.isFile()) {
    throw new Error(`不是一个文件: ${pathStr}`);
  }
  const ext = path.extname(p).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `拒绝读取 '${ext}' —— 仅允许图片格式 (${[...ALLOWED_EXTENSIONS].sort().join(", ")})。`
    );
  }
  if (stats.size > MAX_IMAGE_BYTES) {
    throw new Error(`图片过大: ${stats.size} 字节 (最大 ${MAX_IMAGE_BYTES})。`);
  }
  return p;
}

export function validateMagic(data) {
  /** 校验文件魔数。 */
  if (!IMAGE_MAGIC_PREFIXES.some((m) => data.subarray(0, m.length).equals(m))) {
    throw new Error("文件内容不像是支持的图片格式。");
  }
}
