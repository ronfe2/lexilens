# Investigation – Chrome unpack error

## Bug summary
- When loading the extension as an unpacked extension in Chrome, the browser reports:
  - `Could not load css 'src/content/content-script.css' for script.`
  - `Could not load manifest.`
- The user is loading from a folder named `dist` (reported path: `~/personal/sinclair/dist`).

## What I inspected
- Extension project under `extension/`:
  - `manifest.json`
  - `vite.config.ts` (uses `@crxjs/vite-plugin` with the manifest).
  - Content script: `src/content/content-script.ts` (imports `./content-script.css`).
- Built the extension with:
  - `cd extension && pnpm install`
  - `pnpm build`
- Examined the generated bundle in `extension/dist/`, especially:
  - `dist/manifest.json`
  - `dist/.vite/manifest.json`
  - file layout under `dist/` (`assets/`, `public/`, `src/`, etc.).
- Ran a small check that loads `extension/dist/manifest.json` and verifies that every path referenced for:
  - `background.service_worker`
  - `content_scripts[*].js` and `content_scripts[*].css`
  - `side_panel.default_path`
  - `icons`
  - `web_accessible_resources[*].resources`
  actually exists on disk. All entries resolved correctly.

## Observations
- Source manifest (`extension/manifest.json`):
  - `background.service_worker` points at `src/background/service-worker.ts`.
  - `content_scripts[0].js` points at `src/content/content-script.ts`.
  - There is **no** `css` field in `content_scripts` in the source manifest.
- Content script (`extension/src/content/content-script.ts`) imports `./content-script.css`, which lives at `extension/src/content/content-script.css`.
- Build output (`extension/dist/manifest.json`):
  - `background.service_worker` is rewritten to `service-worker-loader.js`.
  - `content_scripts[0].js` is rewritten to `assets/content-script.ts-loader-…js`.
  - `content_scripts[0].css` is **added** and points to `assets/content-script-…css`.
  - `web_accessible_resources` includes the actual bundled content-script JS.
  - `side_panel.default_path` remains `src/sidepanel/index.html`, and the file exists at `dist/src/sidepanel/index.html`.
- The generated bundle in `extension/dist/` does **not** reference `src/content/content-script.css` anywhere; the only reference to that path is the import in the TypeScript source.
- There is currently **no** `dist/` at the repo root; only `extension/dist/` exists after the build.

## Root cause analysis
- The error message from Chrome shows it is trying to load a CSS file at:
  - `src/content/content-script.css`
- In the built bundle produced by `pnpm build` in `extension/`, Chrome should instead see:
  - `assets/content-script-<hash>.css`
  from the transformed `manifest.json`.
- Since all paths in `extension/dist/manifest.json` are valid and the CSS file exists at the hashed location, the most consistent explanation is:
  - Chrome is being pointed at a **folder that does not correspond to the current `extension/dist/` output**, most likely:
    - an old or partial `dist` from a previous build, or
    - a different `dist` directory (for example, a root-level `dist/`) whose `manifest.json` still references raw `src/...` paths like `src/content/content-script.css`.
- In other words, the bug is not in the current Vite/crx build pipeline itself (the generated `extension/dist` bundle is self-consistent), but in:
  - **Which directory is used when loading the unpacked extension in Chrome**, and
  - The fact that the project does not strongly enforce or validate that the selected folder matches the current build output.

## Affected components
- `extension/manifest.json`
  - Source of truth for background, content script, and side panel entrypoints.
- `extension/vite.config.ts`
  - Uses `@crxjs/vite-plugin` to transform the manifest and generate `extension/dist/`.
- `extension/src/content/content-script.ts` and `src/content/content-script.css`
  - The CSS import drives the generated `css` entry in the built manifest.
- Developer documentation:
  - `extension/README.md`
  - `report.md` (section 4.3: Chrome Extension)
  - These docs mention loading from `dist` / `extension/dist` but leave some room for misinterpreting *which* `dist` directory is correct.

## Proposed solution
High-level goal: make it hard to select the wrong folder in Chrome and ensure any built `dist` is self-validated.

1. **Standardize the build output and usage**
   - Treat the **project root `dist/`** as the single source of truth for the unpacked extension bundle.
   - Update the Vite config so that running `pnpm build` from `extension/` emits files into `../dist`.
   - Make sure all documentation clearly says:
     - Run `pnpm build` **from `extension/`**.
     - Load the unpacked extension from the root-level `dist/` (e.g. `~/personal/sinclair/dist`).

2. **Add a post-build manifest/path sanity check**
   - Convert the ad-hoc Python check used during investigation into a small script (Node or Python) stored in the repo.
   - Wire it into the `pnpm build` script so that:
     - If any path in the built `dist/manifest.json` does not exist, the build fails early with a clear error.
   - This guards against future regressions (for example, if entrypoints or paths change).

3. **No changes to runtime logic needed**
   - The current content script, background script, and side-panel logic do not appear to be causing the unpack error directly.
   - The planned fix is entirely about **build output correctness + developer workflow**, not about changing how the extension behaves at runtime.

## Implementation notes

- Updated `extension/vite.config.ts` to:
  - Set `build.outDir` to `path.resolve(__dirname, '../dist')`, so the build outputs directly into the project root `dist/` folder.
  - Enable `emptyOutDir: true` to avoid stale assets accumulating between builds.
- Added a post-build validation script at `extension/scripts/validate-dist.mjs` that:
  - Loads `dist/manifest.json` from the project root.
  - Collects all referenced paths from:
    - `background.service_worker`
    - `content_scripts[*].js` and `content_scripts[*].css`
    - `side_panel.default_path`
    - `icons` and `action.default_icon`
    - `web_accessible_resources[*].resources`
  - Verifies that each referenced file actually exists under `dist/`.
  - Fails the build (`process.exit(1)`) with a clear error message if any path is missing.
- Wired the validator into the extension build pipeline by updating `extension/package.json`:
  - `"build": "tsc && vite build && node scripts/validate-dist.mjs"`
- Updated developer documentation to match the new workflow:
  - `extension/README.md`: clarifies that `pnpm build` writes to the project root `dist/` and that Chrome should load that folder.
  - `report.md` section 4.3: now instructs loading the root-level `dist/` rather than `extension/dist/`.

## Test results

- Ran `pnpm build` from `extension/`:
  - Vite emitted the extension bundle into the project root `dist/` directory.
  - The validator script reported: `[validate-dist] All manifest paths resolved successfully in dist/.`
  - Verified `dist/manifest.json`:
    - `content_scripts[0].css` points to `assets/content-script-<hash>.css` (no references to `src/content/content-script.css`).
    - All other referenced assets (JS, HTML, icons, web-accessible resources) exist in `dist/`.
- With this setup, loading `~/personal/sinclair/dist` as an unpacked extension in Chrome should use the validated, built manifest and no longer trigger the `"Could not load css 'src/content/content-script.css' for script"` / `"Could not load manifest"` errors.
