#!/usr/bin/env bash
# Package the final GitHub-ready zip: sathi-v6.0.0.zip
# Template layout: Python backend factory at the repo root (api/, core/,
# llm/, ml/, config/, context/, data/, data_gen/, tests/) + the deployable
# Next.js app in web/ (+ android shell, ml-artifacts, docs, screenshots).
#
# The zip is produced with `git archive HEAD` — it contains EXACTLY the
# committed tree, so the zip and the GitHub push are byte-identical.
# Excluded by .gitignore/.gitattributes: node_modules, .next, runtime DBs
# (data/sathi.db, web/db/*.db), python caches, build output, captures.
#
# Runs from anywhere (paths resolved from this script's location).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="6.0.0"
OUT="download/sathi-v${VERSION}.zip"

# ---- sanity: clean tree so the zip matches the repo exactly ----
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree not clean — commit or stash first." >&2
  git status --short | head -20 >&2
  exit 1
fi

mkdir -p download
rm -f "$OUT"
git archive --format=zip --prefix="sathi/" -o "$OUT" HEAD

# ---- report ----
FILES=$(unzip -l "$OUT" | tail -1 | awk '{print $2}')
SIZE=$(du -h "$OUT" | cut -f1)
echo "packaged: $OUT ($SIZE, $FILES files)"

# capture the listing ONCE (grepping a file avoids pipefail/SIGPIPE issues)
LISTING=$(mktemp)
unzip -l "$OUT" > "$LISTING"
trap 'rm -f "$LISTING"' EXIT

# ---- spot-verify the template layout inside the zip ----
CHECKS=(
  "sathi/Makefile"
  "sathi/requirements.txt"
  "sathi/sathi_config.py"
  "sathi/api/main.py"
  "sathi/core/money.py"
  "sathi/ml/train.py"
  "sathi/config/fees.yaml"
  "sathi/context/CONTEXT.md"
  "sathi/data/transactions.parquet"
  "sathi/tests/test_core_money.py"
  "sathi/web/package.json"
  "sathi/web/src/app/page.tsx"
  "sathi/web/prisma/schema.prisma"
  "sathi/web/ml-artifacts/forecast/latest.json"
  "sathi/web/tests/sathi-ml.test.ts"
  "sathi/web/android/gradlew"
  "sathi/web/public/demo/garment_worker.json"
  "sathi/.github/workflows/backend-ci.yml"
  "sathi/.github/workflows/app-ci.yml"
  "sathi/.github/workflows/android-apk.yml"
  "sathi/.gitattributes"
  "sathi/LICENSE"
  "sathi/README.md"
  "sathi/docs/HACKATHON_COMPLIANCE.md"
  "sathi/docs/screenshots/ui-01-home.png"
)
MISSING=0
for f in "${CHECKS[@]}"; do
  if ! grep -q " $f\$" "$LISTING"; then
    echo "MISSING: $f" >&2
    MISSING=1
  fi
done
[ "$MISSING" -eq 0 ] && echo "template-layout checklist: ${#CHECKS[@]}/${#CHECKS[@]} present ✓" || exit 1

# ---- junk scan: nothing regenerable/private may ship ----
JUNK=$(grep -cE "node_modules|\.next/|sathi\.db|custom\.db|__pycache__|\.pytest_cache|captures/|\.env$" "$LISTING" || true)
[ "$JUNK" -eq 0 ] && echo "junk scan: clean ✓" || { echo "ERROR: $JUNK junk entries found" >&2; exit 1; }

echo "OK — $OUT is GitHub-upload-ready (identical to the committed tree)."
