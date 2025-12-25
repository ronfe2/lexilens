#!/usr/bin/env bash

# Package the Formal (production) build of the LexiLens extension into a .crx
# file for judges to download directly from the landing page.
#
# Result:
#   artifacts/formal/lexilens-formal.crx
#
# Usage:
#   From the repo root:
#     bash scripts/package-formal-crx.sh
#
# Requirements:
#   - Root .gitignore 已存在并忽略常见构建输出（node_modules、dist、artifacts 等）
#   - extension/.env.formal 已按 docs/DEPLOYMENT.md / docs/README.formal.md 配置
#   - pnpm 已安装
#   - 网络可访问 npm registry（用于 pnpm dlx crx）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

EXTENSION_DIR="${ROOT_DIR}/extension"
DIST_DIR="${ROOT_DIR}/dist"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts/formal"
CRX_OUTPUT="${ARTIFACTS_DIR}/lexilens-formal.crx"
KEY_PATH="${ARTIFACTS_DIR}/lexilens-formal.pem"

log() {
  printf '[package-formal-crx] %s\n' "$*" >&2
}

error() {
  printf '[package-formal-crx][error] %s\n' "$*" >&2
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

log "Packaging dist/ into .crx using \"pnpm dlx crx\"..."
(
  cd "${DIST_DIR}"

  # If we already have a key, reuse it to keep the extension ID stable.
  if [ -f "${KEY_PATH}" ]; then
    log "Found existing key at ${KEY_PATH}, reusing it for a stable extension ID..."
    pnpm dlx crx pack -p "${KEY_PATH}" -o lexilens-formal.crx
  else
    pnpm dlx crx pack -o lexilens-formal.crx
    # If a new key was generated, move it under artifacts/formal for future runs.
    if [ -f "key.pem" ]; then
      log "Saving generated key.pem to ${KEY_PATH} for future runs (from dist/)..."
      mv "key.pem" "${KEY_PATH}"
    elif [ -f "${ROOT_DIR}/key.pem" ]; then
      log "Saving generated key.pem to ${KEY_PATH} for future runs (from repo root)..."
      mv "${ROOT_DIR}/key.pem" "${KEY_PATH}"
    fi
  fi

  if [ ! -f "lexilens-formal.crx" ]; then
    error "crx pack did not produce lexilens-formal.crx in ${DIST_DIR}."
    exit 1
  fi
)

log "Moving CRX to ${CRX_OUTPUT}..."
mv "${DIST_DIR}/lexilens-formal.crx" "${CRX_OUTPUT}"

log "Done. Formal CRX created at: ${CRX_OUTPUT}"
