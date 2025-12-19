# Investigation: Chrome extension fails to load from `dist/`

## Bug summary

- When loading the unpacked Chrome extension from `~/personal/sinclair/dist`, Chrome reports:
  - `Could not load css 'src/content/content-script.css' for script.`
  - `Could not load manifest.`
- This means Chrome is trying to read a CSS file under `src/content/` from the built `dist/` folder and fails, causing the manifest to be treated as invalid.

## Observations

- The extension source lives under `extension/` with a Vite + React + `@crxjs/vite-plugin` setup.
- `extension/manifest.json` is a **source manifest** wired into the CRX plugin:
  - `background.service_worker: "src/background/service-worker.ts"`
  - `content_scripts[0].js: ["src/content/content-script.ts"]`
  - `side_panel.default_path: "src/sidepanel/index.html"`
- The content script imports its stylesheet directly:
  - `src/content/content-script.ts` → `import './content-script.css';`
- Build pipeline:
  - `pnpm build` runs `tsc && vite build && node scripts/validate-dist.mjs`
  - Vite config (`extension/vite.config.ts`) outputs to the **project root** `../dist` so that Chrome loads `~/.../sinclair/dist`.
  - The post-build validator `scripts/validate-dist.mjs` reads `dist/manifest.json` and checks that all referenced files exist in `dist/`.
- Current local build status:
  - `pnpm build` fails at the TypeScript step with `TS6133: 'STORAGE_KEYS' is declared but its value is never read` in `src/background/service-worker.ts`.
  - Because of this, `vite build` and `scripts/validate-dist.mjs` are not currently running, so we cannot regenerate a fresh `dist/` bundle in this workspace yet.
- No `dist/` directory currently exists at the project root in this workspace (only source files are present).

## Root cause analysis

Based on the user’s Chrome error message and the current project layout:

- Chrome reports it cannot load CSS at `src/content/content-script.css` **when the extension is loaded from `dist/`**.
- The `dist/` output is meant to contain compiled JS/CSS/HTML assets only; it should not contain a `src/` tree.
- Therefore, the built `dist/manifest.json` that Chrome is reading must be referencing `content_scripts[*].css` entries that still point to `src/content/content-script.css` instead of the bundled CSS asset actually emitted by Vite (e.g. something like `assets/content-script-*.css`).
- When Chrome fails to resolve a file referenced in `content_scripts[*].css`, it treats the manifest as invalid and surfaces the `Could not load manifest` error during "Load unpacked".
- This mismatch is consistent with:
  - A manifest that either explicitly listed `css: ["src/content/content-script.css"]`, or
  - A build step/plugin that wrote the original source path into `dist/manifest.json` instead of the final bundled asset path.
- In our current source manifest, there is **no explicit `css` array** under `content_scripts`; the CSS is pulled in via `import './content-script.css';`. That means the incorrect CSS path likely came from an earlier version of the manifest or an earlier build configuration that was still present when the user created `~/personal/sinclair/dist`.
- Separately, the build currently fails before bundling due to the unused `STORAGE_KEYS` import in the background service worker. This is not the original Chrome error but is a blocking issue for producing a new, correct `dist/` bundle.

In short: the extension’s built `dist/manifest.json` (from the user’s environment) is referencing **source-only paths under `src/`**, at least for the content script CSS, which do not exist in the built `dist/` output. This makes Chrome reject the manifest. Our local workspace also has a failing TypeScript build that prevents regenerating a clean `dist/`.

## Affected components

- `extension/manifest.json`
  - Source-of-truth for extension entrypoints; currently uses `src/...` paths that the CRX plugin is expected to rewrite at build time.
- `extension/src/content/content-script.ts` and `extension/src/content/content-script.css`
  - Content script logic and its stylesheet; CSS is imported directly into the TS file.
- `extension/src/background/service-worker.ts`
  - Uses `path: 'src/sidepanel/index.html'` when calling `chrome.sidePanel.setOptions`, which will not exist in the built `dist/` bundle.
  - Imports `STORAGE_KEYS` but does not use it, causing the TypeScript build to fail under `noUnusedLocals`.
- `extension/vite.config.ts`
  - Configures output to the root-level `dist/` folder and wires `manifest.json` through `@crxjs/vite-plugin`.
- `extension/scripts/validate-dist.mjs`
  - Intended to catch inconsistencies where `dist/manifest.json` references non-existent files, but currently never runs because `tsc` fails first.

## Proposed solution

Plan for the implementation step:

1. **Unblock the build pipeline**
   - Fix the TypeScript error in `src/background/service-worker.ts` by either:
     - Removing the unused `STORAGE_KEYS` import, or
     - Actually using `STORAGE_KEYS` where appropriate (e.g. when persisting user state).
   - Keep `strict` / `noUnusedLocals` enabled so the build remains a good safety net.

2. **Ensure manifest and runtime paths only reference built assets**
   - Keep `content_scripts[0].js` pointing to the TS entry (`"src/content/content-script.ts"`) and rely on `@crxjs/vite-plugin` + Vite to:
     - Compile it to JS, and
     - Automatically emit and wire the corresponding bundled CSS file into `dist/manifest.json`.
   - Confirm that `dist/manifest.json` no longer contains any `src/...` paths (especially under `content_scripts[*].css`).
   - Update `side_panel.default_path` and any hard-coded HTML paths in `service-worker.ts` to the built file name produced by Vite (most likely `"sidepanel.html"` in the root of `dist/`).

3. **Tighten validation of the built extension**
   - After fixing the build, rerun `pnpm build` in `extension/` to generate a fresh `dist/`.
   - Use `scripts/validate-dist.mjs` to verify that every path in `dist/manifest.json` resolves to a real file in `dist/`.
   - Optionally, extend the validator to explicitly flag any manifest entries that start with `src/`, since those should never appear in the final bundle.

4. **Manual verification in Chrome**
   - Load the new `dist/` folder via `chrome://extensions` → "Load unpacked".
   - Confirm:
     - No "Could not load css" or "Could not load manifest" errors.
     - Background service worker starts without errors.
     - Side panel opens correctly and the content script runs on a normal web page.

These steps should eliminate the incorrect `src/...` references from the built manifest, fix the current TypeScript build blocker, and result in a Chrome extension bundle that loads cleanly from `~/personal/sinclair/dist`.

## Implementation notes

- Removed the unused `STORAGE_KEYS` import from `extension/src/background/service-worker.ts` to unblock the TypeScript compilation (`tsc` with `noUnusedLocals`).
- Kept the side panel path used in `chrome.sidePanel.setOptions` aligned with the actual build output by explicitly documenting and retaining `path: 'src/sidepanel/index.html'`, which matches the file emitted into `dist/src/sidepanel/index.html`.
- Ran `pnpm build` from the `extension/` directory. This executes:
  - `tsc` (now passing),
  - `vite build` (which emits JS/CSS/HTML into the project-root `dist/`),
  - `node scripts/validate-dist.mjs` (which verifies all manifest paths exist).
- Verified `dist/manifest.json` after the build:
  - `content_scripts[0].css` now points at the bundled asset `assets/content-script-*.css` instead of any `src/...` path.
  - Background service worker entry is `service-worker-loader.js`, which exists in `dist/`.
  - All referenced icons and side panel HTML paths resolve inside `dist/`.

With the new `dist/` folder, Chrome should no longer report `Could not load css 'src/content/content-script.css' for script` or `Could not load manifest` when loading the unpacked extension from `~/personal/sinclair/dist`. If a stale `dist/` directory exists elsewhere on disk, replacing it with this freshly built `dist/` is recommended.

