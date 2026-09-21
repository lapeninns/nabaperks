#!/usr/bin/env bash
# Run the hosted CI roots locally, as advisory proof before opening or
# updating a PR. Hosted CI remains the merge authority (AGENTS.md); this
# saves hosted minutes by catching failures first.
#
#   ops/local-ci/roots/run-roots.sh <branch> [root ...]
#
# Roots: fast coverage quality build a11y visual e2e lighthouse zap db
# (default: all). Browser roots run inside the CI-pinned Playwright image
# (same digest as .github/workflows/ci.yml) on a clean git worktree of the
# branch, so the local checkout's env files and excluded folders never
# leak in. Lighthouse and ZAP build the branch on the host; db starts an
# isolated Supabase stack on its own port range with the Homebrew CLI.
#
# Requirements: Docker, git, pnpm 10.28, the Homebrew Supabase CLI, jq,
# poppler (pdfinfo) and python3 with opencv-python-headless + pymupdf for
# posters:verify-pdfs.
set -euo pipefail

BRANCH="${1:?branch}"; shift || true
ROOTS=("$@"); [ ${#ROOTS[@]} -eq 0 ] && ROOTS=(fast coverage quality build a11y visual e2e lighthouse zap db)
REPO="$(git rev-parse --show-toplevel)"
IMAGE="$(grep -o 'mcr.microsoft.com/playwright:v[0-9.]*-noble@sha256:[0-9a-f]*' "$REPO/.github/workflows/ci.yml" | head -1)"
WORK="${LOCAL_CI_WORK:-$HOME/.cache/nabaperks-local-ci}"
TREE="$WORK/tree"; LOG="$WORK/logs"; mkdir -p "$WORK" "$LOG"
ENV_FILE="$WORK/env.sh"

# The workflow's synthetic env (root block + job-level fixtures), never real secrets.
node "$REPO/ops/local-ci/roots/workflow-env.mjs" "$REPO/.github/workflows/ci.yml" > "$ENV_FILE"

git -C "$REPO" worktree remove --force "$TREE" 2>/dev/null || true
git -C "$REPO" worktree add -f "$TREE" "$BRANCH" >/dev/null

wants() { for r in "${ROOTS[@]}"; do [ "$r" = "$1" ] && return 0; done; return 1; }
report() { echo "=== ROOT $1 EXIT $2"; }

CONTAINER_ROOTS=()
for r in fast coverage quality build a11y visual e2e; do wants "$r" && CONTAINER_ROOTS+=("$r"); done
if [ ${#CONTAINER_ROOTS[@]} -gt 0 ]; then
  docker run --rm --ipc=host \
    -v "$TREE":/work -v "$REPO/.git":"$REPO/.git" -v "$ENV_FILE":/ci/env.sh:ro \
    -v "$REPO/ops/local-ci/roots/container-roots.sh":/ci/container-roots.sh:ro \
    -v nabaperks-local-ci-node-modules:/work/node_modules \
    -v nabaperks-local-ci-pnpm-store:/root/.local/share/pnpm/store \
    -w /work "$IMAGE" bash /ci/container-roots.sh "${CONTAINER_ROOTS[@]}" 2>&1 | tee "$LOG/container.log"
fi

if wants lighthouse || wants zap; then
  ( set +u; source "$ENV_FILE"; unset CUSTOMER_DEV_OTP_CODE
    cd "$TREE"; [ -e node_modules ] || ln -s "$REPO/node_modules" node_modules
    eval "$(node scripts/generate-ci-vapid-env.mjs | sed 's/^/export /')"
    pnpm build >/dev/null; report build-host $?
    if wants lighthouse; then pnpm lighthouse >/dev/null 2>&1; report lighthouse $?; fi
    if wants zap; then
      PORT=3000 pnpm start >"$LOG/zap-server.log" 2>&1 & S=$!
      for i in $(seq 1 60); do curl -fsS http://127.0.0.1:3000 >/dev/null && break; sleep 2; done
      docker run --rm -v "$TREE/.zap":/zap/wrk:ro ghcr.io/zaproxy/zaproxy:stable \
        zap-baseline.py -t http://host.docker.internal:3000 -c rules.tsv -I | tail -3; report zap $?
      kill $S 2>/dev/null || true
    fi
  ) 2>&1 | tee "$LOG/host.log"
fi

if wants db; then
  ( set +u; source "$ENV_FILE"
    DBWORK="$WORK/dbwork"; rm -rf "$DBWORK"; mkdir -p "$DBWORK"; cp -R "$TREE/supabase" "$DBWORK/supabase"
    sed -i.bak -e 's/^project_id = .*/project_id = "nabaperks_local_ci"/' -e 's/port = 543\([0-9][0-9]\)/port = 557\1/' "$DBWORK/supabase/config.toml"
    export SUPABASE_SEND_EMAIL_HOOK_SECRET="v1,whsec_dGVzdF9zdXBhYmFzZV9ob29rX3NlY3JldF8zMl9ieXRlcw=="
    export SUPABASE_SEND_EMAIL_HOOK_URI="http://host.docker.internal:3147/api/auth/hooks/send-email"
    export SUPABASE_DB_URL="postgres://postgres:postgres@127.0.0.1:55722/postgres"
    SUPA="${SUPABASE_CLI:-/opt/homebrew/bin/supabase}"
    cd "$TREE"; [ -e node_modules ] || ln -s "$REPO/node_modules" node_modules
    "$SUPA" start --workdir "$DBWORK" -x studio,imgproxy,edge-runtime,logflare,vector,supavisor >/dev/null
    pnpm db:seed >/dev/null; report db-seed $?
    pnpm test:db 2>&1 | grep -E "^# (pass|fail)"; report db-test "${PIPESTATUS[0]}"
    "$SUPA" stop --workdir "$DBWORK" --no-backup >/dev/null
  ) 2>&1 | tee "$LOG/db.log"
fi
echo "Logs: $LOG"
