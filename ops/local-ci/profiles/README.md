# Local CI profiles

Three declarative lane sets the local CI agent executes. They are data, not
code: `config/local-ci-contract.json` names them, the agent's pure modules load
and validate them, and the contract tests assert their shape and content.

| Profile   | File           | When it runs                          | Lanes |
| --------- | -------------- | ------------------------------------- | ----- |
| `pr`      | `pr.json`      | pull request from the same repository | 10    |
| `main`    | `main.json`    | push to the default branch            | 10    |
| `nightly` | `nightly.json` | scheduled hardening run               | 14    |

`main.lanes` is deep-equal to `pr.lanes`, so a merge is never proved by a weaker
suite than the pull request that produced it. `nightly.lanes` begins with those
same ten lanes and appends four: `mutation`, `load`, `db-stress`, `zap-full`.

## Schema

```jsonc
{
  "schema": "nabaperks.local-ci-profile.v1",
  "profile": "pr" | "main" | "nightly",
  "description": "...",
  "baselineEnv": { ... },          // ci.yml's workflow-level env, plus CI=1
  "baselineRuntimeEnv": ["..."],   // runtime source ids applied to every lane
  "notes": ["..."],
  "lanes": [
    {
      "id": "fast",
      "title": "Fast lane (lint, typecheck, unit)",
      "arch": "any" | "x64-only",
      "concurrencyGroup": null | "<group>",
      "commands": ["pnpm lint", "..."],
      "teardownCommands": ["..."],       // run whether the lane passed or failed
      "backgroundServices": [ ... ],
      "runtimeEnv": ["..."],             // runtime source ids, lane-scoped
      "env": { ... },                    // literal, non-secret
      "systemDependencies": [ ... ],
      "timeoutMinutes": 20,
      "continueOnError": false,
      "notes": "..."
    }
  ]
}
```

### `arch`

`"any"` or `"x64-only"`. A lane that fails ARM64 qualification is pinned back to
hosted execution by flipping this one field — no new structure is invented for
it. Today only `zap-full` is `x64-only`, because the ZAP stable image is
published for `linux/amd64` only. On the ARM64 plane the agent skips every
`x64-only` lane and records it as `pinned-hosted` rather than emulating it;
qemu-emulated timing would produce findings that are neither reproducible nor
comparable against the hosted result.

### `env`, `baselineEnv` and `runtimeEnv`

Precedence, lowest first: `baselineEnv` → `baselineRuntimeEnv` →
lane `runtimeEnv` → lane `env`.

`baselineEnv` is `.github/workflows/ci.yml`'s workflow-level `env:` block
verbatim, plus `CI=1` so `forbidOnly`, `failOnFlakyTests` and `retries: 1`
behave exactly as they do hosted. Browser lanes explicitly request a 12288 MiB
heap through `PLAYWRIGHT_NODE_HEAP_MB`, versus the hosted 8192 MiB default.
This expected resource difference stays within the 32 GiB local container; it
does not change which test outcomes count as equivalent.

Three of ci.yml's values are deliberately **absent** from `baselineEnv`:
`CUSTOMER_SESSION_SECRET`, `CUSTOMER_PHONE_HMAC_SECRET` and
`CUSTOMER_PHONE_ENCRYPTION_KEY`. Committing an entropy-bearing literal to a
config file is exactly the habit the hosted workflow's split-`printf` fixtures
exist to avoid, so these come from the `strict-fixtures` runtime source instead.
The values it mints satisfy every rule `scripts/check-env.mjs` enforces on a
high-entropy secret — at least 32 characters, no whitespace, at least 12
distinct characters, no placeholder word — so the local plane's environment is
equal to or stronger than the hosted one, never weaker.

### `runtimeEnv`

Some values do not exist until the run is underway. The anon and service-role
keys that `supabase status -o env` prints are minted by the local stack; the
VAPID pair is generated; the auth-hook signing fixture is assembled. None of
them can be a literal in a tracked file.

A lane therefore names a **source id**, and the source definitions live in
`config/local-ci-contract.json` under `runtimeEnv.sources`:

| id                  | kind        | resolution | provides                                                                                                                             |
| ------------------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase-local`    | `command`   | per-lane   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`                          |
| `ci-vapid`          | `command`   | per-run    | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`                                                  |
| `auth-hook-fixture` | `generated` | per-run    | `SUPABASE_SEND_EMAIL_HOOK_SECRET`                                                                                                    |
| `strict-fixtures`   | `generated` | per-run    | `CRON_SECRET`, `PRODUCTION_MONITOR_SECRET`, `CUSTOMER_SESSION_SECRET`, `CUSTOMER_PHONE_HMAC_SECRET`, `CUSTOMER_PHONE_ENCRYPTION_KEY` |

A `command` source runs its command and parses the output as dotenv, applying
the source's `map` to rename keys. A `generated` source calls the named
generator with the declared `spec`.

`resolution` matters. **per-run** sources resolve once and every lane sees the
same value, which is what lets one lane seed ciphertext another lane reads back.
**per-lane** sources resolve inside the lane, after its own setup commands have
run — `supabase status -o env` has no answer until that lane's `supabase start`
has finished.

`supabase-local` is attached to `db-stress` and **not** to `db`. That asymmetry
is intentional: ci.yml's `db` job reaches Postgres directly over
`SUPABASE_DB_URL` and never reads `supabase status`, so adding minted keys there
would be a divergence from the transcription rather than a fix. `db-stress` has
no hosted precedent and genuinely needs them, because `scripts/perf-stress.mjs`
calls `assertLocalTarget` on `NEXT_PUBLIC_SUPABASE_URL` and would reject the
`https://ci.supabase.co` baseline placeholder.

### `backgroundServices`

Several hosted steps are inline shell blocks that background a server, poll it
with `curl`, dump the log and `exit 1` if it never answers, then `kill` it on
`EXIT`. Transcribing that as a heredoc would move lifecycle management into the
data. Instead each is declared:

```jsonc
{
  "id": "print-kit-preview",
  "command": "pnpm exec next dev --webpack -H 127.0.0.1",
  "startAfter": 1, // index in `commands` after which the service starts
  "readiness": {
    "url": "http://127.0.0.1:3000/dev/poster-preview?template=seal",
    "method": "GET",
    "attempts": 60,
    "intervalSeconds": 1,
  },
  "logFile": "print-kit-preview.log",
  "stopSignal": "SIGTERM",
  "onReadinessFailure": "print-log-and-fail",
}
```

`startAfter: 1` reproduces the hosted ordering exactly — the `load` and
`zap-full` lanes must finish `pnpm build` before `pnpm start` is meaningful, and
`print-kit` runs the server-free `posters:verify-pdfs` geometry proof first.

### `teardownCommands`

The local equivalent of a hosted step marked `if: always()`. The `db` lane's
`supabase stop --no-backup` and `db-stress`'s stress-row cleanup run whether the
lane passed or failed, so a crashed run cannot leave a stack up or ten thousand
fixture customers behind.

### `concurrencyGroup`

Up to `agent.maxConcurrentLanes` lanes run at once on the single-machine plane.
Lanes that share a group are serialised against each other:

| group                 | lanes                           | why                                           |
| --------------------- | ------------------------------- | --------------------------------------------- |
| `http-127.0.0.1-3000` | `print-kit`, `load`, `zap-full` | all bind port 3000                            |
| `supabase-local`      | `db`, `db-stress`               | both run a local Supabase stack (54321/54322) |

Playwright lanes carry no group because each is given its own dev-server port
and its own Next dist directory (see below).

## Playwright rules

These are the two constraints the whole design bends around.

### 1. No lane may read or write a pixel baseline

Playwright encodes only `process.platform` in the `{platform}` snapshot token,
so `-linux` means the same thing on x64 and on ARM64. A local ARM64 run that
resolved the blessed hosted baselines would compare against the wrong PNGs and,
worse, could rewrite them.

Every Playwright invocation in every profile therefore carries **both**
`--grep-invert @visual` and `--ignore-snapshots`, and no command anywhere
contains `-u`, `--update-snapshots` or `test:visual`. The agent additionally
runs `git status --porcelain -- 'tests/e2e/**/*-snapshots'` after each lane and
fails it on any output. Visual regression stays GitHub-hosted on x64: ci.yml's
`visual` and `visual-gate` jobs are untouched by this cutover step.

The direct customer-join and merchant ID-verification journeys use `@a11y`
without `@visual`: they assert behaviour and accessibility, and capture optional
screenshot evidence, but do not compare pixel baselines. Both hosted and local
accessibility lanes therefore select these journeys. Service-backed skips still
apply identically when local browser database fixtures are unavailable.

### 2. Every invocation is sharded

`.github/workflows/nightly.yml` records the failure mode in its own comment: run
an **unsharded** Playwright project against one webpack dev server and the
server accumulates heap across the suite until it dies with
`FATAL ERROR: Ineffective mark-compacts near heap limit - JavaScript heap out of
memory`, after which every later navigation fails with `ERR_CONNECTION_REFUSED`
(run 30196429475 — chromium 13 failed / 141 passed). "Restart the four projects
sequentially" therefore has to mean two things at once: each project is its own
invocation, **and** each project is sharded so every shard gets a fresh dev
server.

**Shard count: 8 per project.** The reasoning:

- 1 (unsharded) is the configuration the repository has already recorded as
  fatal. It is not available.
- 1/8 of a functional project is roughly 28 tests per dev server — about five
  times inside the ~154-test point where the heap actually died — and 8 is the
  denominator the hosted accessibility tier already runs green.
- The hosted e2e denominator of 32 is **not** copied, because hosted sharding
  buys 32-way runner parallelism as well as memory isolation. This plane has
  neither: `PLAYWRIGHT_WORKERS=1` inside a lane, and at most four lanes on one
  machine. 32 × 4 projects would be 128 sequential dev-server boots and would
  spend the whole 75-minute local budget on process startup.

Sharding here buys memory, not speed. That is the entire justification, and it
is why the number may be lowered only with evidence, never raised for comfort.

### Ports and dist directories

`PLAYWRIGHT_WORKERS: "1"` and `CUSTOMER_DEV_OTP_CODE: "424242"` are carried on
exactly the lanes ci.yml carries them on, for the reason ci.yml gives: under two
workers the webpack dev server intermittently 500s mid-suite, and
`failOnFlakyTests` turns any recovery into a red run.
`PLAYWRIGHT_REGULAR_CHROMIUM: "1"` is job-level env on the hosted browser tiers
and is carried on every project here for the same reason.

The other deliberate environment differences provide per-lane isolation. Every hosted shard owns a
whole runner, so all of them use the `127.0.0.1:3146` default and the shared
`.next-e2e` dist directory. Concurrent local lanes cannot. Each Playwright lane
therefore sets its own `PLAYWRIGHT_BASE_URL` and its own
`PLAYWRIGHT_NEXT_DIST_DIR`:

| lane                  | port |
| --------------------- | ---- |
| `e2e-chromium`        | 3146 |
| `e2e-mobile-safari`   | 3148 |
| `e2e-desktop-firefox` | 3149 |
| `e2e-desktop-safari`  | 3150 |
| `a11y-chromium`       | 3151 |
| `a11y-mobile-safari`  | 3152 |

3147 is never assigned: it is the auth-hook callback port the `db` lane's
`SUPABASE_SEND_EMAIL_HOOK_URI` points at. 3000 is reserved for the
`http-127.0.0.1-3000` group.

This is safe because `playwright.config.ts` derives both `baseURL` and the dev
server's `PORT` from `PLAYWRIGHT_BASE_URL`, and every spec and helper that
mentions 3146 reads `process.env.PLAYWRIGHT_BASE_URL` first and uses the literal
only as a fallback. `scripts/run-playwright.mjs` treats a caller-supplied
`PLAYWRIGHT_NEXT_DIST_DIR` as caller-owned and does not delete it, so the agent
removes it after the lane instead.

## Provenance

Every command is transcribed from `.github/workflows/ci.yml` or
`.github/workflows/nightly.yml` as they stand today.

| lane        | hosted origin                                             |
| ----------- | --------------------------------------------------------- |
| `fast`      | ci.yml `fast`                                             |
| `quality`   | ci.yml `quality`, the seven sweep steps                   |
| `print-kit` | ci.yml `quality`, the two PDF proof steps                 |
| `e2e-*`     | ci.yml `e2e`                                              |
| `a11y-*`    | ci.yml `a11y`                                             |
| `db`        | ci.yml `db`                                               |
| `mutation`  | nightly.yml `mutation`, plus `--concurrency 8`            |
| `load`      | nightly.yml `load`                                        |
| `db-stress` | **new** — no hosted precedent                             |
| `zap-full`  | nightly.yml `zap-full`, action translated to `docker run` |

Where a hosted step is a GitHub Action rather than a command, the translation is
recorded in that lane's `notes` — `zaproxy/action-full-scan@v0.13.0` becomes the
`docker run` of the image it wraps, with the workspace mounted at `/zap/wrk` so
the relative `.zap/rules.tsv` path resolves identically.

Two hosted jobs are deliberately **not** reproduced:

- `nightly.yml`'s `cross-browser` runs the same command as ci.yml's `e2e` tier,
  which the four `e2e-*` lanes already cover for all four projects.
- `nightly.yml`'s `load-race` reads `secrets.STAMP_RACE_AUTH_TOKEN`. A
  repository secret cannot reach this plane at all — see the contract's
  `hostSecretsPolicy` — so it stays hosted permanently.

## What these files do not do

At cutover step 1 nothing here is on the merge path. The bridge job
(`local-proof`) is advisory, no job in `ci.yml` lists it in `needs:`, and
`release-gate` still needs exactly `[fast, build]`. `shadowMode.enabled` is
`true`. Promoting any of this to blocking is cutover step 3, and it is a single
commit that flips `bridge.enforcement` and `shadowMode.enabled` together.
