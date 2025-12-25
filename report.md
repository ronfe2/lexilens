# LexiLens – 实现报告（Implementation Report）

TAL AI HACKATHON 参赛作品  
团队名称：Bazinga  
成员：李想、姬弘飞（外部）

**日期：** 2025-12-17  
**范围：** LexiLens Hackathon MVP（「Living Sinclair」项目）的完整实现情况

---

## 1. 产品定位与价值主张

LexiLens 被实现为一个 **嵌入 Chrome 侧边栏的「词汇教练」**，而不是传统字典网站。

**核心价值主张：**  
> 把你在阅读或写作中注意到的每一个英文单词，都变成一次即时的教练时刻，  
> 帮它从「被动认识」真正转变为「能自信开口使用」。

当前版本的体验特点：

- **深度嵌入阅读/写作流程**：在任何网页上双击或选中文本，侧边栏滑出进行讲解，而不是跳转到新页面；
- **流式 + 多层讲解**：先快速给出一条 Cobuild 风格的行为模式句子，然后分层追加更丰富的例句、常见错误和词汇地图；
- **上下文敏感且带个性化**：Prompt 会看到完整句子和页面类型，利用「strategy → tactic」的链路展示个性化脚手架；
- **未来感 UI**：玻璃拟态、微动效、词汇地图可视化、深色模式，以及带发音和主题切换的小教练头部。

整体上，这个实现延续了 Sinclair 规格中「语料驱动词典」的精神，并在 UX 和文案层面更加强化了  
**「AI 教练 vs. 传统字典」** 的差异。

---

## 2. 已完成的主要实现

### 2.1 后端：FastAPI + OpenRouter

代码位置：`backend/app`

- **配置模块（`config.py`）**
  - 使用 `pydantic-settings` 读取 `.env`；
  - 核心配置字段：
    - `openrouter_api_key`（必填）；
    - `openrouter_model_id`（默认 `anthropic/claude-3.5-sonnet`）；
    - `openrouter_base_url`（默认 `https://openrouter.ai/api/v1`）；
    - CORS 设置支持 `chrome-extension://*` 以及本地开发端口。

- **OpenRouter 客户端（`services/openrouter.py`）**
  - 统一封装所有与大模型的交互；
  - 提供方法：
    - `complete()`：单次（非流式）对话；
    - `stream()`：基于 SSE 的流式对话，解析 OpenRouter 的 SSE 帧并逐段产出内容；
    - `complete_json()`：在 `complete()` 结果基础上安全解析 JSON，自动处理代码块包裹等情况；
  - 请求头统一加上：
    - `Authorization`、`HTTP-Referer`、`X-Title`；
  - 错误类型细分：
    - `OpenRouterError`、`RateLimitError`、`APIConnectionError` 等；
  - 通过 `async_retry` 装饰器实现指数退避重试。

- **Prompt 构建器（`services/prompt_builder.py`）**
  - 集中管理四个层次的 Prompt 模板：
    1. **Layer 1 – Behavior Pattern**：Cobuild 风格单句解释，不允许重复目标词；
    2. **Layer 2 – Live Contexts**：包含 `twitter` / `news` / `academic` 三类场景的 JSON 数组；
    3. **Layer 3 – Common Mistakes**：`{ wrong, why, correct }` 的 JSON 数组；
    4. **Layer 4 – Cognitive Scaffolding**：带 `related_words` 和可选 `personalized` 文本的 JSON 对象；
  - **个性化钩子**：当查询词为 `tactic` 且历史中存在 `strategy` 时，在 Prompt 中明确要求生成一个
    `personalized` 字段，解释两者差异与连接，形成「strategy → tactic」个性化提示。

- **LLM 协调器（`services/llm_orchestrator.py`）**
  - 核心函数 `analyze_streaming(request: AnalyzeRequest)`：
    - 使用 `OpenRouterClient.stream()` 流式输出 **Layer 1**：
      - 按 token 发送 `layer1_chunk` 事件，用于前端渐进展示；
      - 完成后发送 `layer1_complete`，包含完整句子；
    - 使用 `asyncio.create_task` 并行请求 **Layer 2/3/4**：
      - 分别通过 `layer2`、`layer3`、`layer4` 事件返回结构化结果；
      - 每层都有独立的错误事件（如 `layer2_error`），互不影响；
    - 最终发送 `done` 事件，标记流式结束。

- **数据模型（`models/request.py`, `models/response.py`）**
  - 请求模型 `AnalyzeRequest`：`{ word, context, page_type?, learning_history? }`；
  - 针对 Live Contexts、Common Mistakes、相关词等均有 Pydantic 类型定义；
  - `PronunciationResponse` 用于返回 IPA 与音频 URL。

- **流式工具（`utils/streaming.py`）**
  - `stream_sse_events()` 将 orchestrator 产出的 `{ event, data }` 字典转为适合
    `EventSourceResponse` 的 SSE 格式，一条消息一个 `event` + JSON `data` 字段，前端可直接 `JSON.parse`。

- **API 路由（`api/routes/analyze.py`, `api/routes/pronunciation.py`）**
  - `POST /api/analyze`：
    - 接收 `AnalyzeRequest` JSON；
    - 返回 `text/event-stream` 的 SSE 流：`layer1_chunk`、`layer1_complete`、`layer2`、`layer3`、
      `layer4`、`*_error`、`done` 等事件；
  - `GET /api/pronunciation/{word}`：
    - 调用 `dictionaryapi.dev` 获取 IPA 与音频；
    - 若缺失则优雅降级（返回 `ipa="N/A"`、`audio_url=None`），前端自动隐藏播放按钮但保留单词显示。

- **错误处理（`utils/error_handling.py`）**
  - 集中定义异常类型和统一的重试逻辑；
  - 日志中包含请求 ID 与层级信息，方便排查单层失败而整体不断流。

### 2.2 前端：Chrome 扩展（React + TypeScript + Vite）

核心代码位置：`extension/src`

- **数据流与消息通道**
  - Content Script 负责捕获页面上的选中事件并与后台通信；
  - Background Service Worker 负责在内容脚本与侧边栏之间转发 `WORD_SELECTED`、`SIDE_PANEL_READY` 等消息；
  - Side Panel React 应用接收消息后发起对后端的流式请求。

- **侧边栏 React 应用（`src/sidepanel/App.tsx`）**
  - 使用 Zustand（`src/store/appStore.ts`）管理状态：
    - 当前单词、分析结果、加载状态、错误状态、主题等；
  - 主要 Hooks：
    - `useStreamingAnalysis()`：驱动 SSE 流式解析并更新四层数据；
    - `useLearningHistory()`：在 `chrome.storage.local` 中维护个性化学习历史；
    - `useInterests()` / `useWordbook()`：管理兴趣主题与个人词本；
    - `useOnboarding()`：管理正式版中新手引导的完成状态；
    - `useTheme()`：同步浅色/深色模式，并应用 Tailwind 的 `dark` 类；
  - 加载流程：
    - 初始化时向后台发送 `SIDE_PANEL_READY`，请求最近一次选中词；
    - 订阅后续的 `WORD_SELECTED` 消息，在侧边栏打开状态下实时更新。

- **分层 UI 组件（`src/components`）**
  - `Header`：展示单词、IPA、发音按钮、主题切换及用户头像区域；
  - `BehaviorPattern`：玻璃拟态卡片，显示 Cobuild 风格一句话解释；
  - `LiveContexts`：三张场景化卡片（社交 / 新闻 / 学术），高亮目标词；
  - `CommonMistakes`：红/绿对比卡片，展示中式错误与正确表达；
  - `CognitiveScaffolding`：词汇小地图 + 相关词卡片：
    - 中心放当前单词，周围辐射相关词，使用 SVG 动画连线；
    - 附带关系标签、差异说明和使用建议；
    - 可选 `personalizedTip` 区块，用于「strategy → tactic」等个性化提示；
  - 以及 `EmptyState`、`ErrorDisplay`、`LoadingSpinner` 等状态组件。

- **流式分析 Hook（`src/sidepanel/hooks/useStreamingAnalysis.ts`）**
  - 使用 `fetch` + `ReadableStream` 自行解析 `text/event-stream`，不依赖浏览器原生 `EventSource`，避免 MV3 / Service Worker 生命周期问题；
  - 逐步处理：
    - `layer1_chunk` → 行为模式句子渐进增长；
    - `layer2 / layer3 / layer4` → 一次性更新结构化数据；
    - `*_error` → 将单层错误转为友好提示文案。

- **学习历史 Hook（`src/sidepanel/hooks/useLearningHistory.ts`）**
  - 在 Demo 模式下用 `DEMO_LEARNING_HISTORY = [strategy, implement, comprehensive]` 作为种子数据；
  - 初次加载时如果本地没有记录，会写入 Demo 历史；
  - 通过 `addEntry` 维护去重且长度受控的历史列表，并导出 `words`（小写）发送到后端。

- **样式与动效**
  - 使用 Tailwind CSS，并封装 `.glass` / `.glass-border` 等玻璃拟态工具类；
  - 全局使用 Framer Motion 做入场/悬停动画，营造「轻盈教练」感；
  - 深色模式通过 `useTheme` 与 Tailwind `dark:` 变体实现。

---

## 3. 如何体现「新范式词汇教练」体验

- **更像教练而非字典**
  - 界面中没有传统的词性列表或长篇释义表；用户首先看到的是一条**活的行为模式句子**；
  - 后续各层聚焦在「怎么用」「哪里容易错」「下一步怎么学」，而不是静态意义。

- **实时、多层次的「思考过程」**
  - Layer 1 先以流式方式出现，给评委一种「系统在思考」的感觉；
  - 几秒内逐步补齐真实例句、错误对比和词汇地图，形成层层展开的教练对话。

- **上下文与页面类型敏感**
  - 请求中携带页面类型（新闻 / 学术 / 社交等）以及完整句子，以便生成更贴近当前阅读场景的示例；
  - 对于写作场景，能围绕用户输入的整句诊断用词问题。

- **可成长的个性化教练**
  - 通过 `strategy → tactic` 路径演示：系统会记住你之前学过的词，并在后续单词中主动提及；
  - 扩展的架构（学习历史 Hook + Prompt 设计）已为后续拓展预留空间，例如等级、考试方向、长期目标等维度的个性化。

- **可视化的「语言镜片」**
  - Layer 4 的词汇小地图把「这个词和周围邻居的关系」可视化，强化 LexiLens 作为「语言镜片」的隐喻。

整体体验应让人感觉：当前网页被叠加了一层轻量的「AR 语言层」，随时解释词语行为、暴露误用并给出下一步建议。

---

## 4. 本地搭建与运行（Setup & Installation）

### 4.1 前置环境

- **后端**
  - Python 3.11+
  - 已安装 `poetry`
- **前端（扩展）**
  - Node.js 18+（推荐）
  - 已安装 `pnpm`
- **浏览器**
  - 支持 Manifest V3 与侧边栏 API 的 Google Chrome。

### 4.2 后端（FastAPI + OpenRouter）

1. 进入 `backend/`：

   ```bash
   cd backend
   ```

2. 安装依赖：

   ```bash
   poetry install
   ```

3. 创建环境变量文件：

   ```bash
   cp .env.example .env
   ```

4. 编辑 `.env`，至少设置：

   ```env
   OPENROUTER_API_KEY=your_real_openrouter_key
   # 可选覆盖项
   OPENROUTER_MODEL_ID=anthropic/claude-3.5-sonnet
   API_HOST=0.0.0.0
   API_PORT=8000
   CORS_ORIGINS=["chrome-extension://*", "http://localhost:5173"]
   ```

5. 启动 API 服务：

   ```bash
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. 快速验证：
   - 访问 `http://localhost:8000/health` → 期望 `{ "status": "healthy" }`；
   - 访问 `http://localhost:8000/docs` 查看交互式 API 文档。

### 4.3 Chrome 扩展

1. 进入 `extension/`：

   ```bash
   cd extension
   ```

2. 安装依赖：

   ```bash
   pnpm install
   ```

3. 创建环境变量文件：

   ```bash
   cp .env.example .env
   ```

4. 确保 `VITE_API_URL` 指向后端：

   ```env
   VITE_API_URL=http://localhost:8000
   VITE_ENV=development
   ```

5. 构建生产扩展：

   ```bash
   pnpm build
   ```

   构建结果会输出到项目根目录的 `dist/` 文件夹。

6. 在 Chrome 中加载扩展：
   - 打开 `chrome://extensions/`；
   - 启用 **Developer mode**；
   - 点击 **Load unpacked**，选择根目录 `dist` 文件夹。

### 4.4 标准 Demo 路径

在后端已运行且扩展已加载的前提下：

1. 打开一篇新闻或学术文章（如 The Economist 或 NYT）；  
2. 选中或双击一个单词（例如 `precarious`）；  
3. 观察 LexiLens 侧边栏：
   - 顶部展示单词及 IPA / 发音按钮；
   - Layer 1 行为模式句子流式出现；
   - Layer 2 Live Contexts 卡片逐步补齐；
   - Layer 3 常见错误卡片显露；
   - Layer 4 词汇小地图 + 相关词卡片出现；
4. 为展示个性化效果：
   - 先在任意页面查一次 `strategy`；
   - 再查 `tactic`；
   - Layer 4 应出现一条明确连接 `strategy` 与 `tactic` 的 personalized 提示。

如需更详细的口播脚本和话术，可参考根目录的 `demo-script.md`。

---

## 5. OpenRouter 配置细节

所有敏感配置仅存在于后端，浏览器扩展不会接触到 OpenRouter API Key。

- **后端环境变量**（定义于 `backend/.env.example`，在 `app/config.py` 中加载）：
  - `OPENROUTER_API_KEY`（必填）；
  - `OPENROUTER_MODEL_ID`（可选，默认 `anthropic/claude-3.5-sonnet`）；
  - `OPENROUTER_BASE_URL`（可选，默认 `https://openrouter.ai/api/v1`）；
  - 以及 `API_HOST`、`API_PORT`、`CORS_ORIGINS`、`LOG_LEVEL` 等运行参数。

- **HTTP 行为**
  - 所有大模型请求都通过 `OpenRouterClient` 访问 `/chat/completions`；
  - 请求头包括：
    - `Authorization: Bearer <OPENROUTER_API_KEY>`；
    - `HTTP-Referer: https://lexilens.app`（便于 OpenRouter 统计）；
    - `X-Title: LexiLens`。

- **模型选择与参数**
  - 默认通过 `OPENROUTER_MODEL_ID` 设置全局模型，也可以在构建 `OpenRouterClient` 时覆写；
  - 不同层次使用不同的 `max_tokens` 与 temperature：
    - Layer 1：相对简短、聚焦（如 `max_tokens=300`）；
    - Layer 2–4：略放宽以容纳多条例句和对比内容。

- **错误与限流处理**
  - 非 2xx 响应被映射为 `OpenRouterError` 或 `RateLimitError`，带 `retry_after` 信息；
  - `async_retry` 装饰器提供最多三次指数退避重试；
  - 前端在单层失败时会显示友好错误提示，而不会中断整次体验。

---

## 6. Demo / 正式包与打包方式

当前仓库支持两类打包：

- **本地演示包（Demo Bundle）**
  - 使用 `scripts/package-demo.sh` 生成，包含 `backend/`、`extension/`、`demo-script.md`、`report.md` 以及重命名后的 `docs/README.demo.md`；
  - 输出压缩包 `lexilens-demo-bundle.zip`，用于本地一键体验 Demo 版。

- **正式版打包（Formal Package）**
  - 通过 `extension` 中的 `pnpm build:formal` 生成连接云端后端的正式版扩展；
  - 打包方案和下载入口在落地页 `/judge` 中对评委暴露，详细说明见 `docs/README.formal.md` 与 `docs/DEPLOYMENT.md`。

如需重新生成 Demo 压缩包，可在仓库根目录执行：

```bash
scripts/package-demo.sh
```

然后将生成的 ZIP 提供给评委或内测用户。

---

## 7. 技术取舍与后续改进方向

### 7.1 当前实现中的技术考虑

- **Chrome 扩展环境中的 SSE**
  - 没有直接使用 `EventSource`，而是通过 `fetch + ReadableStream` 自行解析 SSE；
  - 这样可以规避 Manifest V3 / Service Worker 生命周期带来的兼容性问题，也更易控制取消与错误处理。

- **大模型 JSON 输出的鲁棒性**
  - Prompt 要求模型输出严格的 JSON 结构，`complete_json()` 内部会去除 Markdown 代码块包裹并安全解析；
  - 在 `LLMOrchestrator` 内部使用 Pydantic 校验层数结构（如 Layer 2 必须是 3 条上下文），并将错误限制在单层。

- **发音服务的回退策略**
  - `dictionaryapi.dev` 并非对所有词都有完备 IPA + 音频；
  - 当缺失时会返回 `ipa="N/A"`、`audio_url=None`，前端隐藏播放按钮但保留单词显示。

- **个性化范围**
  - 出于 Hackathon 时间限制，目前个性化主要集中在 `strategy → tactic` 的示范路径；
  - 从架构上看，只需扩展学习历史结构与 Prompt 指令，即可支持更丰富的个性化策略。

### 7.2 未来可以尝试的方向

- 增加「中英双语解释层」，提供可选的中文解释以方便中级用户过渡；
- 在侧边栏中加入「练习模式」，例如填空题 / 快速改写小练习；
- 记录单词掌握度并结合简易的间隔重复提醒；
- 引入轻量级页面内容分类器，而不仅依靠 URL 规则来判断页面类型。

---

## 8. 交付与接力建议（How to Hand Off）

- **给开发者**：  
  - 可先阅读 `backend/README.md` 与 `extension/README.md` 获取快速启动命令；  
  - 再结合本 `report.md` 与 `spec.md` 理解整体架构与关键设计决策。

- **给 Demo 演示者 / 评委**：  
  - 推荐使用 `demo-script.md` 作为主线话术脚本；  
  - 搭配「strategy → tactic」个性化案例和 Layer 4 词汇地图，重点强调  
    **「这是一个教练，而不是字典」** 的产品定位。

目前 LexiLens 已经处于可以支撑一场 **10 分钟现场 Demo** 的稳定状态：  
它不再是一个单次查词工具，而是一层覆盖在网页之上的「实时语言镜片」，  
让每一个被注意到的词都变成一次真正可被记住、可被使用的学习机会。

