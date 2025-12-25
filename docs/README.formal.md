# LexiLens 正式版（云端服务 + Chrome 扩展）

TAL AI HACKATHON 参赛作品  
团队名称：Bazinga  
成员：李想、姬弘飞（外部）

本文档面向评委和早期体验用户，说明如何安装、部署并使用 **LexiLens 正式版**。

正式版主要用于真实长期使用场景，而不是一次性本地演示：

- 默认连接到部署在云端（Render）的 **后端服务**，而非纯本地后端；
- 以**干净的数据状态**启动 —— 不包含任何预制的学习历史、词本或兴趣标签；
- 首次使用时自动弹出 **新手引导 Onboarding**，帮助用户快速上手。

如果你是评委，推荐从落地页 `/judge` 入口：

- 输入主办方提供的访问口令；
- 直接下载 **Chrome 扩展 dist 压缩包（ZIP）**，解压后在 `chrome://extensions` 中通过
  「加载已解压的扩展程序」完成安装；
- 按照本说明文档和落地页上的指引，连接到云端后端并完成一次完整体验。

---

## 1. 正式版评审包包含什么？

在 Hackathon 提交材料中，我们会同时提供：

- **在线评审入口**：落地页 `/judge`，用于下载正式版扩展的 dist 压缩包（ZIP）；
- **源码压缩包（可选）**：包含 `backend/`、`extension/`、`docs/` 等目录，方便评委或技术同学本地查看与运行。

如果你拿到的是源码 ZIP 包，解压后会看到：

- `backend/` —— FastAPI 后端（与 Demo 使用同一份代码，但面向云端部署）；
- `extension/` —— Chrome 扩展源码与构建脚本；
- `docs/` —— 文档目录，包含本文件 `README.formal.md` 和 `DEPLOYMENT.md` 等。

你可以选择：

- 直接使用团队已部署好的 Render 云端后端（推荐评委使用）；或
- 按照 `docs/DEPLOYMENT.md` 中的说明，自行部署 / 运行一份后端实例。

---

## 2. 后端：优先使用云端，必要时本地启动

### 2.1 推荐方案：使用 Render 云端后端

团队会按照 `docs/DEPLOYMENT.md` 将后端部署为 **Render Web Service**。  
作为评委，你只需要一条公开的基础 URL，例如：

- `https://lexilens-backend.onrender.com`

请记录这条 URL，在构建或配置正式版扩展时会作为 `VITE_API_URL` 使用。

### 2.2 可选方案：本地启动后端

如果你更习惯在本地跑后端，可以按以下步骤操作：

```bash
cd backend
poetry install
cp .env.example .env
```

编辑 `.env`，至少设置：

- `OPENROUTER_API_KEY` —— 你的 OpenRouter API Key。

然后启动服务：

```bash
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

服务会在 `http://localhost:8000` 暴露 API，此时你也可以在正式版扩展中将
`VITE_API_URL` 设置为该地址，实现「本地后端 + 正式版扩展」的组合。

关于 Render 部署、环境变量配置和生产运行健康检查等更多细节，请参考
`docs/DEPLOYMENT.md`。

---

## 3. 安装正式版 Chrome 扩展

### 3.1 构建配置

在仓库根目录执行：

```bash
cd extension
cp .env.example .env.formal
```

编辑 `.env.formal`，将后端地址改为你的云端或本地后端：

```env
VITE_API_URL=https://<your-backend-domain>   # 或 http://localhost:8000
VITE_APP_MODE=production
VITE_ENV=production
```

随后你可以按两种方式获取正式版扩展：

- **方式 A（推荐给评委）：使用 dist 压缩包（ZIP）**
  - 如果你是评委，通常会从落地页 `/judge` 下载一个诸如
    `lexilens-formal-dist.zip` 的压缩包（由团队预先打包并托管）；
  - 将 ZIP 解压后，会得到一个包含 `manifest.json` 的 `dist/` 目录，
    后续可以直接在 Chrome 中通过「加载已解压的扩展程序」安装；
  - 如果你负责打包评审版本，可以在仓库根目录运行：

    ```bash
    bash scripts/package-formal-zip.sh
    ```

    生成 `artifacts/formal/lexilens-formal-dist.zip`，并将其上传到对象存储 /
    文件分享服务，再把公网地址配置为落地页的 `FORMAL_PACKAGE_URL`。

- **方式 B：从源码本地构建并加载 dist/**
  - 在 `extension/` 目录下运行：

    ```bash
    pnpm install
    pnpm build:formal
    ```

  - 构建完成后，扩展会被输出到项目根目录下的 **`dist/`** 文件夹  
    （与 Demo 构建共享同一个输出目录）。

> 如果你下载的正式版源码 ZIP 中已经包含根目录 `dist/` 目录，
> 并且该目录是基于正确的 `.env.formal` 构建出来的，
> 可以直接跳过本地构建步骤。

### 3.2 在 Chrome 中安装正式版扩展

无论你是从 `/judge` 页面下载 dist ZIP，还是从源码本地构建，都可以按以下步骤安装：

1. 在 Chrome 地址栏打开 `chrome://extensions/`；
2. 打开右上角 **Developer mode（开发者模式）**；
3. 安装方式：
   - 如果你拿到的是 `lexilens-formal-dist.zip`：
     - 先在本地解压该 ZIP；
     - 确认解压后的目录中包含 `manifest.json`（通常为 `dist/` 目录）；
     - 在扩展页面点击 **“Load unpacked（加载已解压的扩展程序）”**，
       并选择该目录；
   - 如果你已经有一个构建好的 `dist/` 目录：
     - 同样使用 **“Load unpacked（加载已解压的扩展程序）”** 选择该目录即可。

> 如需实验 CRX 安装流程，可以参考 `scripts/package-formal-crx.sh` 的用法，
> 但部分 Chrome 版本会因安全策略出现 `CRX_REQUIRED_PROOF_MISSING` 报错，
> 因此本次 Hackathon 不推荐以 CRX 作为主安装方式。

安装成功后，你应该能在工具栏和/或侧边栏入口列表中看到 LexiLens 图标。

---

## 4. 首次使用的新手引导（Onboarding）

正式版扩展内置了与浏览器配置相关联的新手引导流程：

- 在**新的浏览器配置文件**中首次打开 LexiLens 时，侧边栏会自动显示
  **「欢迎使用 LexiLens」** 引导面板；
- 引导内容会简要说明：
  - 如何在任意英文页面唤起 LexiLens  
    （选中单词 → 点击浮动按钮 / 通过侧边栏入口打开）；
  - 四层讲解分别负责什么（行为模式 / 延伸例句 / 常见错误 / 词汇地图）；
  - 个性化是如何生效的（水平设置、兴趣主题、单词本等）。
- 当你点击「我知道怎么用了，开始查词」或「跳过并开始使用」后，
  LexiLens 会记录当前浏览器配置已经完成引导，之后不会再自动弹出。

你可以在任何时候从扩展内部 **重新打开** 引导：

- 在任意页面唤起 LexiLens 侧边栏；
- 点击顶部个人信息卡右侧的 **「使用引导」** / 帮助按钮；
- 引导面板会再次出现，但不会重置你的完成状态，仅作为说明书使用。

在 Demo 构建中，新手引导不会自动弹出；自动引导仅在正式版（Formal）中启用，
方便真实用户第一次使用时快速搞明白如何开始。

---

## 5. 评委快速体验路径（Judge Quickstart）

下面是面向评委的一条 10 分钟左右「从 0 到体验完一条完整学习流程」的推荐路径：

1. **准备后端**
   - 优先使用团队提供的 Render 云端 URL；
   - 或者按上文在本地启动 `backend/`。
2. **获取正式版扩展**
   - 推荐：在落地页 `/judge` 输入评委口令，直接下载 `lexilens-formal-dist.zip`（dist 压缩包）；  
   - 或者：确保 `extension/.env.formal` 已配置好，运行
     `bash scripts/package-formal-zip.sh` 或 `pnpm build:formal`，
     分别从 `artifacts/formal/` 中获得 ZIP，或在根目录得到 `dist/` 目录。
3. **在 Chrome 中加载扩展**
   - 打开 `chrome://extensions`；
   - 打开「开发者模式」；
   - 如果你拿到的是 ZIP，先在本地解压，确认其中包含 `dist/` 或其他包含
     `manifest.json` 的目录；
   - 使用「Load unpacked」选择该目录完成安装。
4. **跟随新手引导完成首轮体验**
   - 打开任意英文网页，选中一个单词，唤起 LexiLens；
   - 阅读并完成「欢迎使用 LexiLens」引导面板中的步骤。
5. **体验一次完整的学习闭环**
   - 在不同语境下多查几个词；
   - 打开词本（wordbook）、兴趣卡片和词汇地图，观察系统如何基于你的操作进行个性化；
   - 对比 Demo 版中带有预制历史的体验，感受正式版从干净状态逐步构建「你的词汇网络」的过程。

这一流程既保持了部署/安装的轻量，也尽可能贴近真实用户的长期使用体验，便于评审正式版的产品价值。
