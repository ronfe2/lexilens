# LexiLens 后端 API

本目录包含 LexiLens 词汇教练的 FastAPI 后端服务代码。

## 环境准备与启动（Setup）

1. 安装依赖：

```bash
poetry install
```

2. 配置环境变量：

```bash
cp .env.example .env
# 在 .env 中填入你的 OpenRouter API Key 以及可选的模型配置
```

3. 启动开发服务器：

```bash
poetry run uvicorn app.main:app --reload
```

默认监听 `http://localhost:8000`。

## 主要 API 接口

- `POST /api/analyze` —— 对单词/短语进行分析，返回基于 SSE 的四层讲解流；
- `GET /api/pronunciation/{word}` —— 返回指定单词的发音信息与音频链接；
- `POST /api/lexical-map/image` —— 根据词对生成漫画/小图风格的词汇解释图像。

## 测试与代码检查

```bash
poetry run pytest tests/ -v
poetry run ruff check app/
```
