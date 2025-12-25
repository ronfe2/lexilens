# LexiLens 视觉物料清单

本清单用于汇总 Demo 包、落地页以及扩展新手引导中提到的所有截图 / 图示 / 插画，方便在最终
提交前一次性补齐视觉素材。

这些素材对系统运行不是必需的，但会极大提升评审体验和产品呈现效果。可将本文件视为一个
「待补充素材」清单。

---

## 1. 本地演示包 README（`docs/README.demo.md`）

- `Product intro` —— 整体侧边栏界面  
  - 位置：README 顶部 “LexiLens 本地演示包” 简介附近；  
  - 素材：完整 LexiLens 侧边栏截图，包含单词、分层讲解和顶部个人信息区。

- `Analysis layers` —— 分层讲解视图  
  - 位置：第 1 节「产品概览」中对四层讲解的描述部分；  
  - 素材：单个单词的多层讲解区域特写截图。

- `Lexical map visualization` —— 词汇地图  
  - 位置：第 1 节「产品概览」尾部；  
  - 素材：展示 3–4 个相关词的词汇地图截图。

- `Reading → LexiLens flow` —— 阅读到查词流程  
  - 位置：第 2 节「功能亮点」末尾；  
  - 素材：组合或连环截图，展示「网页 → 选中单词 → 打开侧边栏」的流程。

- `Wordbook entry example` —— 词本条目示例  
  - 位置：第 2 节「功能亮点」末尾；  
  - 素材：典型词本条目截图（包含上下文与解释快照）。

- `Backend health / docs` —— 后端健康检查 / 文档  
  - 位置：第 4.2 节「后端安装与启动」；  
  - 素材：浏览器访问 `http://localhost:8000/docs` 或 `/health` 的截图。

- `Chrome extension management` —— 扩展管理页  
  - 位置：第 5 节「运行本地 Demo」，步骤 3；  
  - 素材：`chrome://extensions` 页面中已加载 LexiLens 的截图。

- `First‑run side panel` —— 首次打开侧边栏界面  
  - 位置：第 5 节「运行本地 Demo」，步骤 4；  
  - 素材：Demo 模式下第一次打开侧边栏时的界面截图。

- `Architecture diagram` —— 架构示意图  
  - 位置：第 3 节「架构概览」；  
  - 素材：简洁示意图，展示「Chrome 扩展 → FastAPI 后端 → 模型服务」的数据流。

---

## 2. 落地页（`landing/app/page.tsx`）

- `Hero illustration / side‑panel preview` —— 首屏视觉 / 产品预览  
  - 位置：Hero 区域（`.ll-hero-placeholder` 容器内）；  
  - 素材：结合产品名称和侧边栏截图的营销视觉图。

- `Analysis layers card` —— 分层讲解卡片  
  - 位置：「核心功能亮点」模块的第一张卡片；  
  - 素材：多层讲解区域的局部截图。

- `Wordbook / history card` —— 词本 / 历史卡片  
  - 位置：「核心功能亮点」模块的第二张卡片；  
  - 素材：词本或学习历史列表的局部截图。

- `Side panel on article card` —— 文章 + 侧边栏卡片  
  - 位置：「核心功能亮点」模块的第三张卡片；  
  - 素材：右侧打开 LexiLens 侧边栏、左侧为英文文章页面的截图。

---

## 3. 评委入口（`landing/app/judge/page.tsx`）

- `Formal package download panel` —— 评委专用下载面板  
  - 位置：访问口令验证通过后显示的 `ll-judge-panel` 区域；  
  - 素材：输入正确口令后出现的评委专用区域截图，需包含：
    - 正式版 Chrome 扩展 dist 压缩包（ZIP）下载链接（由 `FORMAL_PACKAGE_URL` 提供）；  
    - 简要的安装步骤文字说明。

- `Configuration note` —— 配置提示（纯文字）  
  - 无需图片；只需在部署前确认 `FORMAL_PACKAGE_URL` 已配置为最终 dist ZIP 下载地址。

---

## 4. 新手引导面板（`extension/src/sidepanel/OnboardingPanel.tsx`）

- `Full side‑panel with layer labels` —— 带标注的完整侧边栏  
  - 位置：「LexiLens 是什么？」小节中的第一个虚线框；  
  - 素材：整屏侧边栏截图，并在图中标注：
    - Layer 1–4 所在区域；  
    - 个人信息、兴趣、词本等个性化区域。

- `Triggering LexiLens from a page` —— 从网页唤起词汇教练  
  - 位置：「如何唤起词汇教练？」小节中的第二个虚线框；  
  - 素材：静态截图或短动图，展示：
    - 在真实网页上选中单词；  
    - 旁边出现 LexiLens 浮动按钮并点击后唤起侧边栏。

---

## 5. 部署指南（`docs/DEPLOYMENT.md`）

- `Deployed landing home page` —— 已上线落地页首页  
  - 素材：正式域名下 `/` 页面截图（包含首屏 Hero + 候补名单表单）。

- `Join Waitlist section` —— 候补名单表单区域  
  - 素材：用户成功提交邮箱后的 Join Waitlist 区域特写截图。

- `Judge entrance and download panel` —— 评委入口与下载面板  
  - 素材：在 `/judge` 页面输入正确评委口令后，显示下载链接与安装说明的界面截图。

以上截图建议从最终部署的线上环境中采集，并将准确的 URL 填回 `docs/DEPLOYMENT.md`
对应位置，替换当前的占位说明。

---

## 6. Logo 替换方案与说明

为了方便在不同阶段更新或替换视觉品牌（例如更换临时 Hackathon Logo 或未来商业化
Logo），建议按照以下方案管理与替换 Logo 资源：

- **Chrome 扩展图标**
  - 位置：`extension/public/icon-16.png`、`extension/public/icon-48.png`、`extension/public/icon-128.png`；
  - 用途：浏览器工具栏图标、扩展管理页图标以及侧边栏入口图标；
  - 替换方式：  
    - 以相同文件名直接替换 PNG 文件；  
    - 建议保持原有尺寸和透明背景（16×16 / 48×48 / 128×128 像素）；  
    - 替换后重新运行 `pnpm build` 或 `pnpm build:demo` / `pnpm build:formal` 生成最新扩展。

- **打包产物中的图标**
  - 位置：根目录 `dist/public/` 下的 `icon-*.png`（由构建过程复制而来）；  
  - 说明：无需手动修改，只需替换 `extension/public` 中源文件并重新构建即可。

- **落地页中的品牌展示**
  - 位置：`landing/app/page.tsx` 中的 Hero 区域（`.ll-hero-placeholder`）和标题 `LexiLens` 附近；  
  - 推荐做法：
    - 在设计稿中准备一张带有 LexiLens Logo 的横版 Banner 或带透明背景的 Logo 图片；  
    - 部署时可将图片放入 `landing/public/`（例如 `landing/public/logo-lexilens.png`），
      并在页面中通过 `<Image>` 或 `<img>` 引用；  
    - 如需完全替换产品名称，可在文案处统一替换为新的品牌名。

- **文档中的 Logo / 品牌名称**
  - 文档文件：`docs/README.demo.md`、`docs/README.formal.md`、`docs/DEPLOYMENT.md` 等；  
  - 替换方式：  
    - 如仅替换视觉 Logo，而名称仍使用「LexiLens」，文档可保持不变；  
    - 如未来产品更名，建议在一次提交中全局搜索「LexiLens」，统一替换为新名称。

> 提示：Logo 文件的最终格式建议使用 PNG（带透明背景）或 SVG。  
> 在替换前后，可通过 Demo 包和线上落地页快速自查，确认所有入口（浏览器扩展、落地页、
> 文档截图占位）中的品牌呈现保持一致。
