# llm-vision-mcp 👁️

<p align="center">
  <b>给文本模型装上眼睛。</b><br>
  图片文件 → MCP → 通义千问VL → 文字描述 → DeepSeek 也能"看见"
</p>

<p align="center">
  <b><i>Give text-only LLMs the ability to see.</i></b><br>
  <i>Image file → Qwen-VL → text → your text-only model can "see"</i>
</p>

---

## 📌 这是什么？

通过 MCP stdio 协议为文本模型提供图片理解能力的本地服务，专注磁盘图片分析：

- 支持任意 OpenAI 兼容的视觉模型供应商（默认 ModelScope 免费的通义千问VL，国内直连，每天 2000 次调用，单模型 500 次），可通过 `BASE_URL`/`VISION_MODEL` 切换
- 通过 MCP stdio 协议供 Claude Code / Opencode 等客户端调用
- 本地进程运行，不开放任何网络端口

**为什么需要？** DeepSeek / GLM 等文本模型的 API 没有视觉能力——给它一个图片路径，它只能"看到"路径本身。本 MCP Server 把图片转成文字描述，让文本模型也能"看图说话"。

```
DeepSeek / Claude Code / Opencode
        │  MCP stdio
        ▼
┌─────────────────────┐   HTTPS   ┌──────────────────────┐
│   llm-vision-mcp    │ ────────▶ │  OpenAI 兼容供应商    │
│   (Node.js)         │           │  (默认 ModelScope     │
└─────────────────────┘           │   Qwen3-VL-8B)       │
        ▲                         └──────────────────────┘
        │ 读取图片文件 → base64 → 返回文字描述
```

## ⚡ 快速开始

已发布到 npm，**无需克隆仓库**，客户端会通过 `npx` / `pnpm dlx` 自动下载运行：

```bash
# 首次使用：获取免费 API Key（每天2000次，单模型500次）—— 默认 ModelScope 供应商
# ① 打开 https://modelscope.cn 注册/登录
# ② 点右上角头像 → 个人中心 → 访问令牌
#    或直接访问: https://modelscope.cn/my/myaccesstoken
# ③ 首次使用会提示绑定阿里云账号（必须，按页面引导完成）
# ④ 点击"新建访问令牌" → 命名 → 生成 → 复制
# ⑤ 令牌格式为 ms-xxxxxxxxxxxx，使用时去掉 ms- 前缀！

# 验证可用性（会启动 stdio 服务，Ctrl+C 退出）
npx -y @me9rez/llm-vision-mcp
# 或 pnpm
pnpm dlx @me9rez/llm-vision-mcp
```

然后按下方「客户端配置」把 MCP Server 接入 Claude Code / Opencode，在 `env` 中注入 `API_KEY` 即可。

### 🧑‍💻 本地开发

```bash
git clone <仓库地址> && cd llm-vision-mcp
npm install
npm start        # 启动 MCP Server
npm test         # 单元测试
npm run smoke    # 冒烟测试（无需 API Key）
```

## 📋 MCP 工具列表

| 工具 | 功能 |
|------|------|
| `analyze_image` | 分析磁盘图片文件（可传自定义 `prompt`） |
| `extract_text` | 磁盘图片 OCR 提取文字 |
| `describe_ui` | 分析磁盘 UI 截图 |
| `diagnose_error` | 诊断磁盘错误截图 |
| `understand_diagram` | 解读流程图/架构图 |
| `analyze_chart` | 分析数据图表 |
| `code_from_screenshot` | 磁盘代码截图提取代码 |

## 🔌 客户端配置

**Claude Code**（`.claude/settings.json`）：

```json
{
  "mcpServers": {
    "llm-vision-mcp": {
      "command": "npx",
      "args": ["-y", "@me9rez/llm-vision-mcp"],
      "env": {
        "API_KEY": "你的_API_Key"
      }
    }
  }
}
```

> ⚠️ Windows 下如 `npx` 无法直接启动，可将 `command` 改为 `npx.cmd`，或使用 `"command": "cmd", "args": ["/c", "npx", "-y", "@me9rez/llm-vision-mcp"]`。
> 完整示例见 `examples/claude_code_settings.json`。

**Opencode**（`%APPDATA%\opencode\opencode.json`）：

```json
{
  "mcp": {
    "llm-vision-mcp": {
      "type": "local",
      "command": ["npx", "-y", "@me9rez/llm-vision-mcp"],
      "enabled": true,
      "environment": {
        "API_KEY": "你的_API_Key"
      }
    }
  }
}
```

> 完整示例见 `examples/opencode.json`。

## ⚙️ 环境变量

支持任意 OpenAI 兼容的视觉模型供应商，全部通过环境变量配置：

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `API_KEY` | 是 | - | 供应商密钥（ModelScope 令牌需**去掉 `ms-` 前缀**） |
| `BASE_URL` | 否 | `https://api-inference.modelscope.cn/v1` | OpenAI 兼容接口地址，可替换为任意供应商 |
| `VISION_MODEL` | 否 | `Qwen/Qwen3-VL-8B-Instruct` | 视觉模型名（如 `Qwen/Qwen3-VL-235B-A22B-Instruct`） |
| `TEMPERATURE` | 否 | `0.3` | 采样温度（数字，如 `0` / `0.5`） |
| `MAX_TOKENS` | 否 | `32768` | 最大生成长度（正整数） |

**配置其他供应商示例**（如本地 Ollama / vLLM 部署）：

```json
{
  "mcpServers": {
    "llm-vision-mcp": {
      "command": "npx",
      "args": ["-y", "@me9rez/llm-vision-mcp"],
      "env": {
        "API_KEY": "sk-xxx",
        "BASE_URL": "http://localhost:8000/v1",
        "VISION_MODEL": "qwen2.5-vl-7b",
        "TEMPERATURE": "0.2",
        "MAX_TOKENS": "4096"
      }
    }
  }
}
```

## 🛡️ 安全

- 本地 stdio 进程运行，不开放任何网络端口
- 仅接受图片格式（`.png .jpg .jpeg .gif .webp .bmp`），防止 LLM 注入后读取任意文件
- 文件大小限制 20MB，扩展名 + 魔数双重校验
- 图片经 base64 编码发送至视觉模型供应商 API，参阅其隐私政策

## 🙏 参考来源

- [deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes)（MIT）— 本项目参考的原始项目：MCP Server + 通义千问VL，原项目为 Python 实现并含剪贴板工具；本项目以 Node.js 重写并移除了剪贴板工具
- 视觉模型：通义千问VL / Qwen-VL via [ModelScope](https://modelscope.cn)

## 📄 License

MIT
