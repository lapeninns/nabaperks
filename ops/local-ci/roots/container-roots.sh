#!/usr/bin/env bash
# Runs inside the CI-pinned Playwright image on a clean clone at /work.
# Mirrors config/ci-workloads.json and the browser jobs' env; visual stays
# on the headless shell channel, e2e and a11y use regular Chromium.
#
# Arguments are whole roots (fast coverage quality build a11y visual e2e)
# or, for run-roots.sh --jobs N, one accessibility shard or e2e pack each:
# a11y-<project>-<1-4> is shard n/4 and e2e-<project>-<1-4> is pack n of
# scripts/ci/run-browser-pack.mjs, exactly as the hosted matrix splits them.
set +H
source /ci/env.sh
git config --global --add safe.directory '*'
corepack enable >/dev/null 2>&1; corepack prepare pnpm@10.28.0 --activate >/dev/null 2>&1
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq jq poppler-utils imagemagick >/dev/null 2>&1
pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1
eval "$(node scripts/generate-ci-vapid-env.mjs | sed 's/^/export /')" 2>/dev/null || true
rm -rf .next-e2e .next-e2e-* test-results playwright-report coverage reports/jscpd
root() {
  local name="$1" start=$SECONDS rc; shift
  echo "=== ROOT $name START $(date +%T)"; "$@"; rc=$?
  echo "=== ROOT $name EXIT $rc $(date +%T) $((SECONDS - start))s"
}
a11y_shard() ( export PLAYWRIGHT_REGULAR_CHROMIUM=1 CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
  root "a11y-$1-$2" node scripts/ci/browser-workload.mjs hosted test:a11y --project="$1" --shard="$2" )
e2e_pack() ( export PLAYWRIGHT_REGULAR_CHROMIUM=1 CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
  root "e2e-$1-$2" node scripts/ci/run-browser-pack.mjs "$1" "$2" "/tmp/packs-$1-$2" )
for r in "$@"; do
  case "$r" in
    fast|coverage|quality|build) ( unset CUSTOMER_DEV_OTP_CODE PLAYWRIGHT_REGULAR_CHROMIUM; root "$r" node scripts/ci/run-workload.mjs "$r" ) ;;
    a11y) for project in chromium mobile-safari; do for shard in 1 2 3 4; do a11y_shard "$project" "$shard/4"; done; done ;;
    a11y-chromium-[1-4]|a11y-mobile-safari-[1-4]) project="${r#a11y-}"; a11y_shard "${project%-*}" "${r##*-}/4" ;;
    visual) ( unset PLAYWRIGHT_REGULAR_CHROMIUM; export CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
              root visual pnpm test:visual -- --project=chromium --project=mobile-safari --reporter=line ) ;;
    e2e) for project in chromium mobile-safari desktop-firefox desktop-safari; do for pack in 1 2 3 4; do e2e_pack "$project" "$pack"; done; done ;;
    e2e-chromium-[1-4]|e2e-mobile-safari-[1-4]|e2e-desktop-firefox-[1-4]|e2e-desktop-safari-[1-4])
      project="${r#e2e-}"; e2e_pack "${project%-*}" "${r##*-}" ;;
    *) echo "=== ROOT $r EXIT 2 $(date +%T) 0s (unknown root)" ;;
  esac
done
echo "=== ALL DONE"
