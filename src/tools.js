/**
 * 共享工具元数据 — MCP 注册与 CLI 命令分发共用。
 */

export const TOOL_DEFS = [
  {
    name: "analyze_image",
    zh: "分析磁盘上的图片文件",
    en: "Analyze an image file on disk",
    promptKey: "analyze",
    supportsPrompt: true,
  },
  {
    name: "extract_text",
    zh: "从磁盘图片中提取文字(OCR)",
    en: "OCR an image file on disk",
    promptKey: "extract_text",
  },
  {
    name: "describe_ui",
    zh: "描述磁盘上 UI 图片文件",
    en: "Describe a UI screenshot file",
    promptKey: "describe_ui",
  },
  {
    name: "diagnose_error",
    zh: "诊断磁盘上错误图片文件",
    en: "Diagnose an error screenshot file",
    promptKey: "diagnose_error",
  },
  {
    name: "understand_diagram",
    zh: "解读流程图/架构图等图表",
    en: "Interpret a diagram image file",
    promptKey: "understand_diagram",
  },
  {
    name: "analyze_chart",
    zh: "分析数据图表中的趋势和洞察",
    en: "Analyze a chart image file",
    promptKey: "analyze_chart",
  },
  {
    name: "code_from_screenshot",
    zh: "从磁盘图片中提取代码",
    en: "Extract code from a screenshot file",
    promptKey: "code_from_screenshot",
  },
];

export const PROMPTS = {
  analyze:
    "请详细描述这张图片的内容。包括所有相关元素、上下文，以及任何对看不到图片的人有用的信息。",
  extract_text: "提取这张图片中的全部文字。只返回文字内容，保留排版和换行，不做任何评论。",
  describe_ui:
    "分析这张 UI 图片。描述：1) 整体布局 2) 组件（按钮、表单、导航、输入框）3) 可见文字和标签 4) 状态（错误提示、激活标签页、弹窗等）。",
  diagnose_error:
    "分析这张错误图片。返回：1) 精确的错误信息 2) 可能的原因 3) 具体的修复步骤 4) 如何避免再次发生。",
  understand_diagram:
    "解读这张图表。返回：1) 图表类型 2) 组成部分及其作用 3) 关系/流程 4) 整体目的。",
  analyze_chart:
    "分析这张数据图表。返回：1) 图表类型 2) 坐标轴和标签 3) 关键趋势 4) 值得注意的数据点 5) 洞察。",
  code_from_screenshot:
    "从这张图片中提取全部代码。返回：1) 编程语言 2) 格式化的代码块，保留缩进。",
};

export function parseToolsList(value) {
  /** "a,b,c" → Set（kebab-case 自动转 snake_case，未知名称忽略并警告）；空 → null（= 全部启用）。 */
  if (!value) return null;
  const known = new Set(TOOL_DEFS.map((d) => d.name));
  const names = value
    .split(",")
    .map((s) => s.trim().replace(/-/g, "_"))
    .filter(Boolean);
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length > 0) {
    console.warn(`[llm-vision-mcp] 忽略未知工具: ${unknown.join(", ")}`);
  }
  return new Set(names.filter((n) => known.has(n)));
}

export function filterToolDefs(tools) {
  /** 按工具白名单过滤 TOOL_DEFS；未配置（null/空）→ 全部。 */
  const set = parseToolsList(tools);
  return set === null ? TOOL_DEFS : TOOL_DEFS.filter((d) => set.has(d.name));
}
