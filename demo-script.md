# LexiLens 演示脚本与测试流程

本脚本用于支持 8–10 分钟的现场 Demo，以及对当前 MVP 的端到端功能自测。

## 0. 环境检查（Environment Checklist）

- 后端（Backend）
  - `backend/` 目录下已配置 `.env`，包含：
    - `OPENROUTER_API_KEY=<your-key>`
    - `OPENROUTER_MODEL_ID=<model-id>`（例如 `anthropic/claude-3.5-sonnet`）
  - 启动 API：
    ```bash
    cd backend
    poetry run uvicorn app.main:app --reload --port 8000
    ```

- 浏览器扩展（Extension）
  - `extension/` 目录下已配置 `.env`，包含：
    - `VITE_API_URL=http://localhost:8000`
  - 首次需要构建一次：
    ```bash
    cd extension
    pnpm build
    ```
  - 在 Chrome 中将 `dist` 目录作为「已解压的扩展程序」加载。

## 1. 演示前快速自测（Sanity Test Pass）

在正式演示前先跑一遍基础检查：

```bash
cd backend
poetry run ruff check app/
poetry run pytest -q

cd ../extension
pnpm lint
pnpm build
```

上述命令应全部顺利通过（lint 如有 warning 一般可以忽略）。

## 2. 阅读场景：答案 vs. 教练

目标：让评委看到 LexiLens 是一个**嵌入阅读流程的实时教练**，而不是静态词典。

1. 打开一篇英文新闻或分析类文章（推荐：The Economist / NYT / BBC 等）；  
2. 在一段比较密集的长句中，选择一个单词，比如 **“precarious”** 或 **“contentious”**；  
3. 双击或选中该单词，唤起 LexiLens 侧边栏；  
4. 侧边栏滑入时配合讲解：
   - **Layer 1（行为模式）**：首先流式出现 ——  
     可以旁白：「LexiLens 会读完整个句子，用一句话的方式告诉你，这个词在这里到底扮演什么角色，而不是只给一个字典释义。」  
   - **Layer 2（延伸语境）**：三张卡片依次出现 ——  
     「Twitter / News / Academic，三个真实世界里，这个词实际在怎样的句子里出现。」  
   - **Layer 3（常见错误）**：点出一组红 / 绿对比卡片 ——  
     「这里总结的是中国学习者最容易犯的错，直接展示怎么改。」  
   - **Layer 4（下一步 / 词汇地图）**：展示推荐的 2 个相关词并简要比较。

可以强调的一句话：

> **“传统工具只停在『什么意思』，LexiLens 会继续回答『在你的场景里，应该怎么自然地说出来』。”**

## 3. 写作场景：修正别扭句子

目标：展示 LexiLens 作为**写作过程中的教练**，如何诊断用词不当。

1. 打开 Google Docs、Notion 或任意在线文本编辑器；  
2. 输入一条略显别扭但常见的句子，例如：  
   - `Our team has a strong synergy to solve complex problems.`  
3. 双击或选中 **“synergy”**；  
4. 演示讲解：
   - Layer 1 如何解释 *synergy* 在句子里的真实功能；  
   - Layer 3 如何给出与当前句子类似的误用示例，以及推荐的修改方式。  
5. 根据侧边栏建议，现场改写这句话，让评委看到「从错误到更地道表达」的全过程。

可用的一句点题话：

> **“LexiLens 不只是告诉你『这个词不太对』，而是教你『母语者会怎么在这句里改写』。”**

## 4. 个性化时刻：Strategy → Tactic 的「记忆魔法」

目标：利用内置的学习历史，触发一次 Hackathon 式的「Wow Moment」。

1. 在任意文章或编辑器里，先查一次 **“strategy”**：  
   - 选中 `strategy`，让 LexiLens 完成一次完整分析；  
   - 这次查询会被记录到学习历史中（扩展默认预置了 `strategy`、`implement`、`comprehensive` 等 Demo 历史）。  
2. 然后在附近的句子中查 **“tactic”**，例如：  
   - `We may need a different tactic for this campaign.`  
3. 滚动到 **Layer 4（词汇地图 / 下一步）**：  
   - 你应该会看到顶部出现一段 **个人化提示**，明确把 *strategy* 和 *tactic* 联系在一起；  
   - 强调这是因为 LexiLens「记住」了用户之前查过 `strategy`，并在 Prompt 中主动要求模型把两个词关联起来。

建议强调的句子：

> **“LexiLens 会记住你是怎么学单词的，把后面遇到的新词重新串到你已有的语义网络里 —— 它更像一套活的词汇系统。”**

## 5. 性能快速体感（Performance Check）

彩排时，可以在相对稳定的网络环境下，测两三个典型单词的大致响应时间：

- Layer 1 第一段文字出现：目标 **< 500 ms**；  
- 四层讲解 + 发音全部完成：目标 **< 3 s**。

如果感觉响应偏慢，可以：

- 在 Demo 中尽量选取单句或较短语境（不要一次选中整段长文）；  
- 避免同时在多个标签页反复触发分析。

## 6. 收尾总结（Closing Talking Point）

建议在演示结束时，用一句话重新点明产品价值主张：

> **“LexiLens 就像一片实时叠加在网页上的语言镜片：它不是回答『这个词是什么意思？』，而是教你『我现在、在这句话里，应该怎么自然地说出来』。”**
