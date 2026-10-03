#!/usr/bin/env bash
# Package the final GitHub-ready zip: sathi-v5.0.0.zip
# Production-only tree: the Next.js app (runtime, serves ml-artifacts/),
# the ml/ offline Python factory, the Android shell, docs + tests.
# Excludes: reference material, sandbox tooling, runtime DBs, build output.
#
# Runs from anywhere (paths resolved from this script's location).
# NOTE: docs/screenshots are copied from download/ui-*.png when present
# (maintainer's machine); without them the zip is still complete — the
# screenshots are documentation-only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGE=$(mktemp -d /tmp/sathi-stage-XXXXXX)
mkdir -p "$STAGE/sathi"

# ---- app source + config + license ----
cp -r src prisma public android .github docs tests scripts "$STAGE/sathi/"
cp README.md LICENSE package.json bun.lock tsconfig.json next.config.ts tailwind.config.ts \
   postcss.config.mjs components.json eslint.config.mjs .env.example .gitignore \
   capacitor.config.json "$STAGE/sathi/"
mkdir -p "$STAGE/sathi/db" && touch "$STAGE/sathi/db/.gitkeep"

# ---- model artifacts (trained boosters, served by the TS app) ----
cp -r ml-artifacts "$STAGE/sathi/"

# ---- UI screenshots (hackathon documentation; maintainer machine only) ----
if ls download/ui-*.png >/dev/null 2>&1; then
  mkdir -p "$STAGE/sathi/docs/screenshots"
  cp download/ui-*.png "$STAGE/sathi/docs/screenshots/"
else
  echo "NOTE: download/ui-*.png not found — skipping screenshot copy (docs-only)"
fi

# ---- the offline Python ML pipeline (ml/) ----
cp -r ml "$STAGE/sathi/"
# non-production reference material / agent configs / stale nested CI (belt & braces:
# these are not in the working tree anymore either)
rm -rf "$STAGE/sathi/ml/context" "$STAGE/sathi/ml/CLAUDE.md" \
       "$STAGE/sathi/ml/.github" "$STAGE/sathi/ml/.claude"
# runtime / cache artifacts (regenerated on demand)
rm -rf "$STAGE/sathi/ml/data/sathi.db"
rm -rf "$STAGE/sathi/ml/tmp"
rm -rf "$STAGE/sathi/ml/.pytest_cache"
find "$STAGE/sathi/ml" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$STAGE/sathi/ml" -name "*.pyc" -delete 2>/dev/null || true
find "$STAGE/sathi/ml" -name "*.db" -delete 2>/dev/null || true

# ---- runtime/junk exclusions ----
rm -rf "$STAGE/sathi/public/demo" 2>/dev/null || true   # noop if absent
mkdir -p "$STAGE/sathi/public/demo"
cp public/demo/*.json "$STAGE/sathi/public/demo/" 2>/dev/null || true
# verification capture intermediates (not needed in the repo)
rm -rf "$STAGE/sathi/scripts/diagrams/captures"

# sanity: no node_modules / .next / .git anywhere
find "$STAGE/sathi" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$STAGE/sathi" -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
find "$STAGE/sathi" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
rm -f "$STAGE/sathi/next-env.d.ts" "$STAGE/sathi/tsconfig.tsbuildinfo"

echo "---- staged tree (top level) ----"
ls -la "$STAGE/sathi/"
echo "---- sizes ----"
du -sh "$STAGE/sathi"/* | sort -rh | head -12

OUT="$ROOT/download/sathi-v5.0.0.zip"
rm -f "$OUT"
(cd "$STAGE" && zip -r -q "$OUT" sathi)
echo "---- zip created ----"
ls -la "$OUT"
unzip -l "$OUT" | tail -3
rm -rf "$STAGE"
