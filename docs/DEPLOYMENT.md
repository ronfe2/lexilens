# LexiLens 部署指南（正式版）

本文档说明如何在云端部署 **后端 API** 与 **落地页（Landing App）**，用于 LexiLens 正式版。  
本地 Demo 压缩包仍然是完全离线/本地运行，本指南只关注 Hackathon 和正式用户所需的线上部署。

> 说明：具体域名、截图和最终正式版压缩包下载地址，可在提交前由团队统一补充。

---

## 1. 后端服务：部署到 Render

目标环境：在 Render 上以 **Web Service** 形式运行 `backend/` 中的 FastAPI 后端。

### 1.1 必需环境变量

在 Render 中至少需要配置：

- `OPENROUTER_API_KEY` —— OpenRouter API Key；
- `OPENROUTER_MODEL_ID` —— 模型 ID（可选，默认值见代码配置）；
- `API_HOST` —— 一般设置为 `0.0.0.0`；
- `API_PORT` —— 一般设置为 `8000`；
- `CORS_ORIGINS` —— 允许访问的来源列表（JSON 数组），例如：

```json
["chrome-extension://*", "https://<landing-domain>"]
```

### 1.2 方案 A：通过 Render 控制台配置

1. 在 Render 新建一个 **Web Service**，代码来源为本仓库；
2. 在 **Root Directory** 中填写 `backend/`；
3. 在 **Build Command** 中填写：

   ```bash
   poetry install
   ```

4. 在 **Start Command** 中填写：

   ```bash
   poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

5. 在 **Environment** 标签页中，添加上文列出的环境变量；
6. 部署并等待 Render 完成服务启动；
7. 记录生成的公网基础 URL，例如 `https://lexilens-backend.onrender.com`。

### 1.3 方案 B：使用 `render.yaml` 一键部署

本仓库根目录已经包含 `render.yaml`。在 Render 中可以：

1. 新建一个 **Blueprint** 项目；
2. 指向本仓库及对应分支；
3. Render 会读取 `render.yaml`，创建名为 `lexilens-backend` 的服务，其配置大致为：
   - `buildCommand: cd backend && poetry install`
   - `startCommand: cd backend && poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. 在 Render 控制台中为该服务设置 `OPENROUTER_*` 等敏感环境变量。

部署完成后：

- 在浏览器中访问 `/health`，确认服务健康运行；
- 将该服务的 HTTPS 基础 URL 用作扩展构建时的 `VITE_API_URL`。

---

## 2. 落地页：部署到 Vercel 或 Render

落地页代码位于 `landing/` 目录下，是一个使用 App Router 的 Next.js 应用。

### 2.1 落地页环境变量

部署落地页前，需要准备以下环境变量：

- `WAITLIST_WEBHOOK_URL` —— 可选；如设置，候补名单 API 会向该 URL 发送
  `{ email, source, ts }` 的 JSON 请求；
- `JUDGE_ACCESS_CODE` —— 访问评委下载面板所需的密钥；
- `FORMAL_PACKAGE_URL` —— 正式版 Chrome 扩展 **dist 压缩包（ZIP）** 的公网下载地址。
  建议使用 `scripts/package-formal-zip.sh` 生成的
  `artifacts/formal/lexilens-formal-dist.zip` 并上传到对象存储或文件分享服务；
  如需实验 CRX 安装，可额外运行 `scripts/package-formal-crx.sh` 生成 CRX，
  但部分 Chrome 版本会因安全策略出现 `CRX_REQUIRED_PROOF_MISSING` 报错，
  因此不建议作为评委评审的主安装路径；
- `NEXT_PUBLIC_BACKEND_API_URL` —— 可选；指向部署好的后端，将来用于在落地页上做交互 Demo。

### 2.2 部署到 Vercel

1. 在本地先简单检查构建是否通过：

   ```bash
   cd landing
   pnpm install
   pnpm lint
   pnpm build
   ```

2. 在 Vercel 创建新项目，并导入本仓库；
3. 在项目设置中：
   - 将 **Root Directory** 设置为 `landing/`；
   - Build Command：`pnpm build`
   - Install Command：`pnpm install`
   - Output Directory：`.next`
4. 在 Vercel 的环境变量配置界面中填入 2.1 中的变量；
5. 部署并等待 Vercel 完成构建与发布。

部署成功后，你应当可以：

- 访问 `/`，看到包含功能介绍和 Join Waitlist 表单的落地页；
- 访问 `/judge`，看到评委入口页面。

### 2.3 备选方案：部署到 Render

你也可以把 `landing/` 作为 **Node Web Service** 部署到 Render：

1. 在 Render 新建 Web Service，代码来源为本仓库；
2. Root Directory：`landing/`；
3. Build Command：

   ```bash
   pnpm install
   pnpm build
   ```

4. Start Command：

   ```bash
   pnpm start
   ```

5. 配置与 2.1 中相同的环境变量。

Render 会使用 `next.config.mjs` 中配置的 standalone 输出模式来运行 Next.js 应用。

---

## 3. 将正式版扩展连接到云端后端并打包 dist ZIP

在构建正式版（production）扩展并生成评委可下载的 dist ZIP 包时：

1. 在 `extension/` 目录下准备 `.env.formal`，内容类似：

   ```env
   VITE_API_URL=https://<your-backend-domain>
   VITE_APP_MODE=production
   VITE_ENV=production
   ```

2. 构建并打包正式版扩展为 ZIP（包含 `dist/` 目录）：

   ```bash
   # 在仓库根目录
   bash scripts/package-formal-zip.sh
   ```

   运行成功后会在
   `artifacts/formal/lexilens-formal-dist.zip` 生成正式版 dist 压缩包。

3. 将生成的 `lexilens-formal-dist.zip` 上传到对象存储 / 文件分享服务，并把公网 URL
   填入落地页部署环境的 `FORMAL_PACKAGE_URL`。评委在 `/judge` 入口下载 ZIP 后：
   - 本地解压得到 `dist/` 目录；
   - 在 Chrome 打开 `chrome://extensions`，开启「开发者模式」；
   - 点击「加载已解压的扩展程序」，选择解压后的 `dist/` 目录完成安装。

4. 如需在本地调试扩展源码，也可以按 `docs/README.formal.md` 中的说明，
   手动执行 `pnpm build:formal`，然后从 `dist/` 目录以「加载已解压的扩展程序」
   的方式加载到 Chrome 中。

正式版构建的行为特点：

- 连接的是云端后端，而非本地开发服务器；
- 从完全干净的状态启动（无预制学习历史、词本或兴趣标签）；
- 首次使用时自动触发新手引导 Onboarding 流程。

---

## 4. 评委入口与候补名单：端到端自查清单

请在正式部署后，按照下面的检查项跑一遍端到端流程：

- `/` 页面能正常渲染，包含产品简介、功能卡片和候补名单（Join Waitlist）表单；
- 向 `/api/waitlist` 提交合法邮箱时，返回 `201 { ok: true }`：
  - 如设置了 `WAITLIST_WEBHOOK_URL`，外部系统应能收到对应的 payload；
  - 非法邮箱应返回 `400 { ok: false, error: "invalid_email" }`；
- `/judge` 页面能正常展示评委入口表单；
- 提交正确的 `JUDGE_ACCESS_CODE` 后，调用 `/api/judge-login`，并：
  - 返回 `200 { ok: true, downloadUrl: FORMAL_PACKAGE_URL }`；
  - 页面展示包含下载链接与安装说明的评委专用面板；
- 输入错误口令时应返回 `401 { ok: false }`，且不会展示下载面板。

> TODO：在最终部署完成后补充：
> - 实际线上域名与示例 URL；
> - 已部署落地页首页截图；
> - Join Waitlist 区域截图；
> - 评委入口 `/judge` 页面和下载面板截图。
