# LexiLens Demo Script & Test Flow

This script is optimized for a 8–10 minute live demo and end‑to‑end testing of the current MVP.

## 0. Environment Checklist

- Backend
  - `.env` in `backend/` with:
    - `OPENROUTER_API_KEY=<your-key>`
    - `OPENROUTER_MODEL_ID=<model-id>` (e.g. `anthropic/claude-3.5-sonnet`)
  - Start API:
    ```bash
    cd backend
    poetry run uvicorn app.main:app --reload --port 8000
    ```
- Extension
  - `.env` in `extension/` with:
    - `VITE_API_URL=http://localhost:8000`
  - Build once:
    ```bash
    cd extension
    pnpm build
    ```
  - Load `extension/dist` as an unpacked extension in Chrome.

## 1. Sanity Test Pass (pre‑demo)

Run once before the demo:

```bash
cd backend
poetry run ruff check app/
poetry run pytest -q

cd ../extension
pnpm lint
pnpm build
```

All commands should succeed (lint may report only warnings).

## 2. Reading Scenario – “Answer vs. Coach”

Goal: Show LexiLens as a **live coach embedded in reading**, not a static dictionary.

1. Open an English news or analysis article (ideal: The Economist, NYT, BBC).
2. Pick a word like **“precarious”** or **“contentious”** in a dense paragraph.
3. Double‑click the word.
4. Narrate as the side panel slides in:
   - Layer 1 (Behavior Pattern) streams in first — “LexiLens reads the whole sentence and gives you a one‑sentence Cobuild‑style behavior pattern, not just a dictionary gloss.”
   - Layer 2 (Live Contexts) appears as three cards — “Twitter, News, Academic — three live worlds where this word actually lives.”
   - Layer 3 (Common Mistakes) — highlight one red/green pair and say how it prevents typical Chinglish errors.
   - Layer 4 (Next Steps) — show how it recommends 2 related words and briefly compare them.

Key line to emphasise: **“Traditional tools stop at ‘meaning’; LexiLens continues to ‘how you actually use it in your world’.”**

## 3. Writing Scenario – Fixing an Awkward Sentence

Goal: Show LexiLens as a **coach while writing**, diagnosing misuse.

1. Open Google Docs, Notion, or any web text editor.
2. Type a sentence with an awkward but common word choice, for example:
   - `Our team has a strong synergy to solve complex problems.`
3. Double‑click **“synergy”**.
4. Walk through:
   - Layer 1 explains what *synergy* really does in a sentence.
   - Layer 3 shows a misuse example similar to yours and how to revise it.
5. Edit the sentence live based on the coaching.

Key line: **“LexiLens doesn’t just tell you a word is ‘wrong’ — it shows you *how natives would fix it* in this exact sentence.”**

## 4. Personalization Moment – “Strategy → Tactic” Magic

Goal: Trigger the hackathon “wow” moment using the hard‑coded learning history.

1. In any article or editor, first look up **“strategy”**:
   - Select `strategy` in a sentence and let LexiLens complete its analysis once.
   - This also records `strategy` into the learning history (the extension ships with a demo history seeded with `strategy`, `implement`, `comprehensive`).
2. Then look up **“tactic”** in a nearby sentence, e.g.:
   - `We may need a different tactic for this campaign.`
3. Scroll to Layer 4 (Next Steps):
   - You should see a **personalized tip** at the top, explicitly connecting *strategy* and *tactic*.
   - Point out that this is generated because LexiLens noticed `strategy` in the user’s learning history and asked the model to connect them.

Key line: **“LexiLens remembers how you’ve been learning and re‑threads new words onto your existing mental network — it’s a living lexicon.”**

## 5. Quick Performance Check

During rehearsal, time one or two typical words over a stable connection:

- Layer 1 first token: target **< 500 ms**
- All four layers + pronunciation: target **< 3 s**

If calls feel slow, prefer shorter contexts (highlight a single sentence, not a whole paragraph).

## 6. Closing Talking Point

End the demo with a single, crisp value proposition:

> **LexiLens is a living lens on language — instead of a dictionary that answers “what does this mean?”, it’s an in‑flow coach that teaches “how do *I* say this here, now?”.**

