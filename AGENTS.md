# 仓库说明

## 常用命令

- 使用 `npm install` 安装依赖；这是一个独立的 Node.js 包，要求 Node.js `>=18`。
- 用 `npm test`（`vitest run`）运行完整测试套件；用 `npm run smoke` 运行无需 API Key 的验证冒烟测试。
- 用 `npm start`（`node index.js mcp`）启动本地 MCP stdio 服务；直接 CLI 分析为 `node index.js <tool> <image-path> [prompt]`。
- 项目没有配置构建、lint、格式化、类型检查或代码生成步骤；不要自行引入这些作为必要验证。

## 目录结构

- `index.js` 是唯一的运行时入口：`mcp` 选择 stdio MCP 服务，其余参数都走 CLI。
- `src/tools.js` 是工具名称、提示词以及 MCP/CLI 工具过滤的唯一事实来源；复用这里，不要重复定义工具元数据。
- `src/config.js` 在模块导入时读取环境变量；测试中修改配置后必须重置模块再重新导入。
- `src/vision.js` 在把 base64 数据发送给 OpenAI 兼容 API 前校验本地图片；`src/mcp.js` 通过 MCP 注册同样的工具。

## 配置与安全

- 运行时配置来自 `API_KEY`、`BASE_URL`、`VISION_MODEL`、`TEMPERATURE`、`MAX_TOKENS` 以及仅 MCP 模式生效的 `TOOLS`；`.env` 由 `index.js` 加载，且已被 Git 忽略。
- MCP 使用 stdio，不能用 stdout 写日志或其他非协议输出。
- 图片输入有意限制为 `src/config.js` 中的扩展名和魔数前缀，并受 `src/validation.js` 的 20 MiB 大小限制；修改图片处理逻辑时保留这些检查。
- MCP 模式下 `--tools` 优先于 `TOOLS` 环境变量；工具名接受 snake_case 或 kebab-case，未知名称会被忽略并给出警告。

## 测试

- 测试是 `tests/` 下的 Vitest 文件；只迭代某一区域时用聚焦命令，如 `npx vitest run tests/validation.test.js`。
- 测试使用临时目录和 mock 的 OpenAI 调用；整个测试套件和冒烟测试都不需要真实 API Key。MCP 子进程测试会走一遍 JSON-RPC stdio 握手。