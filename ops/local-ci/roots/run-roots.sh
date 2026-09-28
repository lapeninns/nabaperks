#!/usr/bin/env bash
# Run the hosted CI roots locally, as advisory proof before opening or
# updating a PR. Hosted CI remains the merge authority (AGENTS.md); this
# saves hosted minutes by catching failures first.
#
#   ops/local-ci/roots/run-roots.sh <branch> [root ...] [--jobs N] [--dry-run]
#
# Roots: fast coverage quality build a11y visual e2e lighthouse zap db
# (default: all). Browser roots run inside the CI-pinned Playwright image
# (same digest as .github/workflows/ci.yml) on a clean clone of the branch
# (`git clone --local --no-hardlinks` into $LOCAL_CI_WORK/tree-serial,
# tree-slot-<1..N> or tree-host, fetched and reset between tasks), so
# the local checkout's env files and excluded folders never leak in and
# Docker only needs the cache directory shared, not the repository.
# Lighthouse and ZAP build the branch on the host; db starts an isolated
# Supabase stack on its own port range with the Homebrew CLI. Those three
# always run on the host, one after another, after the container roots.
#
# --jobs 1 (the default) runs every container root one after another in a
# single container. --jobs N > 1 gives each container root, each a11y and
# visual shard and each e2e pack its own capped `docker run --rm` (see budget
# below), starts the longest first and runs at most N at once. Before each
# start it measures what other projects' containers use now, so a long run
# waits when another project starts containers and speeds up when they stop.
# --dry-run prints the plan and exits without touching git, Docker or the
# cache.
#
# Every root prints `=== ROOT <name> EXIT <code> ...`; the run ends with a
# per-root wall-time summary and exits non-zero if any root failed.
#
# Requirements: Docker, git, pnpm 10.28, the Homebrew Supabase CLI, jq,
# poppler (pdfinfo) and python3 with opencv-python-headless + pymupdf for
# posters:verify-pdfs.
set -euo pipefail

usage() {
  echo "usage: $0 <branch> [root ...] [--jobs N] [--dry-run]" >&2
  exit 2
}
[ $# -gt 0 ] || usage
BRANCH="$1"; shift
JOBS=1; DRY_RUN=0; ROOTS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --jobs) [ $# -ge 2 ] || usage; JOBS="$2"; shift 2 ;;
    --jobs=*) JOBS="${1#--jobs=}"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    fast|coverage|quality|build|a11y|visual|e2e|lighthouse|zap|db) ROOTS+=("$1"); shift ;;
    *) echo "unknown root or option: $1" >&2; usage ;;
  esac
done
case "$JOBS" in '' | *[!0-9]* | 0*) echo "--jobs needs a positive integer" >&2; usage ;; esac
[ ${#ROOTS[@]} -eq 0 ] && ROOTS=(fast coverage quality build a11y visual e2e lighthouse zap db)

REPO="$(git rev-parse --show-toplevel)"
SOURCE_GIT="$(cd "$REPO" && cd "$(git rev-parse --git-common-dir)" && pwd)"
SHA="$(git -C "$REPO" rev-parse --verify --quiet "$BRANCH^{commit}")" || { echo "unknown branch or commit: $BRANCH" >&2; exit 2; }
IMAGE="$(grep -o 'mcr.microsoft.com/playwright:v[0-9.]*-noble@sha256:[0-9a-f]*' "$REPO/.github/workflows/ci.yml" | head -1)"
WORK="${LOCAL_CI_WORK:-$HOME/.cache/nabaperks-local-ci}"
LOG="$WORK/logs"; CI_DIR="$WORK/ci"; RESULTS="$LOG/results.tsv"
VOLUME_PREFIX="${LOCAL_CI_VOLUME_PREFIX:-nabaperks-local-ci}"
RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
RESERVE_GIB=2
# Every container this script starts carries these labels, so cleanup is
# scoped to this run and never touches other projects' containers. An extra
# label (LOCAL_CI_EXTRA_LABEL, key or key=value) is added to containers and
# to the volumes the script creates.
LABELS=(--label nabaperks.local-ci.roots=run-roots --label "nabaperks.local-ci.run=$RUN_ID")
[ -z "${LOCAL_CI_EXTRA_LABEL:-}" ] || LABELS+=(--label "$LOCAL_CI_EXTRA_LABEL")

wants() { for r in "${ROOTS[@]}"; do [ "$r" = "$1" ] && return 0; done; return 1; }

# Per-container caps for --jobs N: "<cpus> <memory GiB>". Browser work gets
# 8 GiB, the cap under which a sequential pack stays clear of the OOM kill
# described in scripts/ci/run-browser-pack.mjs. Browser work only ever runs
# as one hosted shard or pack per container (a11y and visual 1/4, e2e packs):
# unsharded Playwright against one dev server runs out of heap. Visual shards
# peaked at 2.7 GiB (chromium) and 3.8 GiB (mobile-safari) in a local
# --jobs 3 run on 2026-09-28 (docker stats every 3s).
budget() {
  case "$1" in
    fast | coverage | build) echo "4 8" ;;
    quality) echo "2 6" ;;
    *) echo "2 8" ;;
  esac
}
# Expected seconds, used only to start the longest work first. e2e packs and
# visual shards are hosted median test-step times sampled on 2026-09-28
# (mobile-safari's late e2e packs are the hosted critical path; visual from
# the last six green runs); fast and quality are local root times from the
# same day (32-39s and 6-10s); a11y, build and coverage are estimates from
# hosted machine time.
estimate() {
  case "$1" in
    visual-chromium-1) echo 35 ;; visual-chromium-2) echo 36 ;;
    visual-chromium-3) echo 36 ;; visual-chromium-4) echo 30 ;;
    visual-mobile-safari-1) echo 43 ;; visual-mobile-safari-2) echo 28 ;;
    visual-mobile-safari-3) echo 36 ;; visual-mobile-safari-4) echo 26 ;;
    e2e-mobile-safari-1) echo 277 ;; e2e-mobile-safari-2) echo 397 ;;
    e2e-mobile-safari-3) echo 419 ;; e2e-mobile-safari-4) echo 448 ;;
    e2e-desktop-firefox-1) echo 381 ;; e2e-desktop-firefox-2) echo 307 ;;
    e2e-desktop-firefox-3) echo 319 ;; e2e-desktop-firefox-4) echo 230 ;;
    e2e-desktop-safari-1) echo 344 ;; e2e-desktop-safari-2) echo 238 ;;
    e2e-desktop-safari-3) echo 316 ;; e2e-desktop-safari-4) echo 223 ;;
    e2e-chromium-1) echo 332 ;; e2e-chromium-2) echo 263 ;;
    e2e-chromium-3) echo 294 ;; e2e-chromium-4) echo 182 ;;
    a11y-*) echo 150 ;; build) echo 150 ;; coverage) echo 100 ;;
    fast) echo 40 ;; quality) echo 10 ;; *) echo 60 ;;
  esac
}

CONTAINER_ROOTS=()
for r in fast coverage quality build a11y visual e2e; do wants "$r" && CONTAINER_ROOTS+=("$r"); done
HOST_ROOTS=()
for r in lighthouse zap db; do wants "$r" && HOST_ROOTS+=("$r"); done
# One task per hosted job: a11y and visual split into their 8 shards each
# and e2e into its 16 packs, as in ci.yml. Printed as "<estimate> <task>".
expand_tasks() {
  local r p n
  for r in "${CONTAINER_ROOTS[@]}"; do
    case "$r" in
      a11y | visual) for p in chromium mobile-safari; do for n in 1 2 3 4; do echo "$(estimate "$r-$p-$n") $r-$p-$n"; done; done ;;
      e2e) for p in chromium mobile-safari desktop-firefox desktop-safari; do for n in 1 2 3 4; do echo "$(estimate "e2e-$p-$n") e2e-$p-$n"; done; done ;;
      *) echo "$(estimate "$r") $r" ;;
    esac
  done
}
TASKS=()
if [ "$JOBS" -gt 1 ] && [ ${#CONTAINER_ROOTS[@]} -gt 0 ]; then
  while read -r _ task; do TASKS+=("$task"); done < <(expand_tasks | sort -s -k1,1nr)
fi

# Sets MOUNTS: the only host paths a root container sees, both under $WORK,
# plus named volumes for node_modules and the shared pnpm store.
mounts() { # <tree> <node_modules volume>
  MOUNTS=(-v "$1:/work" -v "$CI_DIR:/ci:ro" -v "$2:/work/node_modules"
    -v "$VOLUME_PREFIX-pnpm-store:/root/.local/share/pnpm/store")
}

if [ "$DRY_RUN" = 1 ]; then
  echo "commit $SHA; image $IMAGE; work $WORK"
  if [ ${#CONTAINER_ROOTS[@]} -gt 0 ] && [ "$JOBS" = 1 ]; then
    echo "serial: one container runs ${CONTAINER_ROOTS[*]}"
    mounts "$WORK/tree-serial" "$VOLUME_PREFIX-node-modules"; echo "  mounts: ${MOUNTS[*]}"
  elif [ ${#TASKS[@]} -gt 0 ]; then
    echo "parallel: ${#TASKS[@]} containers, at most $JOBS at once, longest first"
    for task in "${TASKS[@]}"; do
      read -r cpus mem <<<"$(budget "$task")"
      echo "  task $task cpus=$cpus memory=${mem}g estimate=$(estimate "$task")s"
    done
    mounts "$WORK/tree-slot-<slot>" "$VOLUME_PREFIX-node-modules-<slot>"; echo "  mounts: ${MOUNTS[*]}"
  fi
  [ ${#HOST_ROOTS[@]} -eq 0 ] || echo "host, serial: ${HOST_ROOTS[*]}"
  exit 0
fi

mkdir -p "$LOG" "$CI_DIR"; : >"$RESULTS"
# The workflow's synthetic env (root block + job-level fixtures), never real secrets.
node "$REPO/ops/local-ci/roots/workflow-env.mjs" "$REPO/.github/workflows/ci.yml" >"$CI_DIR/env.sh"
cp "$REPO/ops/local-ci/roots/container-roots.sh" "$CI_DIR/container-roots.sh"

# Only live children of this run: finish_slot clears a slot's PID as soon as
# it reaps it, so an exit never signals a PID the OS may have reused.
SLOT_PID=()
cleanup() {
  local pid
  for pid in ${SLOT_PID[@]+"${SLOT_PID[@]}"}; do [ -z "$pid" ] || kill "$pid" 2>/dev/null || true; done
  local ids
  ids="$(docker ps -aq --filter "label=nabaperks.local-ci.run=$RUN_ID" 2>/dev/null || true)"
  # shellcheck disable=SC2086 # one container id per word
  [ -z "$ids" ] || docker rm -f $ids >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# <name> <exit> <root seconds> [<container wall seconds>]
record() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "${4:--}" >>"$RESULTS"; }
report() { echo "=== ROOT $1 EXIT $2 $(date +%T) ${3}s"; record "$1" "$2" "$3"; }
# Records the `=== ROOT x EXIT n hh:mm:ss Ns` lines of one container log;
# fails when the log holds none.
record_log() { # <log> [<container wall seconds>]
  local found=1 name rc secs
  while read -r name rc secs; do
    record "$name" "$rc" "${secs%s}" "${2:-}"; found=0
  done < <(awk '$1 == "===" && $2 == "ROOT" && $4 == "EXIT" { print $3, $5, ($7 == "" ? "?" : $7) }' "$1")
  return $found
}

prepare_tree() { # <dir>: a clean detached checkout of $SHA, cloned once, then fetched
  local tree="$1"
  if ! { [ -d "$tree/.git" ] && git -C "$tree" fetch -q --no-tags "$SOURCE_GIT" "$SHA" 2>/dev/null; }; then
    rm -rf "$tree"
    git clone -q --local --no-hardlinks --no-checkout "$SOURCE_GIT" "$tree" || return 1
  fi
  git -C "$tree" checkout -q --force --detach "$SHA" || return 1
  git -C "$tree" clean -q -ffdx
}

ensure_volume() {
  docker volume inspect "$1" >/dev/null 2>&1 && return 0
  docker volume create --label nabaperks.local-ci.roots=cache \
    ${LOCAL_CI_EXTRA_LABEL:+--label "$LOCAL_CI_EXTRA_LABEL"} "$1" >/dev/null
}

# GiB of the Docker VM this run may commit, measured now: total memory minus
# what other projects' running containers use minus a small reserve. This
# run's own containers are left out because their caps are counted in USED.
available_gib() {
  local total own used
  total="$(docker info --format '{{.MemTotal}}')" || return 1
  # Space-separated: BSD awk (macOS) rejects a -v value holding newlines.
  own="$(docker ps -q --filter "label=nabaperks.local-ci.run=$RUN_ID" | tr '\n' ' ')" || return 1
  used="$(docker stats --no-stream --format '{{.ID}} {{.MemUsage}}' | awk -v own="$own" '
    BEGIN { n = split(own, ids, " "); for (i = 1; i <= n; i++) mine[ids[i]] = 1 }
    ($1 in mine) { next }
    { v = $2; b = v + 0; u = v; sub(/^[0-9.]+/, "", u)
      m = (u == "KiB" || u == "kB") ? 1024 : (u == "MiB" || u == "MB") ? 1048576 : (u == "GiB" || u == "GB") ? 1073741824 : (u == "TiB") ? 1099511627776 : 1
      s += b * m }
    END { printf "%d", s }')" || return 1
  echo $(((total - used) / 1073741824 - RESERVE_GIB))
}

START=$SECONDS
SECTION_FAILED=0
if [ ${#CONTAINER_ROOTS[@]} -gt 0 ]; then
  docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE" >/dev/null
  ensure_volume "$VOLUME_PREFIX-pnpm-store"
fi

if [ ${#CONTAINER_ROOTS[@]} -gt 0 ] && [ "$JOBS" = 1 ]; then
  TREE="$WORK/tree-serial"
  ensure_volume "$VOLUME_PREFIX-node-modules"
  prepare_tree "$TREE"
  rc=0; mounts "$TREE" "$VOLUME_PREFIX-node-modules"
  docker run --rm --init --ipc=host "${LABELS[@]}" --name "nabaperks-roots-$RUN_ID" "${MOUNTS[@]}" \
    -w /work "$IMAGE" bash /ci/container-roots.sh "${CONTAINER_ROOTS[@]}" 2>&1 | tee "$LOG/container.log" || rc=$?
  record_log "$LOG/container.log" || { [ "$rc" != 0 ] || rc=1; }
  grep -q '^=== ALL DONE' "$LOG/container.log" || { [ "$rc" != 0 ] || rc=1; }
  [ "$rc" = 0 ] || record container "$rc" "?"
fi

if [ ${#TASKS[@]} -gt 0 ]; then
  echo "=== PARALLEL ${#TASKS[@]} containers, $JOBS slots; logs in $LOG/<task>.log"
  SLOT_PID=(); SLOT_TASK=(); SLOT_START=(); SLOT_MEM=()
  for ((s = 1; s <= JOBS; s++)); do
    SLOT_PID[s]=""; SLOT_TASK[s]=""; SLOT_START[s]=0; SLOT_MEM[s]=0
    ensure_volume "$VOLUME_PREFIX-node-modules-$s"
  done
  # One clone per slot, reset between tasks, so the cache holds at most N
  # clones however many tasks run.
  run_task() { # <slot> <task> <cpus> <memory GiB>
    local tree="$WORK/tree-slot-$1"
    prepare_tree "$tree" || return 125
    mounts "$tree" "$VOLUME_PREFIX-node-modules-$1"
    docker run --rm --init --ipc=host "${LABELS[@]}" --name "nabaperks-roots-$RUN_ID-$2" \
      --cpus "$3" --memory "${4}g" --memory-swap "${4}g" "${MOUNTS[@]}" \
      -w /work "$IMAGE" bash /ci/container-roots.sh "$2"
  }
  finish_slot() { # <slot>
    local s="$1" task="${SLOT_TASK[$1]}" rc wall
    wait "${SLOT_PID[$s]}" 2>/dev/null || true
    SLOT_PID[s]=""
    rc="$(cat "$LOG/$task.rc")"; wall=$((SECONDS - SLOT_START[s]))
    grep '^=== ROOT .* EXIT ' "$LOG/$task.log" || true
    record_log "$LOG/$task.log" "$wall" || { [ "$rc" != 0 ] || rc=1; }
    grep -q '^=== ALL DONE' "$LOG/$task.log" || { [ "$rc" != 0 ] || rc=1; }
    [ "$rc" = 0 ] || record "$task(container)" "$rc" "?" "$wall"
    if [ "$rc" != 0 ] || grep -q '^=== ROOT .* EXIT [1-9]' "$LOG/$task.log"; then
      echo "--- $task failed (container exit $rc after ${wall}s); last lines of $LOG/$task.log:"; tail -n 20 "$LOG/$task.log"
    fi
    USED=$((USED - SLOT_MEM[s])); RUNNING=$((RUNNING - 1))
    SLOT_TASK[s]=""
  }
  NEXT=0; RUNNING=0; USED=0
  while [ "$NEXT" -lt ${#TASKS[@]} ] || [ "$RUNNING" -gt 0 ]; do
    for ((s = 1; s <= JOBS; s++)); do
      if [ -n "${SLOT_PID[s]}" ] && [ -f "$LOG/${SLOT_TASK[s]}.rc" ]; then finish_slot "$s"; fi
    done
    for ((s = 1; s <= JOBS; s++)); do
      [ -z "${SLOT_PID[s]}" ] || continue
      [ "$NEXT" -lt ${#TASKS[@]} ] || break
      task="${TASKS[NEXT]}"; read -r cpus mem <<<"$(budget "$task")"
      # Admit by memory cap against headroom measured now, so containers
      # other projects start or stop during a long run count: wait for a
      # running root to finish rather than oversubscribe, but never refuse
      # the only root. An unreadable Docker counts as no headroom.
      AVAIL="$(available_gib)" || AVAIL=0
      if [ "$RUNNING" -gt 0 ] && [ $((USED + mem)) -gt "$AVAIL" ]; then break; fi
      rm -f "$LOG/$task.rc"
      echo "=== START $task slot $s cpus=$cpus memory=${mem}g running=$RUNNING committed=${USED}g admissible=${AVAIL}g $(date +%T)"
      (
        trap - EXIT INT TERM; rc=0
        run_task "$s" "$task" "$cpus" "$mem" >"$LOG/$task.log" 2>&1 || rc=$?
        echo "$rc" >"$LOG/$task.rc"
      ) &
      SLOT_PID[s]=$!; SLOT_TASK[s]="$task"; SLOT_START[s]=$SECONDS; SLOT_MEM[s]=$mem
      USED=$((USED + mem)); RUNNING=$((RUNNING + 1)); NEXT=$((NEXT + 1))
    done
    [ "$RUNNING" -eq 0 ] || sleep 2
  done
fi

if wants lighthouse || wants zap; then
  HOST_TREE="$WORK/tree-host"
  prepare_tree "$HOST_TREE"
  ( set +eu; source "$CI_DIR/env.sh"; unset CUSTOMER_DEV_OTP_CODE
    cd "$HOST_TREE" || exit 1; [ -e node_modules ] || ln -s "$REPO/node_modules" node_modules
    eval "$(node scripts/generate-ci-vapid-env.mjs | sed 's/^/export /')"
    t=$SECONDS; pnpm build >/dev/null; report build-host $? $((SECONDS - t))
    if wants lighthouse; then t=$SECONDS; pnpm lighthouse >/dev/null 2>&1; report lighthouse $? $((SECONDS - t)); fi
    if wants zap; then
      t=$SECONDS
      PORT=3000 pnpm start >"$LOG/zap-server.log" 2>&1 & S=$!
      for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:3000 >/dev/null && break; sleep 2; done
      docker run --rm "${LABELS[@]}" -v "$HOST_TREE/.zap":/zap/wrk:ro ghcr.io/zaproxy/zaproxy:stable \
        zap-baseline.py -t http://host.docker.internal:3000 -c rules.tsv -I | tail -3; report zap "${PIPESTATUS[0]}" $((SECONDS - t))
      kill $S 2>/dev/null || true
    fi
  ) 2>&1 | tee "$LOG/host.log" || SECTION_FAILED=1
fi

if wants db; then
  HOST_TREE="$WORK/tree-host"
  wants lighthouse || wants zap || prepare_tree "$HOST_TREE"
  ( set +eu; source "$CI_DIR/env.sh"
    DBWORK="$WORK/dbwork"; CONFIG="$DBWORK/supabase/config.toml"
    export SUPABASE_SEND_EMAIL_HOOK_SECRET="v1,whsec_dGVzdF9zdXBhYmFzZV9ob29rX3NlY3JldF8zMl9ieXRlcw=="
    export SUPABASE_SEND_EMAIL_HOOK_URI="http://host.docker.internal:3147/api/auth/hooks/send-email"
    export SUPABASE_DB_URL="postgres://postgres:postgres@127.0.0.1:55722/postgres"
    SUPA="${SUPABASE_CLI:-/opt/homebrew/bin/supabase}"
    # Every setup step must succeed, or the seed and tests could pass against
    # a stack still listening on the 557xx ports from an earlier candidate.
    # The rewrite is checked (sed succeeds when nothing matches), and any
    # stack left under this project id is removed before the fresh start.
    db_setup() {
      rm -rf "$DBWORK" && mkdir -p "$DBWORK" && cp -R "$HOST_TREE/supabase" "$DBWORK/supabase" &&
        sed -i.bak -e 's/^project_id = .*/project_id = "nabaperks_local_ci"/' -e 's/port = 543\([0-9][0-9]\)/port = 557\1/' "$CONFIG" &&
        grep -q '^project_id = "nabaperks_local_ci"$' "$CONFIG" && grep -q '^port = 55722$' "$CONFIG" &&
        ! grep -q '^[^#]*port = 543' "$CONFIG" &&
        cd "$HOST_TREE" && { [ -e node_modules ] || ln -s "$REPO/node_modules" node_modules; } || return 1
      "$SUPA" stop --workdir "$DBWORK" --no-backup >/dev/null 2>&1
      "$SUPA" start --workdir "$DBWORK" -x studio,imgproxy,edge-runtime,logflare,vector,supavisor >/dev/null
    }
    t=$SECONDS; db_setup; rc=$?; report db-setup "$rc" $((SECONDS - t))
    if [ "$rc" = 0 ]; then
      t=$SECONDS; pnpm db:seed >/dev/null; report db-seed $? $((SECONDS - t))
      t=$SECONDS; pnpm test:db 2>&1 | grep -E "^# (pass|fail)"; report db-test "${PIPESTATUS[0]}" $((SECONDS - t))
    else
      echo "--- db setup failed (exit $rc): seed and tests skipped"
    fi
    [ ! -f "$CONFIG" ] || "$SUPA" stop --workdir "$DBWORK" --no-backup >/dev/null
  ) 2>&1 | tee "$LOG/db.log" || SECTION_FAILED=1
fi

FAILED="$(awk -F '\t' '$2 != "0"' "$RESULTS" | wc -l | tr -d ' ')"
echo "=== SUMMARY jobs=$JOBS wall=$((SECONDS - START))s failed=$FAILED"
printf '%-28s %5s %8s %10s\n' root exit root_s container_s
awk -F '\t' '{ printf "%-28s %5s %8s %10s\n", $1, $2, $3, $4 }' "$RESULTS"
echo "Logs: $LOG"
[ "$FAILED" = 0 ] && [ "$SECTION_FAILED" = 0 ]
