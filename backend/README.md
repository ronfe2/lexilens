# LexiLens Backend API

FastAPI backend service for LexiLens AI Language Coach.

## Setup

1. Install dependencies:
```bash
poetry install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your OpenRouter API key and optional image model
```

3. Run development server:
```bash
poetry run uvicorn app.main:app --reload
```

## API Endpoints

- `POST /api/analyze` - Analyze word/phrase with SSE streaming
- `GET /api/pronunciation/{word}` - Get pronunciation and audio
- `POST /api/lexical-map/image` - Generate XKCD-style manga explanation image for a word pair

## Testing

```bash
poetry run pytest tests/ -v
poetry run ruff check app/
```
