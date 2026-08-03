#!/usr/bin/env node
/**
 * 用本机 Edge 无头模式把 SVG 渲染为 PNG 预览。
 *
 * 用法：
 *   node scripts/render-svg.js                     # 默认 assets/readme/hero.svg → assets/readme/hero-preview.png
 *   node scripts/render-svg.js <input.svg> <output.png>
 *
 * 找不到 Edge 时，可通过 EDGE_PATH 环境变量指定 msedge.exe 路径。
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? path.join("assets", "readme", "hero.svg");
const output = process.argv[3] ?? path.join("assets", "readme", "hero-preview.png");

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/microsoft-edge",
  "/usr/bin/google-chrome",
].filter(Boolean);

const edge = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!edge) {
  console.error(
    "未找到 Edge/Chrome，请安装 Edge 或设置 EDGE_PATH 环境变量指向 msedge.exe 的完整路径。"
  );
  process.exit(1);
}

const svgPath = path.resolve(root, input);
const outPath = path.resolve(root, output);
if (!existsSync(svgPath)) {
  console.error(`SVG 不存在: ${svgPath}`);
  process.exit(1);
}

export function parseSvgSize(svgText) {
  /** 从 SVG 根元素解析 width/height（或 viewBox 后两个值），供 Edge 窗口尺寸使用。 */
  const dim = svgText.match(
    /<svg[^>]*\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)["']?\s+height\s*=\s*["']?(\d+(?:\.\d+)?)["']?/
  );
  if (dim) return { width: Math.round(+dim[1]), height: Math.round(+dim[2]) };
  const vb = svgText.match(/viewBox\s*=\s*["'][\d.]+ [\d.]+ (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)["']/);
  if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
  return null;
}

const url = `file:///${svgPath.replace(/\\/g, "/")}`;
const size = parseSvgSize(readFileSync(svgPath, "utf8"));
const winW = size?.width ?? 1200;
const winH = size?.height ?? 360;
rmSync(outPath, { force: true }); // 先删旧文件，避免轮询误判为已生成
const result = spawnSync(
  edge,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${winW},${winH}`,
    `--screenshot=${outPath}`,
    url,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error(`渲染失败，退出码 ${result.status}`);
  process.exit(1);
}

// Edge 无头模式截图由子进程异步落盘，主进程退出后文件才出现，轮询等待
const deadline = Date.now() + 30_000;
while (!existsSync(outPath) && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
}
if (!existsSync(outPath)) {
  console.error(`渲染超时：30 秒内未生成 ${outPath}`);
  process.exit(1);
}
console.log(`已渲染: ${outPath}`);