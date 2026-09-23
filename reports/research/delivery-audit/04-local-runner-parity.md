# 04 — Local-versus-hosted CI runner parity audit

Read-only audit, 2026-09-21. Repo: `lapeninns/nabaperks` (public), local checkout at
`/Users/amankumarshrestha/LapenInns Project/platform/naba-perks`, branch `codex/console-l8-sweep`,
HEAD `1919a3df`, 32 commits ahead of `origin/main`.

**Branch-divergence note:** every file this audit cites is byte-identical to `origin/main`
(verified: `git diff origin/main HEAD -- <file>` = 0 lines for `docs/operations/local-ci.md`,
`ops/local-ci/roots/*`, `ops/local-ci/profiles/pr.json`, `config/local-ci-contract.json`,
`.github/workflows/ci.yml`, `local-ci-shadow.yml`, `nightly-proof.yml`, `scripts/ci/{run-,}browser-pack.mjs`).
The `roots/` scripts exist on both sides (added on both tips relative to the merge base), so all
citations below are valid against the local tree and there is no HEAD-vs-main divergence to flag
for the audited surface.

There are **two local execution planes**, which must not be conflated:

1. **The roots runner** — `ops/local-ci/roots/run-roots.sh` (advisory, developer-invoked, host
   Docker, uses the _hosted_ Playwright image digest). This is the plane the task's
   `container-roots.sh` / `workflow-env.mjs` belong to.
2. **The watch agent** — `ops/local-ci/agent/main.mjs` under launchd, using its own built image
   `nabaperks-ci-job:<sha>` (`ops/local-ci/image/Dockerfile`) inside the Lima VM, executing the
   `pr` / `main` / `nightly` profile lanes and publishing GitHub check runs via the App.

---

## 1. Parity dimension by dimension

### 1.1 Runner container image and digest pinning

- **Hosted browser tiers** (e2e, a11y, targeted-browser) run in
  `mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e` —
  immutable digest, same image in all three jobs (`.github/workflows/ci.yml:152`, `:443`, `:508`).
  Hosted `fast/quality/build/lighthouse/zap-baseline/db` run bare `ubuntu-latest` runners.
- **Roots runner**: `run-roots.sh:23` greps the same digest out of `ci.yml` (`grep -o
'mcr.microsoft.com/playwright:v...-noble@sha256:...'`), so browser roots run in the exact hosted
  digest. Launch runs `docker run --rm --ipc=host` with a clean git worktree mounted at `/work`,
  the repo `.git` mounted read-only, a generated env file, and shared `node_modules` / pnpm-store
  volumes (`run-roots.sh:40-46`). Hosted adds `--init --user 1001`; the roots run does not
  (`ci.yml:153` vs `run-roots.sh:40`), so it executes as root inside the container.
- **Watch agent**: requires an explicitly pinned image via `LOCAL_CI_JOB_IMAGE`
  (`ops/local-ci/README.md` "Running it"; `agent/container.mjs:547` refuses any image not pinned
  to an explicit tag or digest, "latest" is refused). The image is its own Ubuntu 24.04 build
  (`ops/local-ci/image/Dockerfile`), **not** the Playwright image; browsers are baked via
  `playwright@1.62.1 install --with-deps chromium firefox webkit`.

### 1.2 Node / pnpm versions

- Hosted: `.nvmrc` = `24`; `pnpm/action-setup@v6` + `actions/setup-node@v7` from `.nvmrc`
  (`.github/actions/setup/action.yml`); `package.json` `packageManager: pnpm@10.28.0`.
- Roots runner: inside the Playwright image, `corepack prepare pnpm@10.28.0 --activate`
  (`container-roots.sh:8`); Node is the image's own (noble, 24.x).
- Watch agent image: Node 24.11.0 pinned, pnpm 10.28.0 asserted
  (`ops/local-ci/image/Dockerfile` ARG blocks); contract `toolchain` = node 24 / pnpm 10.28.0 /
  playwright 1.62.1 / supabaseCli 2.106.0 / postgres 17 (`config/local-ci-contract.json:166-169`).

### 1.3 Environment generation (`workflow-env.mjs`)

- `workflow-env.mjs` extracts the **root `env:` block** of `ci.yml` (regex at
  `workflow-env.mjs:9`) plus the **fast job's `env:` block** (`workflow-env.mjs:10-13`), parses
  `NAME: value` pairs, **skips any line containing `${{`** (GitHub context expressions, e.g.
  `CI_HEAD_SHA`) (`workflow-env.mjs:18`), re-assembles the split auth-hook fixture as a real
  `v1,whsec_...` value (`workflow-env.mjs:22-25`), and force-sets `CI=1` (`workflow-env.mjs:26`).
- What is synthesised: the CI fixture values verbatim from `ci.yml:38-55` (placeholders like
  `ci-anon-key`, `pk_test_ci`, `CI_*` secrets) and the strict production-profile values the fast
  job sets inline. **Real secrets are excluded by construction**: the hosted workflow carries no
  real secrets (fixtures only), and the local planes never read repo/host secrets — the agent
  plane builds its env from an **allowlist**, deletes every `hostSecrets` name, and proves no
  host-secret name/value/PEM survives (`ops/local-ci/core/job-env.mjs:12-13, 213-231, 366-368`;
  `hostSecrets` list at `config/local-ci-contract.json` `hostSecrets`). The agent plane _mints_
  the strict-fixture values per run via `strict-fixtures` / `ci-vapid` / `auth-hook-fixture`
  runtime sources instead of carrying literals (`config/local-ci-contract.json` `runtimeEnv`;
  `ops/local-ci/profiles/README.md` "runtimeEnv").
- Conclusion: the roots env matches the hosted _literal fixture_ env exactly for the extracted
  keys (plus `CI=1`); the agent env matches the hosted env semantically (equal-or-stronger
  fixture values by design, notes in `ops/local-ci/profiles/pr.json:24-31`).

### 1.4 Worker counts / parallelism

- Hosted: 72 jobs, ~6–7 min wall, ~165 machine-minutes (`docs/operations/local-ci.md:102-105`).
  e2e = 16 matrix jobs (4 projects × 4 packs), a11y = 8 (2 × 4 shards of /4), visual = 8
  (2 × 4 shards), all `PLAYWRIGHT_WORKERS: "1"` (`ci.yml:465-476`, `:522-525`, `:573-577`).
- Roots runner: all selected container roots run **sequentially inside one container**
  (`container-roots.sh`: loop over roots), each browser root loops its shards/packs
  sequentially; one Playwright worker per shard. One machine, one job at a time.
- Watch agent: `agent.maxConcurrentJobs = 1` (one head SHA at a time); up to
  `maxConcurrentLanes = 6`, but the CPU/RAM scheduler (`container.cpus` 10, `memoryGb` 32)
  admits at most ~5 lanes because the smallest lane asks 2 CPUs (`config/local-ci-contract.json:124-125,136-137`; `ops/local-ci/README.md` "Known integration points").
- Consequence: local parallelism is far below hosted; local timing is not comparable (explicitly
  excluded from shadow equivalence, `docs/operations/local-ci.md` §4.4 rule 3).

### 1.5 Browser channels, packs, shards

- Channels: hosted e2e/a11y set `PLAYWRIGHT_REGULAR_CHROMIUM=1` (regular Chromium);
  visual leaves it unset (headless-shell channel) (`ci.yml:475,524`, `playwright.config.ts:68-69`).
  Roots mirrors exactly: e2e/a11y export `PLAYWRIGHT_REGULAR_CHROMIUM=1`, visual unsets it
  (`container-roots.sh:17,20,22`).
- Shard denominator: e2e /32 on both planes — hosted 4 packs × 8 shards
  (`ci.yml:443-455`; `scripts/ci/run-browser-pack.mjs` `PACK_COUNT=4, PACK_SHARD_COUNT=8,
BROWSER_SHARD_TOTAL=32`); roots runs the same `run-browser-pack.mjs` per project×pack with
  the **hosted** plane's args (`container-roots.sh:24`). Fresh dev server and $CI/1-worker env
  per shard in `scripts/ci/browser-pack.mjs:87-107` (used by both planes; hosted sets
  `PLAYWRIGHT_JSON_OUTPUT_NAME` the same way). a11y: hosted /4 (`ci-workloads.json:41`);
  roots uses /4 via `browser-workload.mjs hosted` (`container-roots.sh:19`). The **watch agent**
  profiles use e2e /32 (32 sequential shards per lane — `ops/local-ci/profiles/pr.json` e2e
  lanes) and a11y /8 (`config/ci-workloads.json:42` `localShards: 8`; `pr.json` a11y lanes).
- Visual: hosted sharded /4 per project (`ci.yml:565-577`); roots runs the whole
  `pnpm test:visual` for both projects in one invocation (`container-roots.sh:21`) — same union,
  no sharding.
- `--grep-invert @visual` is applied only via `config/ci-workloads.json:37` on the _hosted_
  browser-args path and is forced on `plane === 'local'` in `scripts/ci/browser-workload.mjs`
  with `--ignore-snapshots` (`browser-workload.mjs:26-28`); the roots layer's _visual_ invocation
  (`container-roots.sh:21`) does **not** add either flag (see divergence D2).

### 1.6 Supabase version/config for the db root

- Hosted: `supabase/setup-cli@v3` `version: 2.106.0` (`ci.yml:714-716`); full `supabase start`
  (all services) on default ports; `SUPABASE_SEND_EMAIL_HOOK_URI:
http://host.docker.internal:3147/api/auth/hooks/send-email` and
  `SUPABASE_DB_URL: postgres://postgres:postgres@127.0.0.1:54322/postgres` (`ci.yml:709-710`);
  hook secret built from a split `printf` fixture (`ci.yml:717-719`).
- Roots runner: rewrites `config.toml` project id and the 543xx ports to **557xx**
  (`run-roots.sh:66`), exports the hook secret/URI and
  `SUPABASE_DB_URL=...127.0.0.1:55722/postgres` (`run-roots.sh:68-70`), uses `$SUPABASE_CLI`
  defaulting to **the Homebrew CLI at /opt/homebrew/bin/supabase with no version check**
  (`run-roots.sh:71`), and starts with `-x studio,imgproxy,edge-runtime,logflare,vector,supavisor`
  (`run-roots.sh:73`) — i.e., services excluded that hosted runs. Same seed and SQL moat suite
  (`pnpm db:seed`, `pnpm test:db` — `run-roots.sh:74-75`).
- Watch agent db lane: Supabase CLI **2.106.0 pinned in the image** with digest check
  (`ops/local-ci/image/Dockerfile` ARG SUPABASE_CLI_VERSION/SHA256), full `supabase start` on
  **54322** (same as hosted), hook URI 3147, `SUPABASE_DB_URL` 54322, daemon-backed via dind
  (`ops/local-ci/profiles/pr.json` db lane).

### 1.7 ZAP config

- Hosted zap-baseline: `zaproxy/action-baseline@de8ad967...` (pinned action v0.15.0), target
  `http://127.0.0.1:3000`, `rules_file_name: .zap/rules.tsv`, `allow_issue_writing: false`,
  against the shared production `.next` artifact (`ci.yml:671-700`).
- Roots runner: `docker run ... ghcr.io/zaproxy/zaproxy:stable zap-baseline.py
-t http://host.docker.internal:3000 -c rules.tsv -I` with the worktree's `.zap` mounted at
  `/zap/wrk:ro`, production bundle built on the host first (`run-roots.sh:51-58`).
- Nightly `zap-full` (agent): translated `zaproxy/action-full-scan` → same floating
  `ghcr.io/zaproxy/zaproxy:stable` image, `x64-only` — never executes locally
  (`ops/local-ci/profiles/nightly.json:890-898`; `docs/operations/local-ci.md:99-100`).

### 1.8 Lighthouse

- Hosted: 4 matrix jobs, each one route, `pnpm lighthouse -- --collect.url=<route>` on
  `127.0.0.1:3130` with the shared `.next` artifact (`ci.yml:626-651`); 10-min bound.
- Roots runner: one host invocation `pnpm lighthouse` (all four routes from
  `.lighthouserc.json`, 3 runs each, assertion matrix identical) after a host `pnpm build`
  (`run-roots.sh:52-53`).
- Watch agent: no lighthouse lane at all.

### 1.9 Harness port / build isolation

- Hosted: every shard owns a full runner; dev server on the default `127.0.0.1:3146`
  (`playwright.config.ts:18`), shared `.next-e2e` dist per job.
- Roots runner: isolated by a fresh `git worktree add` of the branch (`run-roots.sh:32`) — the
  operator's `.env.local`/excluded folders never enter `/work`; the same single container runs
  the dev server on 3146 per shard; `.next-e2e*`, `test-results`, `coverage` etc. are wiped
  before roots run (`container-roots.sh:12`).
- Watch agent: per-lane ports 3146/3148/3149/3150/3151/3152 and per-lane
  `PLAYWRIGHT_NEXT_DIST_DIR` (`ops/local-ci/profiles/pr.json` lane envs; `playwrightPorts` in
  contract); 3000 is reserved (print-kit/load/zap-full) and 3147 for the auth hook
  (`config/local-ci-contract.json` `playwrightPorts`).

---

## 2. Divergence table (local vs hosted)

| #   | Dimension                             | Hosted                                                                                                                                   | Local                                                                                                                                                                                                                                                                                                                          | Consequence                                                                                                                                                                                                                                                                                                   | Citation                                                                                                                                               |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Architecture                          | x86-64 `ubuntu-latest` / playwright noble amd64                                                                                          | ARM64: Lima VM `aarch64`, Rosetta off; roots on an arm64 Mac                                                                                                                                                                                                                                                                   | Image-heavy visual baselines (poster sheets) can differ ~0.01 px; timing excluded from equivalence                                                                                                                                                                                                            | `docs/operations/local-ci.md:26-30`; `ops/local-ci/host/lima-nabaperks-ci.yaml` (rosetta note); `config/local-ci-contract.json:154`                    |
| D2  | Visual snapshots                      | Approved x64 `-linux` baselines compared, sharded                                                                                        | Roots **does run `pnpm test:visual` with live snapshot comparison** on arm64 and does **not** pass `--update-snapshots=none`/`--ignore-snapshots`; the _agent_ plane forbids this (4 snapshot-guard layers)                                                                                                                    | Local visual can fail on pixel noise (or write missing baselines — Playwright default `updateSnapshots: missing`); agent plane has no visual lane, visual "stays GitHub-hosted … required by Release gate"                                                                                                    | `container-roots.sh:21` vs `browser-workload.mjs:26-28`; `ops/local-ci/profiles/README.md` "Playwright rules"; `docs/operations/local-ci.md:1067-1084` |
| D3  | Quality root content                  | 7 hygiene sweeps **+** print-kit PDF proof (poppler/imagemagick/opencv/pymupdf/chromium + dev-server preview) in the same job            | Roots `quality` = the 7 sweeps only (`run-workload.mjs quality`); PDF proof lives in the agent's separate `print-kit` lane                                                                                                                                                                                                     | Roots plane does not exercise the print-kit PDF proof as part of `quality`; not a merge-gate root locally anyway                                                                                                                                                                                              | `ci.yml:348-398`; `container-roots.sh:16`; `config/ci-workloads.json` quality; `ops/local-ci/profiles/README.md` "Provenance" table                    |
| D4  | Supabase CLI version                  | Pinned 2.106.0 (`supabase/setup-cli@v3`), image-pinned stack                                                                             | Roots uses the **Homebrew CLI**, no version pin/check; agent db lane pins 2.106.0                                                                                                                                                                                                                                              | Roots db root may run a different Supabase CLI/stack version than hosted — advisory only, but a same-code difference is possible                                                                                                                                                                              | `ci.yml:714-716`; `run-roots.sh:71`; `config/local-ci-contract.json:169`                                                                               |
| D5  | Supabase stack scope/ports            | Full `supabase start`, DB URL port 54322                                                                                                 | Roots excludes studio/imgproxy/edge-runtime/logflare/vector/supavisor and rewrites ports 543xx→557xx (DB URL 55722); agent db lane uses full stack on 54322                                                                                                                                                                    | edge-runtime/vector etc. not exercised by the roots db root; port-rewrite is mechanical but the URL/hook values differ from hosted                                                                                                                                                                            | `ci.yml:709-710,715`; `run-roots.sh:66-73`; `ops/local-ci/profiles/pr.json` db lane                                                                    |
| D6  | ZAP image                             | `zaproxy/action-baseline@v0.15.0` (pinned action, its own pinned image)                                                                  | `ghcr.io/zaproxy/zaproxy:stable` — **floating tag**                                                                                                                                                                                                                                                                            | ZAP engine version drift possible; arm64 manifest of `zaproxy:stable` — see UNVERIFIED-6 (the nightly `zap-full` is `x64-only`, never runs locally)                                                                                                                                                           | `ci.yml:696-700`; `run-roots.sh:57`; `nightly.json:892`; `docs/operations/local-ci.md:99-100`                                                          |
| D7  | Lighthouse granularity + build source | 4 parallel jobs × 1 route; reuses the shared `next-build` artifact                                                                       | 1 invocation, all 4 routes (3 runs each); host `pnpm build` in the worktree                                                                                                                                                                                                                                                    | Same assertions/URLs; parallelism and build provenance differ. Host-side roots builds use `$REPO/node_modules` **symlinked** into the worktree (not `pnpm install --frozen-lockfile` of the branch) — a branch whose lockfile differs from the local checkout can be tested against the wrong dependency tree | `ci.yml:626-651`; `run-roots.sh:50-53`; `.lighthouserc.json`                                                                                           |
| D8  | Node heap for browser dev server      | Hosted default **8192 MiB** (`PLAYWRIGHT_NODE_HEAP_MB` unset; `playwright-server-heap.mjs` default; NODE_OPTIONS applied because `CI=1`) | Agent browser lanes cap at **4096 MiB** (`PLAYWRIGHT_NODE_HEAP_MB: 4096`); roots plane leaves it unset (8192, matches hosted)                                                                                                                                                                                                  | Memory-pressure behaviour can differ on the agent plane; documented as expected resource difference, does not change equivalence                                                                                                                                                                              | `ops/local-ci/profiles/pr.json:260` + note `pr.json:25`; `scripts/playwright-server-heap.mjs`; `playwright.config.ts:33-35` (heap applied when CI)     |
| D9  | a11y sharding                         | /4 (2 projects × 4 jobs)                                                                                                                 | Agent lanes: /8 per project × 8 sequential shards; roots: /4 (matches hosted)                                                                                                                                                                                                                                                  | Same test union, different chunking/parallelism on the agent plane                                                                                                                                                                                                                                            | `config/ci-workloads.json:41-42`; `ci.yml:508-525`; `pr.json` a11y lanes                                                                               |
| D10 | Parallelism / wall clock              | 72 jobs, ~165 machine-min, 6–7 min wall                                                                                                  | One Mac, one head SHA at a time, ≤~5 concurrent lanes; roots sequentual single container; agent `main`-profile ~947s / 4,089 tests on baseline                                                                                                                                                                                 | Local is not a substitute for hosted-parallelism-sensitive outcomes (server concurrency, resource contention, flake behaviour)                                                                                                                                                                                | `docs/operations/local-ci.md:93-105`; `config/local-ci-contract.json:124-125`                                                                          |
| D11 | Container user/options                | `--init --ipc=host --user 1001`                                                                                                          | Roots: `--ipc=host` only, runs as root inside the container                                                                                                                                                                                                                                                                    | Root-user side effects; docs state the `coverage` root's worktree-guard and `jq` tests "need a non-root host run"                                                                                                                                                                                             | `ci.yml:152-153`; `run-roots.sh:40`; `docs/operations/local-ci.md:29-31`                                                                               |
| D12 | Env synthesis                         | Literal fixtures in `ci.yml` env blocks; strict prod-profile values inline in the fast job                                               | Roots: `workflow-env.mjs` extracts those same literals + `CI=1`; agent: allowlist + per-run minted fixtures (no literals)                                                                                                                                                                                                      | No functional difference for tests; agent plane deliberately avoids entropy-bearing literals; real secrets never enter either plane                                                                                                                                                                           | `workflow-env.mjs:9-26`; `job-env.mjs:12-13,366-368`; `pr.json:24-31`                                                                                  |
| D13 | Harness ports/dist                    | Every shard 127.0.0.1:3146, shared `.next-e2e`                                                                                           | Agent lanes each use 3146/3148/3149/3150/3151/3152 + own `.next-e2e-*`; 3000/3147 reserved                                                                                                                                                                                                                                     | No contention issue; documented; test outcomes unchanged                                                                                                                                                                                                                                                      | `config/local-ci-contract.json` `playwrightPorts`; `profiles/README.md` "Ports and dist directories"                                                   |
| D14 | Fork PRs / cross-repo                 | Hosted runs the full matrix for forks                                                                                                    | Never executed locally (allowlist `===` on `lapeninns/nabaperks` + numeric repo-id; forks classified `hosted-fork`, never enqueued)                                                                                                                                                                                            | Forks get zero local coverage; hosted covers them in full                                                                                                                                                                                                                                                     | `ops/local-ci/README.md:94-104`                                                                                                                        |
| D15 | Doc drift (internal)                  | —                                                                                                                                        | `ops/local-ci/profiles/README.md` claims browser lanes use `PLAYWRIGHT_NODE_HEAP_MB` **12288**; the operative profiles (and `profiles/README.md` "env" table's own contract) use **4096**; `docs/operations/local-ci.md` §5.2 says the observer uses the PR merge-tree checkout while `local-ci-shadow.yml:55` pins `base.sha` | README statements are stale vs. source; the workflow/source is authoritative                                                                                                                                                                                                                                  | `profiles/README.md:63-66` vs `pr.json:260`; `local-ci.md:1113-1115` vs `local-ci-shadow.yml:50-56`                                                    |

**Is local advisory-only?** Yes, per the docs: "This is advisory proof: hosted CI on the PR
remains the merge authority" (`docs/operations/local-ci.md:25-26`); "no local result becomes
authoritative" (`local-ci.md:45-46`); "Missing or pending proof is observational, not test
success" (`local-ci.md:44-45`); "The local plane is therefore not a substitute for the hosted
gate, and no amount of local green changes that" (`local-ci.md:92-93`); "Local proof stays
advisory even after qualification passes" (`local-ci.md:699`).

---

## 3. Hosted roots that CANNOT run locally

- **Via the watch agent (pr/main/nightly profiles):** `build`, `visual`, `lighthouse` and
  `zap-baseline` have **no local lane**: "There is **no local lane for `build`, `visual`,
  `lighthouse` or `zap-baseline`**" (`docs/operations/local-ci.md:89-91`).
- **Visual is pinned hosted permanently** — not subject to the two-strike ARM64 pin rule —
  because Playwright encodes only `process.platform` in the `{platform}` snapshot token, so the
  x64 `-linux` baselines resolve identically on ARM64 and a local compare/rewrite would use the
  wrong images (`local-ci.md:1079-1084`; `config/local-ci-contract.json` `snapshotGuard`).
- **Nightly `zap-full`** is `arch: x64-only` and "never executes locally"
  (`nightly.json:892`; `local-ci.md:99-100`).
- **Nightly `db-stress` fails deterministically** with `Cannot find package 'postgres'`, so no
  nightly run has ever succeeded (`local-ci.md:96-100, 994-997`).
- **`load-race`** (nightly.yml) reads a repository secret (`STAMP_RACE_AUTH_TOKEN`); repo
  secrets cannot reach the local plane, so it stays hosted (`ops/local-ci/profiles/README.md`
  "Two hosted jobs are deliberately not reproduced").
- **Fork pull requests** produce no local result at all (`ops/local-ci/README.md:103-104`).
- Via the **roots runner** all nine roots _can_ be invoked, but with the divergences in §2
  (visual pixel variance D2, ZAP floating image/arm64 D6/UNVERIFIED-6, Homebrew Supabase D4).

---

## 4. Authority in the merge / release path

**Local runs carry no merge or release authority today.**

- **Required checks (live, read 2026-09-21 via `gh api repos/lapeninns/nabaperks/rulesets/19613437`):**
  the active ruleset "Main delivery policy" (branch target = default branch, enforcement
  `active`, strict required-status-checks policy) requires exactly:
  `Release gate`, `Analyze (javascript-typescript)`, `Review dependency changes`. No
  "Nabaperks Local CI" context is required. Plain branch protection is off (`
/branches/main/protection` → 404); the ruleset governs.
- **`Release gate`** (`ci.yml:743-753`) needs all nine hosted roots — `fast, quality, build,
e2e, a11y, visual, lighthouse, zap-baseline, db` — plus `selection, documentation,
targeted-browser, targeted-visual, selection-comparison`, verified by
  `scripts/ci/verify-required-evidence.mjs` (`REQUIRED_HOSTED_JOBS`). No local check name
  appears.
- **Release path:** "Database promotion still waits for successful whole exact-main CI and
  CodeQL, then protected ephemeral proof and production approval"
  (`local-ci.md:49-50`); "Every exact-main push continues to run the complete CI suite.
  Production preflight still requires successful exact-main CI and CodeQL"
  (`docs/operations/change-aware-ci.md` "Main and release behaviour").
- **Observer (`local-ci-shadow.yml`)**: runs on same-repo PRs and main push **only when
  `vars.LOCAL_CI_MODE != ''`** (`local-ci-shadow.yml:29-33`); one read
  (`LOCAL_CI_OBSERVE_ONCE=true`), 2-minute bound, `continue-on-error: true`
  (`:35-36`); permissions `contents: read` + `checks: read` only (`:41-43`); checks out the
  **base SHA** so reviewed code judges the candidate (`:50-56`). It **posts no check run**, gates
  nothing, and refuses an enforcing contract (`scripts/check-local-ci-proof.mjs:184-190`;
  observe-once path prints a summary and returns 0, "consult the App check for eventual local
  validation" — `:248-253`; shadow verdicts are "recorded and nothing else; no merge decision
  depends on it until cutover step 3" — `:282-284`). Event/App identity is pinned
  (`ops/local-ci/core/app-identity.mjs`, used by `scripts/check-nightly-proof.mjs`).
- **`LOCAL_CI_MODE` semantics:** "controls hosted observation, not service startup"
  (`local-ci.md:51-52`); `shadow` is the qualification value, set as a repo variable
  (`local-ci.md:708-712`); unset → dormant (both check scripts log "no local plane" and
  return 0). The installed agent polls independently of the variable.
- **Trusted observer (`local-ci-trusted-observer.yml`)**: workflow_dispatch-only, runs
  `scripts/ci/observe-trusted-local-proof.mjs`, "No candidate checkout, policy input, signing
  key or authority switch". It **has never run**; `routeTrustedProof` has no callers; no code
  path returns `route:'local'`; `/opt/nabaperks-trusted-ci` absent (`local-ci.md:77-81`).
- **Nightly proof (`nightly-proof.yml`)**: scheduled 09:47 UTC, gated on `LOCAL_CI_MODE`,
  `continue-on-error: true`, `checks: read` only, no `issues` scope; script returns 0 while
  `nightlyProof.enforcement === "advisory"` — "It cannot go red today, and nothing depends on
  it" (`nightly-proof.yml:34-35,55-58,47`; `local-ci.md:985-991`).
- **GitHub App used by the local runner** (`config/local-ci-contract.json` `githubApp`):
  - Name `Nabaperks Local CI`, **appId 4839346, installationId 159244911, repositoryId
    1268458916** (`:12-15`) — all pinned (non-null) since 2026-09-05.
  - Permissions: `checks: write`, `actions: write` (restricted to exactly
    `rerun-failed-jobs`, `:23`), `contents: read`, `pull_requests: read`, `metadata: read`.
  - Key location: `~/.nabaperks-local-ci/app-private-key.pem`, mode 0600, host-only
    (`:24`; `docs/operations/local-ci.md` §2.5, §7.1); agent accepts env
    `LOCAL_CI_GITHUB_APP_PRIVATE_KEY` or the file, coercing 0600 (`agent/main.mjs:399-426`).
  - **What it can do to the repo:** create/complete the `Nabaperks Local CI` check run on a
    head SHA (its only published output) and, via the unwired helper, `rerun-failed-jobs` on
    finished workflow runs (Phase 1 does not issue it — `docs/operations/local-ci.md:31-34`
    comment in `ops/local-ci/README.md:7-16...`; caller blocked without an Actions write,
    `scripts/check-local-ci-proof.mjs:232-243`). It **cannot** push/tag/open PRs (Contents read
    only), read secrets, read/write environments, or alter rulesets/branch protection — the
    §2.2 "must-not-grant" list (`local-ci.md` §2.2). The check-run selector matches on
    `app.id`, so a same-named check from another App is rejected (`local-ci.md:513-516`).
  - Docs explicitly forbid promotion via config flips: "Do not acquire local merge authority by
    flipping a variable or contract field" (`local-ci.md:57-58`); cutover step 1 with
    `bridge.enforcement: advisory`, `requiredCheck: false`, `dependents: []`
    (`config/local-ci-contract.json:35-37`).

---

## 5. Proof artefacts produced locally, and retention

**Roots runner** (`run-roots.sh:79`):

- Logs under `$WORK/logs/` (default `~/.cache/nabaperks-local-ci/logs/`): `container.log`,
  `host.log` (lighthouse/zap + build), `db.log`, `zap-server.log`. Exit-code lines
  `=== ROOT <x> EXIT <n> ===`.
- Generated `env.sh`; the branch worktree (`$WORK/tree`) is discarded/recreated per run.
- Nothing is published to GitHub, no check runs, nothing committed to the repo. **Retention/
  pruning of roots logs is not documented — UNVERIFIED.**

**Watch agent** (`docs/operations/local-ci.md` §6; `config/local-ci-contract.json` `evidence`):

- Per-lane evidence: `~/.nabaperks-local-ci/runs/<headSha>/<profile>-<UTC instant>-<entropy>/`,
  one `nabaperks.lane-result.v1` JSON per lane plus captured lane logs; per-run, never
  overwritten (pr/main/nightly runs of one SHA are distinct records).
- Published check output carries a **SHA-256 log digest** (length-prefixed bundle) as its last
  line; verification procedure §6.4 (check output digest == recorded digest == recomputed from
  disk bytes).
- Retention: `evidence.retentionDays` and `agent.logRetentionDays` both **30**;
  prune only strictly-older runs, never boundary-day/today/in-flight; sweep runs on every poll
  tick (`local-ci.md` §6.2). "An outcome older than 30 days cannot be re-verified against local
  evidence" — copy records to the ledger to outlive it.
- Agent process logs: `/opt/nabaperks-local-ci/logs/agent.{out,err}.log`, mode 0750, rotated by
  newsyslog (10 MB, 7 bzip2 generations) (`ops/local-ci/host/README.md`).
- "Neither is ever written into the repository, and neither survives in a container after it
  exits" (`local-ci.md` §6.1).
- Nightly proof: the App publishes `Nabaperks Local CI (nightly)` check runs; the hosted
  verifier scans back up to 20 commits on the default branch
  (`scripts/check-nightly-proof.mjs` `DEFAULT_COMMITS_TO_SCAN`).

---

## 6. Documented operational flow

- **Roots runner:** a developer/operator runs `ops/local-ci/roots/run-roots.sh <branch>` (or a
  subset) "before a PR is opened or updated, so hosted minutes are spent only on what local
  proof cannot give"; advisory; hosted CI remains the merge authority
  (`docs/operations/local-ci.md:14-26`; `run-roots.sh:3-9`).
- **Watch agent:** installed by `ops/local-ci/host/install.sh` from a reviewed main revision
  under `/opt/nabaperks-local-ci/current`, launchd
  `com.nabaperks.local-ci` (`agent/main.mjs --watch`); runs `pr` (same-repo PR heads), `main`
  (push to main) and `nightly` (every 15 min the agent asks whether the newest nightly run dir
  is older than the 24 h cadence, then runs the nightly profile if due
  (`local-ci.md:1000-1004`).
- **What operators should do with results:** treat local green as advisory only; for the shadow
  comparison, collect both planes' evidence (§4.3), run
  `pnpm ops:ci:shadow-compare -- --sha <sha> --profile pr --local-check ... --hosted-evidence ...`
  (and `pnpm ops:ci:hosted-evidence --sha <sha>` to produce hosted envelopes), and record
  verdicts (equivalent/divergent/incomplete) in the ledger issue
  `[Local CI] Shadow qualification ledger`. Three consecutive equivalent PR heads, a complete
  main profile and mutation at concurrency 8 within 75 min, and fork/fallback proofs are the
  qualification prerequisites (`local-ci.md` §4.1-4.5; contract `shadowMode`).
- **Nightly monitor:** advisory freshness verdict, cannot fail the run today
  (`local-ci.md:985-997`).
- **Outage behaviour:** if the Mac/VM is offline, "the local check may be missing or pending;
  this is reported without waiting" and hosted validation already runs in full; there is no
  fallback variable and no reason to rerun hosted jobs because local proof was absent
  (`local-ci.md:1092-1104`).
- **Pausing:** a paused LaunchAgent stays paused until its operational resumption is
  authorised; never `limactl stop` (`local-ci.md:51-53`; `local-ci.md` §3.3).

---

## 7. UNVERIFIED list

1. **ZAP `ghcr.io/zaproxy/zaproxy:stable` arm64 manifest** — whether the floating `stable` image
   (and the action's pinned image) has a `linux/arm64` manifest on today's registry, and how the
   roots `zap` root behaves on an arm64 Mac under Docker Desktop emulation, is UNVERIFIED
   (no pull/run performed; nightly `zap-full` is x64-only by pin, `nightly.json:892`).
2. **Homebrew Supabase CLI version** on the operator's Mac vs pinned 2.106.0 — the roots db root
   (`run-roots.sh:71`) performs no version check; current installed version UNVERIFIED.
3. **Which coverage tests fail as root** — the docs' statement that the `coverage` root's
   worktree-guard and `jq` tests "need a non-root host run" (`local-ci.md:29-31`) is quoted, but
   I did not root-cause which test names or mechanism.
4. **Roots log retention** — pruning/rotation of `$HOME/.cache/nabaperks-local-ci/logs` is not
   documented anywhere read; no retention promise UNVERIFIED.
5. **Supabase 2.106.0 stack arm64 manifests** — the 4.6 candidate risk ("if any image in the
   pinned 2.106.0 set has no linux/arm64 manifest", `local-ci.md` §4.6) is listed as a risk, not
   resolved, in the docs; I did not pull manifests to resolve it.
6. **Live installed state of the Mac plane** — the runbook's own "Live readback 2026-09-09" says
   the installed agent (`aed95ca9b`) is five commits behind `origin/main`; nothing in the repo
   proves today's installed revision, `LOCAL_CI_MODE` value, or that `/opt/...` exists, and I did
   not (and was not permitted to) inspect the host. UNVERIFIED.
7. **Exact seeds/fixtures equivalence test-by-test** — equivalence under §4.4 was never executed
   here; only wiring was inspected. Count floors/ceilings come from the contract's recorded
   baseline (`config/local-ci-contract.json` `shadowMode.qualification`).
8. **`-c rules.tsv` resolution in the roots ZAP run** — whether ZAP's `-c rules.tsv` inside the
   `/zap` CWD resolves to the mounted `/zap/wrk/rules.tsv` exactly as the action does was not
   executed; the mount (`run-roots.sh:57`) mirrors the agent note, but no run was performed.
