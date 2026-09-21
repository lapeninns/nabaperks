#!/usr/bin/env bash
# Runs inside the CI-pinned Playwright image on a clean worktree at /work.
# Mirrors config/ci-workloads.json and the browser jobs' env; visual stays
# on the headless shell channel, e2e and a11y use regular Chromium.
set +H
source /ci/env.sh
git config --global --add safe.directory '*'
corepack enable >/dev/null 2>&1; corepack prepare pnpm@10.28.0 --activate >/dev/null 2>&1
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq jq poppler-utils imagemagick >/dev/null 2>&1
pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1
eval "$(node scripts/generate-ci-vapid-env.mjs | sed 's/^/export /')" 2>/dev/null || true
rm -rf .next-e2e .next-e2e-* test-results playwright-report coverage reports/jscpd
root() { local name="$1"; shift; echo "=== ROOT $name START $(date +%T)"; "$@"; local rc=$?; echo "=== ROOT $name EXIT $rc $(date +%T)"; }
for r in "$@"; do
  case "$r" in
    fast|coverage|quality|build) ( unset CUSTOMER_DEV_OTP_CODE PLAYWRIGHT_REGULAR_CHROMIUM; root "$r" node scripts/ci/run-workload.mjs "$r" ) ;;
    a11y) ( export PLAYWRIGHT_REGULAR_CHROMIUM=1 CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
            for project in chromium mobile-safari; do for shard in 1/4 2/4 3/4 4/4; do
              root "a11y-$project-$shard" node scripts/ci/browser-workload.mjs hosted test:a11y --project=$project --shard=$shard; done; done ) ;;
    visual) ( unset PLAYWRIGHT_REGULAR_CHROMIUM; export CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
              root visual pnpm test:visual -- --project=chromium --project=mobile-safari --reporter=line ) ;;
    e2e) ( export PLAYWRIGHT_REGULAR_CHROMIUM=1 CUSTOMER_DEV_OTP_CODE=424242 PLAYWRIGHT_WORKERS=1
           for project in chromium mobile-safari desktop-firefox desktop-safari; do for pack in 1 2 3 4; do
             root "e2e-$project-$pack" node scripts/ci/run-browser-pack.mjs "$project" "$pack" "/tmp/packs-$project-$pack"; done; done ) ;;
  esac
done
echo "=== ALL DONE"
