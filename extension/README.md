# LexiLens Chrome Extension

AI-powered language coach that provides real-time, contextual word analysis.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Build extension:
```bash
pnpm build
```

4. Load in Chrome:
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

## Development

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build production extension
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
