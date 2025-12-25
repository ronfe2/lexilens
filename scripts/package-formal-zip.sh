#!/usr/bin/env bash

# Package the Formal (production) build of the LexiLens extension into a ZIP
# bundle containing the built `dist/` directory, for judges to download from
# the landing page and install via "加载已解压的扩展程序".
#
# Result:
#   artifacts/formal/lexilens-formal-dist.zip
#
# Usage:
#   From the repo root:
#     bash scripts/package-formal-zip.sh
#
# Requirements:
#   - Root .gitignore 已存在并忽略常见构建输出（node_modules、dist、artifacts 等）
#   - extension/.env.formal 已按 docs/DEPLOYMENT.md / docs/README.formal.md 配置
#   - pnpm / zip 已安装

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

EXTENSION_DIR="${ROOT_DIR}/extension"
DIST_DIR="${ROOT_DIR}/dist"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts/formal"
ZIP_OUTPUT="${ARTIFACTS_DIR}/lexilens-formal-dist.zip"

log() {
  printf '[package-formal-zip] %s\n' "$*" >&2
}

error() {
  printf '[package-formal-zip][error] %s\n' "$*" >&2
}

require_path() {
  if [ ! -e "$1" ]; then
    error "Required path not found: $1"
    exit 1
  fi
}

log "Checking repository structure..."
require_path "${ROOT_DIR}/.gitignore"
require_path "${EXTENSION_DIR}"
require_path "${EXTENSION_DIR}/package.json"
require_path "${EXTENSION_DIR}/.env.formal"

if ! command -v pnpm >/dev/null 2>&1; then
  error '"pnpm" command is required but not found on PATH.'
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  error '"zip" command is required but not found on PATH.'
  exit 1
fi

log "Ensuring artifacts directory exists..."
mkdir -p "${ARTIFACTS_DIR}"

log "Installing extension dependencies (if needed)..."
(
  cd "${EXTENSION_DIR}"
  pnpm install
)

log "Building Formal extension (VITE_APP_MODE=production)..."
(
  cd "${EXTENSION_DIR}"
  pnpm build:formal
)

if [ ! -d "${DIST_DIR}" ]; then
  error "Expected dist/ directory at ${DIST_DIR} after build, but it was not found."
  exit 1
fi

log "Creating ZIP from dist/ at ${ZIP_OUTPUT}..."
rm -f "${ZIP_OUTPUT}"

(
  cd "${ROOT_DIR}"
  # Zip the top-level dist/ directory so that judges can unzip it and use
  # "Load unpacked" in chrome://extensions to select the dist/ folder.
  zip -r "${ZIP_OUTPUT}" "dist" >/dev/null
)

log "Done. Formal dist ZIP created at: ${ZIP_OUTPUT}"
log "Upload this ZIP and configure FORMAL_PACKAGE_URL with its public URL for the judge landing page."

