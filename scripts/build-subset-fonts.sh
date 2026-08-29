#!/usr/bin/env bash
# Regenerate the two subset web fonts.
#
# Medium and ExtraBold are the faces this branch ADDED, and the only ones
# `poster-font-assets` does not SHA-256-pin, so they are the only ones we may
# reshape. Regular and Bold stay full .ttf for PDF parity.
#
# Subsetting them took /loyalty-for-pubs from ~5,019ms LCP to ~3,768ms (3 runs
# each), which is what moved all three budgeted routes back inside the
# Lighthouse budget. Without this script those .woff2 files are unexplained
# binaries; with it they are reproducible.
#
#   uv pip install fonttools brotli   # or pip install
#   bash scripts/build-subset-fonts.sh
set -euo pipefail

# Latin + Latin-1 + Latin Extended-A/B + COMBINING MARKS + punctuation,
# currency, letterlike, arrows, maths. Combining marks are deliberate: venue
# names are user-generated and may arrive decomposed rather than precomposed.
UNICODES="U+0000-036F,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF"

# tnum: `.numeric-tabular` in globals.css. kern: everything.
# mark/mkmk: positioning for the combining marks above.
FEATURES="tnum,lnum,pnum,case,frac,sups,subs,ccmp,mark,mkmk"

for FACE in Medium ExtraBold; do
  SRC="assets/fonts/BricolageGrotesque-${FACE}.ttf"
  OUT="assets/fonts/BricolageGrotesque-${FACE}.woff2"
  python3 -m fontTools.subset "$SRC" \
    --unicodes="$UNICODES" \
    --layout-features+="$FEATURES" \
    --flavor=woff2 \
    --output-file="$OUT"
  printf '%-10s %8s bytes\n' "$FACE" "$(wc -c < "$OUT" | tr -d ' ')"
done
