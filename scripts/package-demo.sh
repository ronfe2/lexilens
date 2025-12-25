#!/usr/bin/env bash

# Package the local Demo version of LexiLens into a zip bundle.
# Result: lexilens-demo-bundle.zip at the repo root containing:
#   lexilens-demo/
#     README.md
#     demo-script.md
#     report.md        (optional)
#     backend/
#     extension/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ARTIFACTS_DIR="${ROOT_DIR}/artifacts/demo"
STAGING_DIR="${ARTIFACTS_DIR}/lexilens-demo"
OUTPUT_ZIP="${ROOT_DIR}/lexilens-demo-bundle.zip"

BACKEND_DIR="${ROOT_DIR}/backend"
EXTENSION_DIR="${ROOT_DIR}/extension"
DEMO_SCRIPT="${ROOT_DIR}/demo-script.md"
REPORT_MD="${ROOT_DIR}/report.md"
DEMO_README_SOURCE="${ROOT_DIR}/docs/README.demo.md"

log() {
  printf '[package-demo] %s\n' "$*" >&2
}

error() {
  printf '[package-demo][error] %s\n' "$*" >&2
}

require_path() {
  if [ ! -e "$1" ]; then
    error "Required path not found: $1"
    exit 1
  fi
}

log "Preparing demo bundle staging directory..."
rm -f "${OUTPUT_ZIP}"
rm -rf "${STAGING_DIR}"
mkdir -p "${ARTIFACTS_DIR}"

log "Checking required inputs..."
require_path "${BACKEND_DIR}"
require_path "${EXTENSION_DIR}"
require_path "${DEMO_SCRIPT}"
require_path "${DEMO_README_SOURCE}"

if ! command -v zip >/dev/null 2>&1; then
  error '"zip" command is required but not found on PATH.'
  exit 1
fi

if command -v rsync >/dev/null 2>&1; then
  RSYNC_BIN="rsync"
else
  RSYNC_BIN=""
fi

log "Staging files under ${STAGING_DIR}..."
mkdir -p "${STAGING_DIR}"

# Common rsync-style exclude patterns aligned with .gitignore and spec.
RSYNC_EXCLUDES="
  --exclude=node_modules/
  --exclude=dist/
  --exclude=dist-ssr/
  --exclude=.turbo/
  --exclude=.venv/
  --exclude=venv/
  --exclude=__pycache__/
  --exclude=*.pyc
  --exclude=*.pyo
  --exclude=.pytest_cache/
  --exclude=.mypy_cache/
  --exclude=.nyc_output/
  --exclude=.cache/
  --exclude=coverage/
  --exclude=logs/
  --exclude=*.log
  --exclude=tmp/
  --exclude=temp/
  --exclude=*.tmp
  --exclude=artifacts/
"

copy_tree() {
  src="$1"
  dest="$2"

  mkdir -p "${dest}"

  if [ -n "${RSYNC_BIN}" ]; then
    # shellcheck disable=SC2086
    ${RSYNC_BIN} -a ${RSYNC_EXCLUDES} "${src}/" "${dest}/"
  else
    log "rsync not found; using basic cp -R without excludes for ${src}"
    cp -R "${src}/." "${dest}/"

    # Best-effort cleanup of heavy artifacts when rsync is unavailable.
    find "${dest}" -name 'node_modules' -type d -prune -exec rm -rf {} + || true
    find "${dest}" -name 'dist' -type d -prune -exec rm -rf {} + || true
    find "${dest}" -name '__pycache__' -type d -prune -exec rm -rf {} + || true
    find "${dest}" -name '*.pyc' -type f -delete || true
    find "${dest}" -name '*.pyo' -type f -delete || true
    find "${dest}" -name '.venv' -type d -prune -exec rm -rf {} + || true
    find "${dest}" -name 'venv' -type d -prune -exec rm -rf {} + || true
  fi
}

log "Copying backend/..."
copy_tree "${BACKEND_DIR}" "${STAGING_DIR}/backend"

log "Copying extension/..."
copy_tree "${EXTENSION_DIR}" "${STAGING_DIR}/extension"

log "Copying documentation and demo script..."
cp "${DEMO_README_SOURCE}" "${STAGING_DIR}/README.md"
cp "${DEMO_SCRIPT}" "${STAGING_DIR}/demo-script.md"

if [ -f "${REPORT_MD}" ]; then
  cp "${REPORT_MD}" "${STAGING_DIR}/report.md"
else
  log "report.md not found – continuing without it (optional file)."
fi

log "Creating zip archive at ${OUTPUT_ZIP}..."
(
  cd "${ARTIFACTS_DIR}"
  zip -r "${OUTPUT_ZIP}" "lexilens-demo" >/dev/null
)

log "Done. Created ${OUTPUT_ZIP}"

