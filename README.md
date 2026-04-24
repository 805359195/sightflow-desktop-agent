# 项目在大佬 https://sightflow.dev/ 基础下做的修改。

## AI 模型配置 (API Key / 多厂商)

本项目的对话与**布局测量 (VLM)** 均通过 OpenAI 兼容的 **`/chat/completions`（或厂商等价）HTTP 接口** 调用大模型。请为每个模型提供 **API Key、模型名、Base URL**；三者须属**同一厂商/同一套凭证**，否则会出现 **401 / API key format is incorrect** 等鉴权错误。

| 项目 | 说明 |
| --- | --- |
| **Base URL** | 填写**可发起 POST 的完整接口地址**（通常以 `/chat/completions` 等结尾，视厂商文档为准）。**留空**时，主进程会采用内置默认（如火山引擎方舟的默认 chat 端点，具体以 `src/core/ai-client.ts` 中 `DEFAULT_CHAT_URL` 为准）。 |
| **模型列表** | 设置中可维护**多条**模型：添加/编辑/删除、**使用**为当前用于引擎的模型、**测试**为针对该条单独做连通性检查。 |
| **引擎与 VLM** | 启动引擎前会做**一次性布局测量**（对微信等窗口截屏后调用 VLM 定位 UI 区域）。该请求与聊天回复、测试连接**共用当前选中模型的 Key / Model / Base URL**；仅 Key 而 URL 与厂商不一致时，容易在**布局阶段**就失败。 |

### 模型引用 (Volcengine) 示例


1. 在应用**设置**中配置 Key、模型 ID 与 **完整**的 chat 端点（若与内置默认不同则必填）。
2. 将 **使用** 切到要用的那条模型，再**测试**与启动引擎。

### 其他厂商 (如 Moonshot、OpenAI 等)

- 在厂商文档中复制 **与 Key 配套** 的 `POST` 地址与 `model` 名，**整体粘贴**到 Base URL 与模型字段。  
- 不要混用 A 家 Key 与 B 家 URL。

## 快速开始 (Project Setup)

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发运行

```bash
npm run dev
```

> **提示**：启动后请先在**设置**中完成模型配置并**测试**通过，再启动引擎；并确保**微信 / 企业微信**窗口可访问（未最小化/遮挡过多），否则布局测量可能失败。

## 打包构建 (Build)

```bash
# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

```

## 开发环境推荐配置

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
