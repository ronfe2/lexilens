#!/usr/bin/env node

/**
 * Post-build sanity check for the Chrome extension bundle.
 *
 * This script reads the built `dist/manifest.json` (at the project root)
 * and verifies that every file it references actually exists on disk.
 *
 * It is intended to catch mismatches like:
 * - Manifest pointing at `src/...` files instead of bundled assets
 * - Missing CSS/JS files for content scripts
 * - Stale `web_accessible_resources` entries
 */

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

/**
 * Collect all file paths referenced from the manifest that should exist
 * inside the built dist directory.
 */
function collectManifestPaths(manifest) {
  const paths = new Set();

  if (manifest.background?.service_worker) {
    paths.add(manifest.background.service_worker);
  }

  for (const cs of manifest.content_scripts ?? []) {
    for (const js of cs.js ?? []) {
      paths.add(js);
    }
    for (const css of cs.css ?? []) {
      paths.add(css);
    }
  }

  if (manifest.side_panel?.default_path) {
    paths.add(manifest.side_panel.default_path);
  }

  if (manifest.icons) {
    for (const key of Object.keys(manifest.icons)) {
      paths.add(manifest.icons[key]);
    }
  }

  if (manifest.action?.default_icon) {
    const icons = manifest.action.default_icon;
    if (typeof icons === 'string') {
      paths.add(icons);
    } else {
      for (const key of Object.keys(icons)) {
        paths.add(icons[key]);
      }
    }
  }

  for (const war of manifest.web_accessible_resources ?? []) {
    for (const res of war.resources ?? []) {
      paths.add(res);
    }
  }

  return [...paths];
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    const manifestRaw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    const relPaths = collectManifestPaths(manifest);
    const missing = [];

    for (const rel of relPaths) {
      const fullPath = path.join(distDir, rel);
      // Use explicit existence check instead of relying on Vite output.
      if (!(await pathExists(fullPath))) {
        missing.push(rel);
      }
    }

    if (missing.length > 0) {
      console.error('[validate-dist] The following files referenced from dist/manifest.json are missing:');
      for (const p of missing) {
        console.error(`  - ${p}`);
      }
      console.error(
        '[validate-dist] Build output is inconsistent. ' +
          'Make sure you ran `pnpm build` from the `extension/` directory and that the Vite config is up to date.',
      );
      process.exit(1);
    }

    console.log('[validate-dist] All manifest paths resolved successfully in dist/.');
  } catch (err) {
    console.error('[validate-dist] Failed to validate dist/manifest.json:', err);
    process.exit(1);
  }
}

main();

