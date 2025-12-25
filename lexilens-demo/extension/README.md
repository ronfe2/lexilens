# LexiLens Chrome 扩展

LexiLens 是一个基于浏览器侧边栏的 AI 词汇教练，为你提供实时、结合语境的英文单词分析。

## 安装与构建（Setup）

1. 安装依赖：

```bash
pnpm install
```

2. 配置环境变量：

```bash
cp .env.example .env
```

3. 构建扩展：

```bash
pnpm build
```

构建完成后，产物会写入项目根目录下的 `dist/` 文件夹  
（例如 `/path/to/lexilens/dist`），而不是 `extension/dist/`。

4. 在 Chrome 中加载扩展：

- 打开 `chrome://extensions/`；
- 启用「Developer mode（开发者模式）」；
- 点击「Load unpacked（加载已解压的扩展程序）」；
- 选择根目录下的 `dist` 文件夹。

## 开发模式（Development）

```bash
pnpm dev
```

## 常用脚本（Scripts）

- `pnpm dev` —— 启动开发服务器；
- `pnpm build` —— 构建生产扩展；
- `pnpm lint` —— 运行 ESLint；
- `pnpm typecheck` —— 运行 TypeScript 类型检查。
