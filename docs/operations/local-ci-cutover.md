# Local CI cutover — follow-on specification (steps 3-7)

Cutover step 1 (this pass) merged the local CI execution plane as **inert
scaffolding**: `ops/local-ci/`, `config/local-ci-contract.json`, an advisory
`local-proof` job appended to `.github/workflows/ci.yml`, a nightly proof
verifier, unit and contract coverage, and the host provisioning files. It
deleted nothing, renamed nothing, and did not shrink any `needs:` list. The
merge-blocking surface is still exactly `fast` **and** `build`, reached through
the single required check `Release gate`.

The operator-facing companion to this document is
`docs/operations/local-ci.md`, which covers running and maintaining the plane.
This one covers changing it.

This document specifies the changes step 1 deliberately did **not** make. Each
step below is a separate reviewable pull request with its own breakage list,
manual prerequisite and rollback. Nothing here is optional colour: every line
number, assertion and identifier was read out of the tree at commit
`08ec0f434`, which step 1 only appends to, so the numbers remain valid until
step 3 rewrites them.

## Reading this document

- **Line references** are `path:line` against `08ec0f434`. Where a step rewrites
  a file, later steps quote the assertion text rather than the line, because
  line numbers move.
- **"Breaks"** means the assertion throws or silently degrades once the step
  lands. A silently-degrading assertion is called out explicitly, because it is
  more dangerous than a throwing one.
- **`jobText(file, jobId)`** is the workflow-slicing helper introduced by
  step 3's `scripts/workflow-graph.mjs`. Wherever a test currently slices
  `ci.yml` with a raw `indexOf` pair, the repair is to re-anchor it on
  `jobText` and to assert the anchor was found. Several existing slices return
  `-1` after a deletion and silently produce a whole-file or empty string
  instead of throwing.

## Ordering

| Step | Name                                         | Blocked on                                                           |
| ---- | -------------------------------------------- | -------------------------------------------------------------------- |
| 2    | Provision App, VM, launchd agent; shadow-run | step 1 merged                                                        |
| 3    | Activate local routing and the complete gate | step 2 qualification gate; `github:ruleset-status-checks-exact` PASS |
| 4    | Real protected Staging                       | step 3 (the gate must already assert lane coverage)                  |
| 5    | Paging rotation and UptimeRobot              | step 4 (staging is where the receiver is rehearsed)                  |
| 6    | SLO v2 and the recovery contract             | step 5 (UptimeRobot is the new availability source)                  |
| 7    | Make every lane and control blocking         | steps 3-6 all landed and observed green                              |

Step 7 is last **because it removes every remaining escape hatch**. It flips
`zap-baseline` to `enforcement: "blocking"`, empties `advisoryLanes`, and moves
both committed contracts to `stage: "local-primary"`. Doing that before step 4
would make a merge depend on a staging environment that has no Supabase project;
before step 5, on a paging receiver whose secret is mid-rotation; before step 6,
on an availability calculation that breaches on a single failed probe (see step
6's arithmetic). Each of steps 4-6 leaves its own lane advisory precisely so
that step 7 has something to promote.

## Invariants no step may relax

Steps 3-7 change what the plane gates. They do not change what the plane is
allowed to touch. Two boundaries carry over unchanged from step 1, and a pull
request in this series that appears to need either of them widened is wrong
about its own requirements.

### The GitHub App permission boundary

The `Nabaperks Local CI` App keeps exactly the five repository permissions
declared as data in `config/local-ci-contract.json` under
`githubApp.permissions` — Checks: write; Actions: write, narrowed by
`allowedActionsWriteOperations` to `rerun-failed-jobs` and nothing else;
Contents: read; Pull requests: read; Metadata: read. The normative list,
including the permission set that must **not** be granted — Contents: write,
Secrets, Environments, Administration, Workflows: write, and every
organization-level permission — is `docs/operations/local-ci.md` sections 2.1
and 2.2. Step 3 is what makes the App's check run merge-blocking, which is
exactly why the permission set must not grow alongside it: from step 3 onward a
host that held `Contents: write` could both write the code and pass the gate
that judges it.

### The host agent is never updated from PR code

`docs/operations/local-ci.md` section 7.4 states the rule the whole design
rests on, and every step below inherits it. The agent runs from
`/opt/nabaperks-local-ci/current/`, a symlink repointed only by
`ops/local-ci/host/install.sh` from a revision that is an ancestor of
`origin/main` and carries a successful `Release gate`; no code path reads a
file out of a job workspace and executes it as agent code. A pull request that
edits `ops/local-ci/**` changes what the agent does only after it merges and an
operator re-runs the installer. No step may introduce an auto-update path, a
host mount into the VM, or a workspace file the agent sources — least of all
step 3, which is the step that first lets the agent's verdict block a merge.

---

# Step 3 — activate local routing and the complete Release gate

Step 3 is the only step that changes what a green PR means. It lands as two
pull requests.

- **3a (additive, nothing becomes blocking).** Adds
  `config/lane-routing-contract.json`, `config/release-gate-contract.json`,
  `scripts/lane-routing.mjs`, `scripts/route-ci-lanes.mjs`,
  `scripts/lane-result.mjs`, `scripts/lane-counts-reporter.mjs`,
  `scripts/aggregate-proof-summary.mjs`, `scripts/check-shadow-equivalence.mjs`,
  `scripts/check-shadow-qualification.mjs`, `scripts/check-release-gate.mjs`,
  `scripts/workflow-graph.mjs`, `.github/actions/lane-result/action.yml`,
  `.github/workflows/hosted-proof.yml`, and the `route` / `hosted-proof` /
  `shadow-compare` jobs in `ci.yml`. `release-gate` keeps
  `needs: [fast, build]`. Every existing job stays. This PR is large but
  reversible by revert.
- **3b (the deletion and the promotion, one commit).** Deletes the ten jobs
  listed below and rewrites `release-gate`. The deletion and the promotion
  **must** be the same commit: a commit that deletes a lane while its
  replacement is still advisory is exactly the defect the invariant below
  exists to prevent, and `tests/contracts/release-gate-graph.test.mjs` Test 2
  refuses to let it merge.

Splitting this way is a deviation from the reference design, which folded the
routing plane into step 1. Step 1's binding scope excluded it, so it moves here.

## 3.1 Jobs deleted from `.github/workflows/ci.yml`

Ten jobs, 295 lines plus separators, all in PR 3b:

| Job               | Lines   | Replaced by                                                        |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `fast`            | 47-90   | local `fast` lane + `hosted-proof.yml` job `fast`                  |
| `quality`         | 92-147  | local `quality` and `print-kit` lanes + the same hosted jobs       |
| `build-gate`      | 169-184 | nothing — its three `needs` are covered by `release-gate` directly |
| `e2e`             | 186-263 | four `e2e-*` lanes, `hosted-proof.yml` job `e2e` (matrixed)        |
| `e2e-gate`        | 265-275 | lane-coverage assertion in `check-release-gate.mjs`                |
| `a11y`            | 277-306 | two `a11y-*` lanes, `hosted-proof.yml` job `a11y`                  |
| `a11y-gate`       | 308-318 | lane-coverage assertion                                            |
| `lighthouse-gate` | 399-409 | the `lighthouse` job itself, renamed `name: Lighthouse CI`         |
| `db`              | 441-462 | `db` lane, `plane: "both"`, `hosted-proof.yml` job `db`            |
| `db-gate`         | 464-479 | lane-coverage assertion                                            |

**Kept, in this file order** (the order matters — see 3.6): `route` (new),
`build` (149-167, body byte-unchanged), `visual` (320-350, `needs: fast` →
`needs: route`), `visual-gate` (352-362), `lighthouse` (364-397: matrix
removed, `name:` becomes `Lighthouse CI`, `- run: pnpm lighthouse -- --collect.url=…`
becomes `- run: pnpm lighthouse`), `zap-baseline` (411-439), `local-proof`
(promoted from step 1's advisory job, `needs: route`), `hosted-proof` (new
reusable-workflow caller), `shadow-compare` (new), `release-gate` (481-496,
rewritten, and **restored to last position in the file**).

The consolidated `lighthouse` job drops `--collect.url=` because
`.lighthouserc.json`'s `ci.collect.url` already lists all four routes
(`http://127.0.0.1:3130/`, `/pricing`, `/loyalty-for-pubs`, `/signup`) and
`numberOfRuns: 3`. One job runs all four; four matrix rows become one.

**The workflow-level `env:` block at `ci.yml:20-37` is byte-preserved forever.**
`tests/contracts/production-security-closure.test.mjs:107-119` reads
`CUSTOMER_SESSION_SECRET` out of it, and `visual` still consumes the eighteen
variables. Do not delete it with `fast`.

## 3.2 The new `release-gate`

```yaml
release-gate:
  name: Release gate
  needs:
    - route
    - build
    - visual-gate
    - lighthouse
    - zap-baseline
    - local-proof
    - hosted-proof
    - shadow-compare
  if: ${{ always() }}
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
    - name: Require complete lane coverage
      env:
        NEEDS_JSON: ${{ toJSON(needs) }}
        EVENT_NAME: ${{ github.event_name }}
        HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}
        REPOSITORY: ${{ github.repository }}
        HEAD_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
        FALLBACK_SHA: ${{ vars.LOCAL_CI_FALLBACK_SHA }}
      run: node scripts/check-release-gate.mjs
```

Three things about this shape are load-bearing:

1. **The per-lane `test "$X_RESULT" = "success"` idiom is abolished.** Under
   `if: always()` a deleted or skipped job reports `skipped`, and a shell
   `test` on eight separate variables is exactly the surface that lets a
   dropped lane pass. A new assertion `assert.doesNotMatch(ci, /_RESULT/)`
   makes reintroducing it a test failure.
2. **`check-release-gate.mjs` never trusts `needs.route.outputs`.** It
   recomputes the route from the event facts and `selectLanes()` from the
   committed table, then requires set equality against each plane's summary.
   This is what catches a PR that hand-edits `with: lanes:` in `ci.yml`.
3. **`hosted-proof` contributes no standalone check row.** GitHub names a
   reusable workflow's check runs `<caller job name> / <called job name>`, so
   there is no row called `Hosted CI proof`. The release-gate contract records
   `"checkName": null` and `"checkNamePrefix": "Hosted CI proof / "` for that
   entry, and a contract test asserts no called-workflow name appears in
   `config/github-governance-contract.json:13-17`.

## 3.3 The hosted-proof reusable workflow

`.github/workflows/hosted-proof.yml` is the repository's first
`workflow_call` workflow and the first job-level `outputs:` mapping — there is
no existing instance in `.github/workflows/` to pattern-match against.

It exists for two distinct populations, and conflating them was the structural
defect in the earlier design:

- **Fork PRs**, which can only ever be proved hosted. On `route === "fork"` the
  routing table's `plane` field is ignored entirely and every lane in the
  profile is sent hosted, less lanes carrying `requiresSecrets: true`. A fork
  PR therefore cannot shrink its own coverage by editing the table.
- **Lanes pinned hosted on the same-repo path**, because they cannot be trusted
  on local ARM64. Today those are `build` (`pnpm bundle:check` budgets are
  x64-calibrated), `visual` (the blessed `-linux` PNG baselines encode only
  `process.platform`, so an ARM64 run would compare against x64 pixels),
  `lighthouse` (`.lighthouserc.json` budgets calibrated on hosted x86-64),
  `zap-baseline` and `zap-full` (ZAP images are `linux/amd64` only), and
  `load-race` (needs a repository secret that cannot reach the Mac plane).
  **`hosted-proof.yml` is called on every route, not only on forks**, so a
  hosted-pinned lane runs on the internal merge path too.

Callee shape: eleven lane jobs (`fast`, `quality`, `print-kit`, `e2e`, `a11y`,
`db`, `mutation`, `load`, `db-stress`, `load-race`, `zap-full`) plus
`proof-gate`. Unsharded lanes are selected with
`if: ${{ contains(fromJSON(inputs.lanes), '<laneId>') }}`. The two sharded jobs
take `matrix: ${{ fromJSON(inputs.e2e_matrix) }}` from a route-computed input,
with a sentinel matrix
`{"include":[{"lane":"none","project":"none","shard":"0/1"}]}` when the lane is
not selected — a false `if:` on a matrixed job still expands the matrix and
skips **every cell**, so without the sentinel an unselected `e2e` would cost 32
skipped rows instead of one. `proof-gate` carries `if: ${{ always() }}` so the
called workflow is never wholly skipped while the caller runs; that guarantees
`needs['hosted-proof'].outputs.summary` is non-empty whenever the lane set was
non-empty, which is the only signal distinguishing "not routed" from "routed and
everything was filtered out".

No `secrets: inherit`. A contract assertion enforces its absence.

## 3.4 Same-repo PR job arithmetic

**Today.** `fast` 1 + `quality` 1 + `build` 1 + `build-gate` 1 + `e2e` 4×32=128

- `e2e-gate` 1 + `a11y` 2×8=16 + `a11y-gate` 1 + `visual` 2×4=8 + `visual-gate`
  1 + `lighthouse` 4 + `lighthouse-gate` 1 + `zap-baseline` 1 + `db` 1 + `db-gate`
  1 + `release-gate` 1 = **168 workflow jobs**, plus the two externally-produced
  required checks (`Analyze (javascript-typescript)`, `Review dependency
changes`) = **170 check rows**.

**After step 3, steady state** (internal route, `shadowCompare.mode` reduced
from `"all"` to `"nightly"` at the end of qualification, so `compareActive` is
false on PRs):

`selectLanes` for `profile: "pr"`, `route: "internal"`, `compareActive: false`
promotes nothing, so `hostedLanes` is the set of `pr`-profile lanes whose
`plane !== "local"` **and** whose `home` is `hosted-proof.yml` — that is
`print-kit` and `db`, the two lanes carrying `plane: "both"`.

| Surface             | Rows | Detail                                                                                                                                                                            |
| ------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`            | 16   | route 1, build 1, visual 8, visual-gate 1, lighthouse 1, zap-baseline 1, local-proof 1, shadow-compare 1 (skipped), release-gate 1                                                |
| `hosted-proof.yml`  | 12   | `print-kit` and `db` run; `e2e` and `a11y` each collapse to one sentinel row; `fast`, `quality`, `mutation`, `load`, `db-stress`, `load-race`, `zap-full` skip; `proof-gate` runs |
| externally produced | 2    | `Analyze (javascript-typescript)`, `Review dependency changes`                                                                                                                    |
| **Total**           | 30   | 168 → 28 workflow rows                                                                                                                                                            |

**During the step-2 shadow window** (`shadowCompare.mode: "all"`, before any
deletion) every `plane: "local"` lane is promoted to `"both"`, so the callee
runs the full fan-out: fast 1 + quality 1 + print-kit 1 + e2e 32 + a11y 16 +
db 1 + five nightly-only skips + proof-gate 1 = 58 callee rows, on top of the
still-intact 168 plus `route`, `local-proof` and `shadow-compare` = **231 rows**.
This is the opposite of the change's motivation and is why the window is
qualification-gated rather than open-ended.

The reference design quotes ≈37 steady-state rows rather than 30. That count
treats each sub-lane as a callee row; the callee has one `e2e` job covering four
lanes and one `a11y` job covering two, and the sentinel matrix collapses each
unselected sharded lane to a single row. **Recompute from the routing table
before opening PR 3b** rather than trusting either figure — the arithmetic is a
function of the table, and the table is expected to change.

## 3.5 Contract-test breakage — `tests/contracts/devops-release-architecture.test.mjs`

Test `"CI exposes one stable release gate over deterministic merge proof"`
(lines 9-29). Four breakages.

| Line  | Assertion                                                                                                                                                                                        | Why it breaks                                                                                                                                          | Must become                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11    | `const releaseGate = ci.slice(ci.indexOf("\n  release-gate:"))`                                                                                                                                  | Step 1 appended `local-proof` **after** `release-gate`, so the slice already carries a foreign job body                                                | `const releaseGate = jobText(".github/workflows/ci.yml", "release-gate")`, plus `assert.notEqual(idx, -1)`                                          |
| 13    | `assert.match(ci, /\n  e2e:\n[\s\S]*?\n    needs: fast\n/)`                                                                                                                                      | `e2e` and `fast` are both deleted from `ci.yml`                                                                                                        | Repoint at `hosted-proof.yml`: assert job `e2e` exists and carries `if: ${{ inputs.run_e2e == 'true' }}`                                            |
| 15-16 | ``for (const dependency of ["fast", "build"]) assert.match(releaseGate, new RegExp(`- ${dependency}`))``                                                                                         | `- fast` appears nowhere; `- build` still does                                                                                                         | Deep-equal the parsed `needs` list against `config/release-gate-contract.json`'s manifest, which is the eight-job list in 3.2                       |
| 17    | ``assert.match(releaseGate, new RegExp(`needs\\.${dependency}\\.result`))``                                                                                                                      | Breaks for **both** `fast` and `build`: the per-lane `_RESULT` shape is abolished in favour of `toJSON(needs)`                                         | `assert.match(releaseGate, /NEEDS_JSON: \$\{\{ toJSON\(needs\) \}\}/)` and `assert.match(releaseGate, /check-release-gate\.mjs/)`                   |
| 19-28 | ``for (const nonBlockingDependency of ["e2e-gate","a11y-gate","visual-gate","lighthouse-gate","zap-baseline","db"]) assert.doesNotMatch(releaseGate, new RegExp(`- ${nonBlockingDependency}`))`` | **Inverts for two of the six.** `visual-gate` and `zap-baseline` are now in `needs`. `e2e-gate`, `a11y-gate`, `lighthouse-gate` and `db` remain absent | Reduce the negative list to `["e2e-gate","a11y-gate","lighthouse-gate","db-gate"]` and add positive assertions for `visual-gate` and `zap-baseline` |

The other tests in this file are untouched by step 3.
`"production database promotion is CI-led, protected and exact-revision"`
(110-168) is step 4's problem; `"scheduled smoke history produces a fail-closed
rolling SLO and error budget"` (220-262) is step 6's.

## 3.6 Contract-test breakage — `tests/contracts/agent-readiness-level5.test.mjs`

Test `"Given routine pull requests When CI runs Then deep browser proof is
sharded into memory-bounded jobs"` (lines 89-197). This is the largest single
repair in step 3 and the file the reference design's own edit list omitted.

**Silently-degrading slices (dangerous — they do not throw).**

| Line    | Slice                                                                                         | After step 3                                                                           | Repair                                                             |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 95      | `buildJob = ci.slice(ci.indexOf("  build:"), ci.indexOf("\n  e2e:"))`                         | second `indexOf` is `-1`; `slice(start, -1)` returns the file tail minus one character | `jobText(…, "build")` + `assert.notEqual(idx, -1)` on both anchors |
| 96-97   | `e2eJob` / `a11yJob` slices                                                                   | both anchors `-1`; `slice(-1, -1)` returns `""`                                        | Delete; the jobs live in `hosted-proof.yml` now                    |
| 181-184 | `lighthouseJob = ci.slice(ci.indexOf("\n  lighthouse:"), ci.indexOf("\n  lighthouse-gate:"))` | end anchor `-1`; slice runs to end of file                                             | `jobText(…, "lighthouse")`                                         |
| 185-188 | `zapJob = ci.slice(ci.indexOf("\n  zap-baseline:"), ci.indexOf("\n  db:"))`                   | end anchor `-1`; slice runs to end of file                                             | `jobText(…, "zap-baseline")`                                       |

**Throwing assertions.**

| Line    | Assertion                                                                                                                                                                                                                      | Why it breaks                                                                                                                          | Must become                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 103     | `assert.match(ci, /quality:check/)`                                                                                                                                                                                            | The only occurrence in `ci.yml` is the comment at `:39` describing `fast`/`quality`/`build`; deleting those jobs rewrites that comment | Either preserve a `pnpm quality:check` reference in the rewritten header comment, or repoint at `ops/local-ci/profiles/pr.json`                           |
| 104-105 | `assert.match(e2eJob, shardMatrixPattern(32))`, `assert.match(a11yJob, shardMatrixPattern(8))`                                                                                                                                 | slices are empty strings                                                                                                               | Repoint both at `hosted-proof.yml`, where the 32- and 8-shard matrices really live                                                                        |
| 124-136 | gate-name loop over `[["e2e-gate","E2E \\(DB-free harness tier\\)","e2e"], ["a11y-gate","Accessibility sweep","a11y"], ["visual-gate","Visual regression","visual"], ["lighthouse-gate","Lighthouse CI","lighthouse"]]`        | three of the four gate jobs are deleted                                                                                                | Reduce to `[["visual-gate","Visual regression","visual"]]`; add a standalone assertion that job `lighthouse` carries `name: Lighthouse CI`                |
| 140-154 | needs table `[["e2e","fast"],["a11y","fast"],["visual","fast"],["db","fast"],["lighthouse","build"],["zap-baseline","build"]]`                                                                                                 | four of six break: `fast` is gone and `e2e`/`a11y`/`db` are gone                                                                       | `[["visual","route"],["lighthouse","build"],["zap-baseline","build"],["local-proof","route"],["hosted-proof","route"]]`                                   |
| 158     | `assert.match(ci, /name: Typecheck and build/)`                                                                                                                                                                                | `build-gate` deleted                                                                                                                   | Delete; the name is added to `retiredCheckNames`                                                                                                          |
| 159     | `assert.match(ci, /needs: \[fast, quality, build\]/)`                                                                                                                                                                          | `build-gate` deleted                                                                                                                   | Delete                                                                                                                                                    |
| 161-167 | ``for (const dependency of ["fast", "build"]) assert.match(ci, new RegExp(`release-gate:[\\s\\S]*?- ${dependency}`), `Release gate must require ${dependency}`)``                                                              | **`fast` no longer exists.** This is one of the two assertions step 3 inverts                                                          | `for (const dependency of ["route","build","visual-gate","lighthouse","zap-baseline","local-proof","hosted-proof","shadow-compare"])` — the full manifest |
| 168-180 | ``for (const nonBlockingDependency of ["e2e-gate","a11y-gate","visual-gate","lighthouse-gate","zap-baseline","db"]) assert.doesNotMatch(ci.slice(ci.indexOf("\n  release-gate:")), new RegExp(`- ${nonBlockingDependency}`))`` | **`visual-gate` and `zap-baseline` are now required.** The second inverted assertion                                                   | Reduce to `["e2e-gate","a11y-gate","lighthouse-gate","db-gate"]`, and re-anchor the slice on `jobText` so an appended job cannot pollute it               |
| 195     | `assert.match(ci, /--collect\.url=/)`                                                                                                                                                                                          | the consolidated `lighthouse` job no longer passes it                                                                                  | Delete; assert instead that `.lighthouserc.json` still carries four `ci.collect.url` entries                                                              |

**Assertions that survive unchanged, and why** — worth stating, because they
look fragile and are not: line 106 `shardMatrixPattern(4)` on `visualJob`
(`visual` keeps its 2×4 matrix); line 107 `shardMatrixPattern(32)` on
`nightly.yml` (no step touches `nightly.yml`); line 112 `/--shard/`, lines
117-118 `PLAYWRIGHT_WORKERS: "1"` and the negative lookahead, line 122
`/\.\/\.github\/actions\/playwright/` — all satisfied by the surviving `visual`
job alone; line 122's sibling `assert.doesNotMatch(visualJob, /PLAYWRIGHT_REGULAR_CHROMIUM/)`
in `architecture-audit-hardening.test.mjs:122`, which is what keeps the blessed
pixel baselines on one rendering engine.

## 3.7 Contract-test breakage — the other five `ci.yml` readers

These are the complete set. `git grep -l 'workflows/ci\.yml'` over `tests/`
returns exactly seven files; the two above plus these five.

| File                                                           | Assertion                                                                                                                                                                   | Breakage                                                                                                                                                                                                                       | Repair                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/contracts/architecture-audit-hardening.test.mjs:79-88`  | `assert.match(ci, /run: pnpm lint/)`; `assert.match(ci, /run: pnpm test/)`; `assert(ci.indexOf("run: pnpm test") < ci.indexOf("run: pnpm build"))`                          | `pnpm lint` and `pnpm test:contracts` leave `ci.yml` with `fast`. Worse, the ordering assert **fails open**: with both `indexOf` calls returning `-1`, `-1 < -1` is false so it happens to throw here, but the shape is unsafe | Read `hosted-proof.yml` instead; add `assert.notEqual(idx, -1)` on every index before comparing                                                                                                                                                  |
| `…:102-123`                                                    | `e2eJob`/`a11yJob` slices then `assert.match(e2eJob, /PLAYWRIGHT_REGULAR_CHROMIUM: "1"/)`                                                                                   | both slices become `""`                                                                                                                                                                                                        | Repoint `e2eJob`/`a11yJob` at `hosted-proof.yml`; **keep `visualJob` on `ci.yml` and keep line 122's `doesNotMatch`**                                                                                                                            |
| `…:125-144`                                                    | `assert.match(ci, /name: DB behavioral moat/)`, `/run: supabase start/`, `/run: pnpm test:db/`, `/run: supabase stop --no-backup/`                                          | the `db` job leaves `ci.yml`                                                                                                                                                                                                   | Repoint the four workflow assertions at `hosted-proof.yml`; **leave the `package.json` `test:db` string assertion at 134-137 and the six `tests/db/architecture-moat.test.mjs` assertions untouched**                                            |
| `tests/contracts/auth-recovery-ux.test.mjs:65,80-83`           | `assertHasExactUrl(ci, "http://host.docker.internal:3147/api/auth/hooks/send-email")`                                                                                       | that URI is `db`'s job env                                                                                                                                                                                                     | Repoint at `hosted-proof.yml`; keep the three other exact-URL assertions (local wrapper, linked wrapper, migration check) unchanged                                                                                                              |
| `tests/contracts/nfc-card-print-wire.test.mjs:21,75-80`        | `Install Chromium for production print-kit rendering`, `PRINT_KIT_PREVIEW_ORIGIN: http://127.0.0.1:3000`, `pnpm posters:verify-pdfs`, `pnpm posters:verify-production-pdfs` | all four live in `quality`                                                                                                                                                                                                     | Repoint line 21 at `hosted-proof.yml`'s `print-kit` job                                                                                                                                                                                          |
| `tests/contracts/production-release-controls.test.mjs:367-381` | `envCheckIndex < lintIndex` over `- run: pnpm env:check:production` and `- run: pnpm lint`; `assert.match(ci, /- run: pnpm security:audit/)`                                | all three strings live in `fast`                                                                                                                                                                                               | Repoint at `hosted-proof.yml`; **preserve `assert.equal(vercel.buildCommand, "pnpm env:check && pnpm build")` and both `assert.notEqual(…, -1)` guards**                                                                                         |
| `…:383-400`                                                    | `generatorIndex < envCheckIndex` over `node scripts/generate-ci-vapid-env.mjs >> "$GITHUB_ENV"`; `assert.doesNotMatch(ci, /ci-vapid-(?:public\|private)-key/)`              | the generator step lives in `fast`                                                                                                                                                                                             | Repoint the ordering pair at `hosted-proof.yml`; **keep the `doesNotMatch` running against `ci.yml` as well**                                                                                                                                    |
| `tests/contracts/production-security-closure.test.mjs:95-105`  | source list at `:96-102` includes `ci.yml`; `assert.equal(/whsec_[A-Za-z0-9+/=_-]{6,}/.test(sources), false)`                                                               | not broken — but `hosted-proof.yml` inherits `db`'s `whsec` fixture line and would be unscanned                                                                                                                                | **Add** `read(".github","workflows","hosted-proof.yml")` to the list. Do not remove `ci.yml`                                                                                                                                                     |
| `…:107-119`                                                    | `for (const workflow of ["ci.yml", "nightly.yml"])` entropy loop on `CUSTOMER_SESSION_SECRET`                                                                               | not broken — `ci.yml:20-37` and `nightly.yml` both keep their fixtures                                                                                                                                                         | **Extend** to `["ci.yml", "nightly.yml", "hosted-proof.yml"]`. The reference design says to replace `nightly.yml`; that is wrong, `nightly.yml` is untouched by every step and still carries the fixture                                         |
| `tests/e2e/production-review-closure.desktop.spec.ts:18-62`    | `const lighthouseJob = workflow.slice(workflow.indexOf("  lighthouse:"))` then `lighthouseJob.split("  zap-baseline:")[0]`                                                  | survives **only while `lighthouse` still precedes `zap-baseline` in file order**, and `indexOf("  lighthouse:")` is only unambiguous once `lighthouse-gate` is deleted                                                         | Preserve the file order, or re-anchor on `jobText`. Add `expect(idx).toBeGreaterThan(-1)`. Note this spec runs in the `e2e` lane, not in `pnpm test:contracts`, so a break here does **not** block PR 3b at contract time — it fails after merge |

## 3.8 The invariant that prevents a lane being silently dropped

> **Total-coverage invariant.** For `config/lane-routing-contract.json` and
> every `(profile, route)` pair in `{pr, main, nightly} × {internal, fork,
fallback}`, let `S = selectLanes({contract, route, profile, compareActive})`.
> Then:
>
> 1. `S.localLanes ∪ S.hostedLanes` equals the full set of lanes whose
>    `profiles` includes `profile`. Every lane is proved on at least one plane
>    on every route. A non-empty intersection is allowed and expected: a
>    `plane: "both"` lane is deliberately in both.
> 2. `lane.plane === "hosted"` ⇒ `lane.id ∈ selectLanes({route: "internal"}).hostedLanes`.
>    A hosted-pinned lane runs on the **same-repo merge path**, not only on
>    fork PRs. This is the clause whose absence made "hosted-only" lanes
>    disappear from the merge path entirely.
> 3. `lane.plane === "hosted"` ⇔ `lane.id` is absent from both
>    `ops/local-ci/profiles/pr.json` and `main.json`; and every lane with
>    `plane ∈ {local, both}` is present in both.
> 4. `lane.home === "hosted-proof.yml"` ⇒ `.github/workflows/hosted-proof.yml`
>    contains a literal selection guard for that id.
> 5. `lane.qualification.consecutiveFailures >= contract.hostedOnlyAfterFailures`
>    ⇒ `lane.plane === "hosted"`, `decidedOn` is an ISO date and `reason` is a
>    non-empty string. This is the machine form of "an ARM64-incompatible lane
>    that fails qualification twice stays GitHub-hosted permanently".
> 6. Fork and fallback routes ignore `plane` entirely, for **every** possible
>    assignment of `plane` values.
> 7. `shadowCompare.mode !== "all"` ⇒ `provedShas.length >= requiredConsecutiveEquivalent`
>    and every entry matches `/^[0-9a-f]{40}$/`.

Alongside it, a second, blunter invariant covers the specific thing a merge
must never lose:

> **Frozen merge-blocking baseline.** The ten commands that are merge-blocking
> today — `node scripts/generate-ci-vapid-env.mjs`, `pnpm env:check:production`,
> `pnpm security:audit`, `pnpm lint`, `pnpm typecheck`, `pnpm test:contracts`,
> `pnpm test:coverage` (all from `fast`), `pnpm build`, `pnpm bundle:check`,
> `pnpm jsonld:check` (from `build`) — must each still appear on a surface the
> release gate blocks on. For a lane that has left `ci.yml`, that means the
> command appears in **both** `ops/local-ci/profiles/pr.json` (the same-repo
> route) and the corresponding `hosted-proof.yml` job slice (the fork and
> fallback route). Requiring both surfaces is what stops a hosted-only lane
> from quietly leaving the merge path.

**Machine-checked in three independent layers**, so no single one is
load-bearing:

1. **Contract time**, inside `pnpm test:contracts` — which itself runs in the
   `fast` lane and later in the `fast` lane's local and hosted replacements.
   `tests/contracts/lane-routing.test.mjs` (nine tests, one per invariant
   clause plus a tampered-table negative fixture and a branch-protection
   check); `tests/contracts/release-gate-graph.test.mjs` Test 1 (the frozen
   baseline, held as a literal `EXPECTED_BASELINE` array in the **test file**
   as well as in `config/release-gate-contract.json`, so shrinking it needs two
   edits in two files), Test 2 (a `ci.yml` job absent from the graph must have
   every `coveredBy` proof lane already `enforcement: "blocking"` and its
   commands present in both surfaces), Test 3 (`appId`/`repositoryId` pinned to
   positive integers before any proof lane may block; `retiredCheckNames`
   absent from `ruleset.requiredChecks`).
2. **Runtime, inside the called workflow.** `scripts/aggregate-proof-summary.mjs`
   exits non-zero when any id in `inputs.lanes` produced no lane-result
   artifact. A lane whose job is silently dropped from `hosted-proof.yml` fails
   the hosted plane before the caller sees a summary.
3. **Runtime, at the gate.** `scripts/check-release-gate.mjs` recomputes the
   expected lane sets from the committed contracts and requires set equality
   against both plane summaries. It runs **on GitHub, from the PR's own
   commit**, so it holds even in the pathological case where a PR edits the
   routing table and the contract tests that would have caught it are
   themselves a lane on the local plane.

## 3.9 Step 3 summary

- **Files touched (3a):** `config/lane-routing-contract.json`,
  `config/release-gate-contract.json`, eleven new `scripts/*.mjs`,
  `.github/actions/lane-result/action.yml`,
  `.github/workflows/hosted-proof.yml`, `.github/workflows/ci.yml` (three jobs
  added), `.github/CODEOWNERS` (explicit lines for the two config files and for
  `scripts/check-release-gate.mjs` / `scripts/lane-routing.mjs`),
  `package.json` (`ops:ci:lanes`, `ops:ci:route`, `ops:ci:compare`,
  `ops:ci:qualification`, `ops:ci:gate`), `AGENTS.md` (every new `pnpm ops:ci:*`
  string, or `pnpm agents:check` fails).
- **Files touched (3b):** `.github/workflows/ci.yml` (ten jobs deleted,
  `release-gate` rewritten), the seven contract/e2e test files in 3.5-3.7,
  `config/release-gate-contract.json` (`stage`, `advisoryLanes`,
  `shadowCompare.mode`, `shadowCompare.provedShas`, `retiredCheckNames`), and
  `config/local-ci-contract.json` — which ships from step 1 already carrying its
  own step-3 instructions: `cutoverStep: 1 → 3`,
  `stage: "bridge-shadow" → "bridge-enforcing"`,
  `shadowMode.enabled: true → false` (the shipped block records
  `flipsAtCutoverStep: 3`), `bridge.enforcement: "advisory" → "blocking"`, and
  `bridge.dependents: [] → ["release-gate"]`. `bridge.requiredCheck` stays
  `false` forever — the bridge reaches branch protection only through
  `Release gate`.
- **Tests that break:** `devops-release-architecture.test.mjs` (5 assertions),
  `agent-readiness-level5.test.mjs` (11 assertions plus 4 unsafe slices),
  `architecture-audit-hardening.test.mjs` (3 tests),
  `auth-recovery-ux.test.mjs` (1), `nfc-card-print-wire.test.mjs` (1),
  `production-release-controls.test.mjs` (2),
  `production-review-closure.desktop.spec.ts` (1, after merge only).
- **Manual prerequisites:** the GitHub App installed with `appId` and
  `repositoryId` pinned; the Lima VM and launchd agent provisioned;
  `gh variable set LOCAL_CI_MODE`; `node scripts/check-shadow-qualification.mjs`
  reporting `satisfied: true` over three consecutive same-repo SHAs; one real
  fork PR observed routing to `hosted-proof` with `local-proof` skipped; one
  `LOCAL_CI_FALLBACK_SHA` rehearsal using **"Re-run all jobs"**, never "Re-run
  failed jobs" (a failed-jobs re-run does not re-evaluate `route`, so
  `hosted-proof` stays skipped and the gate fails closed); and — the hard
  precondition — `pnpm ops:github:check` reporting the new
  `github:ruleset-status-checks-exact` finding as **PASS**. The exact-name
  check in `scripts/github-governance/checks.mjs` requires strict mode and
  rejects both missing and unexpected names. Its live readback must prove
  the ruleset does not also require `Typecheck and build`, `E2E
(DB-free harness tier)`, `Accessibility sweep` or `DB behavioral moat gate`.
  Deleting a job whose check name is live-required deadlocks every subsequent
  PR until a repository admin edits branch protection.
- **Rollback:** revert PR 3b. It is a single commit that touches only `ci.yml`,
  seven test files and one config file; reverting restores all 168 jobs and the
  `[fast, build]` gate. 3a can stay merged — it is inert without 3b.

---

# Step 4 — real protected Staging

Converts `production-database.yml`'s `staging` job from the cost-neutral
ephemeral proof (`.github/workflows/production-database.yml:78-193`) into an
`environment: Staging` deployment against a real, isolated hosted Supabase
project and the Vercel `staging` custom environment.

The repository's own readback contradicts the premise today and must be
re-verified before the PR is opened: `docs/operations/devops-maturity.md:100`
records "No isolated Supabase project or staging provider credentials exist",
and `:105` records "An empty custom `staging` target exists without branch
tracking or copied production values".

## 4.1 Three verified constraints that shape the conversion

**(a) `STAGING_APP_URL` is required unconditionally, before the mode branch.**
`scripts/check-staging-release.mjs:51-54` reads

```js
const appUrl = parseOrigin(required(env, "STAGING_APP_URL"), "staging app URL")
```

and the hosted branch does not begin until `:66` (`if (mode === HOSTED_MODE)`).
`required` throws at `:625-629` (`assert.ok(value, …)`). So deleting the
job-level `STAGING_APP_URL: http://127.0.0.1:3000` (`:87`) without re-exporting
it aborts `pnpm smoke:staging` before any hosted logic runs. In hosted mode the
value must additionally be HTTPS (`:73`) and carry a `*.vercel.app` hostname
(`:74-78`), so it must be the **immutable deployment URL**, not an alias. The
`id: deploy` step already computes that URL for its `/v13/deployments/$host`
identity poll and for `environment.url`; it must also write it to the job
environment:

```sh
printf 'STAGING_APP_URL=%s\n' "$url" >> "$GITHUB_ENV"
```

A verification command for this exact failure is worth keeping in the PR
description: the staging job slice must contain the literal `STAGING_APP_URL=`.

**(b) `vars.SUPABASE_PROJECT_REF` is a Production-environment variable**
(`config/github-governance-contract.json:47`). A job carrying
`environment: Staging` resolves it to the empty string, so a separation guard
written as `test "$STAGING_SUPABASE_PROJECT_REF" != "${{ vars.SUPABASE_PROJECT_REF }}"`
would pass **vacuously against the production ref itself**. The guard must
instead read the committed production ref through a new
`scripts/staging-release-target.mjs` that loads
`config/supabase-governance-contract.json` **module-relative**, exactly as
`scripts/production-poster-supabase-target.mjs:3-6` does:

```js
const CONTRACT_URL = new URL(
  "../config/supabase-governance-contract.json",
  import.meta.url
)
```

A cwd-relative read would let a planted decoy contract weaken the guard.
The script exports `CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF`
(`skonlhwstejberyzobep`), `CANONICAL_VERCEL_PROJECT_ID`
(`prj_Au5baPD1CUlACwN3ECminQZOITcQ`), `CANONICAL_VERCEL_TEAM_ID`
(`team_owp80yoz88o4JEgWnPi0ldJH`), `CANONICAL_VERCEL_SCOPE`
(`lapen-inns-projects`) and `CANONICAL_VERCEL_STAGING_SLUG` (`staging`) from the
two committed contracts.

**(c) Two contract assertions invert in the same commit.**
`tests/contracts/devops-release-architecture.test.mjs:130` is

```js
assert.doesNotMatch(workflow, /environment: Staging/)
```

and `:146` is

```js
assert.doesNotMatch(workflow, /secrets\.STAGING_/)
```

Both become positive. The second becomes eight distinct positive matches, one
per secret name, so that adding `environment: Staging` cannot silently ship with
a subset of the credentials wired.

## 4.2 The eight Staging secrets and three Staging variables

Grepped from `config/github-governance-contract.json:22-31` and `:32-36`, and
cross-checked against `git grep -o 'STAGING_[A-Z_]*'` over the whole tree, which
returns no other `secrets.`-shaped names.

Secrets (all eight are also in `forbiddenRepositorySecrets` at `:64-82`, so they
must exist **only** in the `Staging` environment, never at repository scope):

1. `STAGING_MONITOR_SECRET`
2. `STAGING_RESEND_WEBHOOK_SECRET`
3. `STAGING_STRIPE_WEBHOOK_SECRET`
4. `STAGING_SUPABASE_ACCESS_TOKEN`
5. `STAGING_SUPABASE_DB_PASSWORD`
6. `STAGING_SUPABASE_DB_URL`
7. `STAGING_VERCEL_AUTOMATION_BYPASS_SECRET`
8. `STAGING_VERCEL_TOKEN`

Variables: `STAGING_SUPABASE_PROJECT_REF`, `STAGING_VERCEL_ORG_ID`,
`STAGING_VERCEL_PROJECT_ID`.

Three of the secrets are **not independent values** — they must equal the
corresponding Vercel staging environment values or the signed-webhook replay in
`pnpm smoke:staging` cannot verify: `STAGING_MONITOR_SECRET` =
staging `PRODUCTION_MONITOR_SECRET`; `STAGING_STRIPE_WEBHOOK_SECRET` =
staging `STRIPE_WEBHOOK_SECRET`; `STAGING_RESEND_WEBHOOK_SECRET` =
staging `RESEND_WEBHOOK_SECRET`.

The Supabase CLI reads the **unprefixed** names, so the job must additionally
map `SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}` and
`SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_SUPABASE_DB_PASSWORD }}` at job
scope. Those two literal strings already appear in the workflow (asserted at
`devops-release-architecture.test.mjs:147-148`), so the existing assertions keep
passing.

## 4.3 The converted `staging` job

Job id stays `staging` — `production-database.yml:197` is `needs: staging` and
must not move. Display name becomes `Protected staging release proof`.
`environment: { name: Staging, url: ${{ steps.deploy.outputs.url }} }`.
`timeout-minutes: 25 → 45`. `permissions: contents: read` is unchanged; the
`environment:` key is what creates the deployment record.

**Env deletions** from `:85-99`: `STAGING_MODE: ephemeral`, `SUPABASE_DB_URL`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `VERCEL_GIT_COMMIT_SHA`,
`VERCEL_ENV`, `VERCEL_TARGET_ENV`. **Kept:** `EXPECTED_REVISION`,
`STAGING_EXPECTED_REVISION`, `STAGING_RUN_ID`, `DO_NOT_TRACK`. **Added:**
`STAGING_MODE: hosted`, the eight secrets, the three variables, the two
unprefixed CLI aliases, and

```yaml
SUPABASE_SEND_EMAIL_HOOK_URI: https://nabaperks-staging.invalid/api/auth/hooks/send-email
```

an RFC 2606 `.invalid` host. **Without it,
`scripts/check-supabase-migrations.mjs:170-171` falls back to the production
hook URI** (`env.SUPABASE_SEND_EMAIL_HOOK_URI || linkedHookUri`), which would
point a staging migration check at production.

**Step order** (each numbered step is one `- name:` block):

1. Checkout at the exact SHA, `fetch-depth: 0`.
2. Immutability and mode guard: `test "$(git rev-parse HEAD)" = "$EXPECTED_REVISION"`;
   `test "$(git rev-parse origin/main)" = "$EXPECTED_REVISION"`;
   `test "$STAGING_MODE" = "hosted"`; `test -n` on all eleven secret and
   variable values; the hook URI must differ from
   `https://nabaperks.com/api/auth/hooks/send-email`.
3. `node scripts/staging-release-target.mjs --github-env "$GITHUB_ENV" --evidence "$RUNNER_TEMP/staging-vercel-target.json"`.
4. Separation guard, using the canonical values from step 3:
   `test "$STAGING_SUPABASE_PROJECT_REF" != "$CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF"`;
   `test "$STAGING_VERCEL_PROJECT_ID" = "$CANONICAL_VERCEL_PROJECT_ID"`;
   `test "$STAGING_VERCEL_ORG_ID" = "$CANONICAL_VERCEL_TEAM_ID"`;
   `test "$CANONICAL_VERCEL_STAGING_SLUG" = "staging"`.
5. `uses: ./.github/actions/setup`.
6. `uses: supabase/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520 # v3`
   with `version: 2.106.0` — the same pin as `production-database.yml:113-115`.
7. Pin the Vercel CLI: `test "$(pnpm exec vercel --version | tail -n 1)" = "56.5.0"`.
8. Parser-only auth-hook fixture: a verbatim copy of
   `production-database.yml:221-225` (`openssl rand -base64 32`,
   `::add-mask::`, `>> "$GITHUB_ENV"`).
9. `supabase link --project-ref "$STAGING_SUPABASE_PROJECT_REF"`, then
   `supabase db push --linked --dry-run --include-all`, then
   `supabase db push --linked --include-all`, then
   `node scripts/check-supabase-migrations.mjs` — dry-run, apply, verify, in
   that order.
10. `id: deploy` —
    `pnpm exec vercel deploy --target=staging --skip-domain --no-wait --archive=tgz --yes --project="$CANONICAL_VERCEL_PROJECT_ID" --scope="$CANONICAL_VERCEL_SCOPE" --meta githubCommitSha="$EXPECTED_REVISION" --token="$STAGING_VERCEL_TOKEN"`,
    then `host="${url#https://}"`, `echo "url=$url" >> "$GITHUB_OUTPUT"` **and
    `printf 'STAGING_APP_URL=%s\n' "$url" >> "$GITHUB_ENV"`** (constraint (a)).
11. Deployment-identity assertion: `vercel api /v13/deployments/$host --raw`
    piped through `jq -e '.projectId == $pid and .ownerId == $tid and .target != "production" and .customEnvironment.slug == "staging"'`.
12. Build-state poll on `readyState`, 60 × 10 s, exiting non-zero immediately on
    `ERROR` or `CANCELED`.
13. Revision-matched health and authenticated readiness poll, 90 × 10 s, both
    curls carrying `--header "x-vercel-protection-bypass: $STAGING_VERCEL_AUTOMATION_BYPASS_SECRET"`,
    with `jq` on `.environment == "preview" and .targetEnvironment == "staging"`.
14. `run: pnpm smoke:staging -- --evidence "$RUNNER_TEMP/staging-release-proof.json"`
    — the literal `run: pnpm smoke:staging` is preserved so
    `devops-release-architecture.test.mjs:144` keeps passing.
15. `node scripts/check-staging-evidence.mjs` plus a `grep -qF` literal-value
    sweep over the nine secret values, both **before** the upload.
16. `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` with
    `name: staging-evidence-${{ env.EXPECTED_REVISION }}`,
    `if-no-files-found: error`, `retention-days: 90`.
17. Step summary.

**Deleted steps:** `Generate ephemeral-only provider fixtures` (`:116-150`),
`Start isolated Supabase and export ephemeral API keys` (`:151-159`), `Build and
start the exact revision locally` (`:162-174`), `Stop ephemeral staging`
(`:187-193`).

**Never present in this job:** `--prod`, `vercel promote`,
`secrets.VERCEL_TOKEN`, `supabase db reset|seed|migration repair`, `--force`,
`set -x`, `nabaperks.com`. Negative assertions for the first four run against
the **staging slice only**, via `jobText`, because `promote` legitimately
contains `--prod` and `nabaperks.com`.

**`promote` (`:195-240`) is unchanged**, including `environment: Production` and
`needs: staging`. That single approval gate is the production boundary.

**The ephemeral path is not deleted.** It is still asserted by
`devops-release-architecture.test.mjs:170-191` (`EPHEMERAL_MODE`, `fixed
loopback origin`) and by `tests/unit/staging-release-config.test.mjs:23-33,44-51`,
and it is the only fallback when the staging Supabase project auto-pauses.
Expose it through a `workflow_dispatch` input `staging_mode`
(`type: choice`, `[hosted, ephemeral]`, default `hosted`).

## 4.4 Script and test changes

`scripts/check-staging-release.mjs` hosted branch gains: a required
`STAGING_PRODUCTION_SUPABASE_PROJECT_REF` (20 characters) with
`assert.notEqual(projectRef, productionRef, "staging must not target the production Supabase project")`
and a DB-URL check that the production ref appears neither as a hostname
substring nor as a `.${productionRef}` username suffix; a production-domain
refusal (`hostname !== "nabaperks.com"` and not `.nabaperks.com`); a pre-sweep
`delete from public.stripe_webhook_events where stripe_event_id like 'evt_staging_%' and received_at < now() - interval '30 minutes'`
with a post-`finally` zero-residue assertion; an assertion on the already-selected
but never-asserted `current_user`; and a `--evidence <path>` flag with per-step
timing written in a `finally`, so a **failed** run still produces an artifact.

Evidence redaction is three layers, and the middle one is the important one:
allowlist construction (never spread `config`, `env` or driver rows); a
`failureCode` drawn from a **closed enum** of the script's own static assertion
messages, with `error.message` and `error.stack` never written — the `postgres`
driver embeds the connection string in its error text, which is the single most
likely leak path; and `scripts/check-staging-evidence.mjs` rejecting any key
outside the exact allowlist and any string leaf matching `postgres(ql)?://`,
`whsec_`, `^sbp_`, `^sk_(test|live)_`, `^re_`, `^eyJ`, `://…@`, or an unexpected
32-character-or-longer base64/hex run.

**Contract edits to `"production database promotion is CI-led, protected and
exact-revision"`** (by assertion text, since line numbers move):

- _Invert:_ `assert.doesNotMatch(workflow, /environment: Staging/)` → `assert.match`;
  `assert.doesNotMatch(workflow, /secrets\.STAGING_/)` → eight positive matches.
- _Replace:_ `/name: Cost-neutral ephemeral release proof/` →
  `/name: Protected staging release proof/`; `/STAGING_MODE: ephemeral/` →
  `/STAGING_MODE: hosted/`.
- _Delete:_ `/export_fixture STRIPE_LAUNCH_PRICE_ID/`, `/supabase start/`,
  `/node scripts\/check-supabase-migrations\.mjs --local/`, `/pnpm build/`,
  `/pnpm start/`.
- _Add:_ `/--target=staging/`, `/--skip-domain/`, `/--meta githubCommitSha/`,
  `/x-vercel-protection-bypass/`, `/retention-days: 90/`,
  `/node scripts\/staging-release-target\.mjs/`,
  `/CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF/`, `/STAGING_APP_URL=/`;
  staging-slice-only negatives for `/--prod\b/`, `/vercel promote/`,
  `/secrets\.VERCEL_TOKEN/`, `/nabaperks\.com/`; an ordering assertion that
  `environment:\n      name: Staging` precedes `environment: Production`; and a
  **second** dry-run → apply → verify ordering block anchored on the `staging`
  job. The existing block at `:152-165` searches from `promoteJob` and is
  correct only while `staging` precedes `promote` in the file.
- _Keep unchanged:_ `run: pnpm smoke:staging`, `needs: staging`,
  `secrets.SUPABASE_ACCESS_TOKEN`, `secrets.SUPABASE_DB_PASSWORD`,
  `vars.SUPABASE_PROJECT_REF`, `git rev-parse origin/main`, the promote-side
  ordering block, `doesNotMatch(/supabase (db reset|seed|migration repair)/)`,
  `doesNotMatch(/--force/)`, and the entire `"staging proof is isolated,
exact-revision, replay-safe and rollback-only"` test at `:170-191` — including
  `assert.match(script, /required\(env, "STAGING_APP_URL"\)/)` at `:190`, which
  is the assertion that pins constraint (a) in place.

New `tests/unit/staging-release-config.test.mjs` cases: equal staging and
production refs throw; a DB URL whose hostname contains the production ref
throws; the pooler username shape `postgres.<ref>` throws; a missing
`STAGING_PRODUCTION_SUPABASE_PROJECT_REF` throws; a missing bypass secret
throws; `https://staging.nabaperks.com` throws on both the domain guard and the
`*.vercel.app` guard; an omitted `STAGING_MODE` resolves to hosted; the
ephemeral fixture still resolves; and **a missing `STAGING_APP_URL` throws in
both modes**.

## 4.5 Step 4 summary

- **Files touched:** `.github/workflows/production-database.yml`,
  `scripts/check-staging-release.mjs`, `scripts/staging-release-target.mjs`
  (new), `scripts/check-staging-evidence.mjs` (new),
  `config/github-governance-contract.json` (`Staging.independentReview` only),
  `tests/contracts/devops-release-architecture.test.mjs`,
  `tests/unit/staging-release-config.test.mjs`,
  `docs/operations/devops-maturity.md` (rows 100 and 105 restated).
- **Tests that break:** `devops-release-architecture.test.mjs:128-135` and
  `:146` (six assertions inverted or replaced, five deleted, eight added).
  `tests/unit/staging-release-config.test.mjs` gains nine cases and keeps its
  existing ephemeral cases.
- **Manual prerequisites, in order:**
  1. Provision a same-region (`eu-west-2`) staging Supabase project.
  2. Populate the GitHub `Staging` environment with the eight secrets and three
     variables above.
  3. Populate Vercel's `staging` custom environment with the 21 keys at
     `config/vercel-governance-contract.json:83-104` plus one of the
     `requiredAnyOf` Twilio combinations at `:106-108`. **`STAGING_MODE` must
     NOT be set in the Vercel staging environment**:
     `app/api/readiness/route.ts:42-43` computes
     `allowLoopback = targetEnvironment === "staging" && process.env.STAGING_MODE === "ephemeral"`,
     and a hosted deployment must never allow loopback.
  4. Set the three mirrored secrets described in 4.2.
  5. **Remove the `required_reviewers` rule from the GitHub `Staging`
     environment** and set `Staging.independentReview: false` in the same
     commit. `scripts/github-governance/checks.mjs:64-88` turns `true` into a
     `required_reviewers` rule, and GitHub evaluates environment protection
     **before** the job starts — so leaving it true places an approval in front
     of the staging deploy, and with `production-database.yml:19-21`
     (`group: production-database-promotion`, `cancel-in-progress: false`) one
     un-approved run blocks every later main revision indefinitely.
     `checks.mjs:52-62` still enforces
     `deployment_branch_policy.protected_branches`, so only `main` deploys
     there.
  6. **Gate:** `pnpm ops:github:check` reports `environment:Staging:secrets`,
     `environment:Staging:variables` and `github:isolated-staging-project` as
     PASS; `pnpm ops:vercel:check` reports `vercel:staging-target` PASS with all
     21 keys present.
  7. **Gate:** one `workflow_dispatch` run with `staging_mode: hosted`
     qualifies three unverifiable-from-here behaviours: that
     `vercel deploy --target=staging --skip-domain` on the pinned CLI 56.5.0
     yields an immutable `*.vercel.app` URL without reassigning the staging
     alias and reports `VERCEL_ENV=preview` with `VERCEL_TARGET_ENV=staging`
     (`--skip-domain` is documented primarily for `--prod`); that a brand-new
     project with no signal history can satisfy
     `readiness.checks.operational === "ok"`
     (`app/api/readiness/route.ts:61`; only `requireCronHealth` is exempted for
     staging, at `:54`); and that the rolled-back loyalty journey works as a
     non-superuser on hosted Supabase, since it inserts into `auth.users` and
     drives the `force row level security` policies via `set_config`. If the
     readiness gate cannot be met, the fix belongs in
     `lib/observability/operational-signals.ts` (treat an empty signal set as
     `ok` for `targetEnvironment === "staging"`, the same shape as the existing
     cron exemption) — **never** by relaxing the assertion, which is absolute in
     both modes.
  8. Record the staging project ref in
     `config/supabase-governance-contract.json` once it exists.
- **Rollback:** revert the workflow commit and re-run
  `production-database.yml` with `staging_mode: ephemeral`. The ephemeral branch
  is retained specifically as this rollback path. The GitHub environment
  secrets can stay in place; they are inert without the workflow.

---

# Step 5 — paging and independent uptime

Two independent things land together because both are prerequisites for step 6's
availability calculation: the production-alert HMAC becomes a rotatable secret
with no cutover window, and UptimeRobot becomes a real external observer.

## 5.1 The HMAC rotation, with a NEXT-secret overlap

The receiver today accepts exactly one secret.
`supabase/functions/production-alert/index.mjs:77` passes
`secret: Deno.env.get("PRODUCTION_ALERT_WEBHOOK_SECRET") ?? ""` into
`verifyProductionAlert`, and
`supabase/functions/_shared/production-alert-core.mjs:178-179` rejects with
`503 receiver_not_configured` when the value is shorter than 32 or longer than
512 characters. A straight rotation therefore has a hard window in which senders
sign with the new value and the receiver still holds the old one, and every
alert in that window is silently lost — which is the worst possible failure mode
for a paging path.

**Code change (lands first, in its own commit).**
`verifyProductionAlert` takes an ordered **list** of candidate secrets, applies
the 32-512 bound per candidate, computes `expectedSignature`
(`production-alert-core.mjs:82`) per candidate and accepts the first
constant-time match. `reject(503, "receiver_not_configured")` fires only when no
candidate is valid. `index.mjs:77` becomes
`[PRODUCTION_ALERT_WEBHOOK_SECRET, PRODUCTION_ALERT_WEBHOOK_SECRET_NEXT].filter(Boolean)`.
`production-deploy.yml:141-148` tolerates and reports the `_NEXT` name without
requiring it. **Verify-before-parse ordering must be preserved** — it is
asserted at `tests/contracts/production-alert-receiver.test.mjs:34`. This
mirrors `lib/security/cron-auth.ts:24` `matchesAnyBearerSecret`, the
already-reviewed pattern used for `PRODUCTION_MONITOR_SECRET`.

**The three places the value is installed.** All three must eventually hold the
same value; the rotation is the ordered walk between them.

1. **Supabase Edge Function secret on project `skonlhwstejberyzobep`** — read at
   `production-alert/index.mjs:77`. Its presence is proved on every production
   deploy by `production-deploy.yml:141-148`, which lists the function secrets
   and requires `PRODUCTION_ALERT_WEBHOOK_SECRET` among them.
2. **GitHub `Production` environment secret** — consumed at
   `production-deploy.yml:76`, guarded by `test -n "$PRODUCTION_ALERT_WEBHOOK_SECRET"`
   at `:92`.
3. **GitHub `Monitoring` environment secret** — consumed at
   `production-smoke.yml:115` and `:191`, and `slo-report.yml:93` and `:115`.

It is also listed in `config/github-governance-contract.json:65`
`forbiddenRepositorySecrets`, so it must never exist at repository scope.

**Rotation procedure.** Every phase ends with a proof run; do not proceed on a
failed proof.

| Phase | Action                                                                                         | State                                         |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0     | Merge and deploy the candidate-list receiver. No value changes.                                | Receiver accepts old only                     |
| 1     | Set `PRODUCTION_ALERT_WEBHOOK_SECRET_NEXT` = new value on the Supabase function; redeploy it.  | Receiver accepts **old or new**               |
| 2     | Set `PRODUCTION_ALERT_WEBHOOK_SECRET` = new value in GitHub `Production` **and** `Monitoring`. | Senders sign new; receiver still accepts both |
| 3     | Set `PRODUCTION_ALERT_WEBHOOK_SECRET` = new value on the Supabase function; redeploy.          | All three aligned; `_NEXT` now redundant      |
| 4     | Delete `PRODUCTION_ALERT_WEBHOOK_SECRET_NEXT` from the function; redeploy.                     | Overlap closed                                |

There is no window in which a correctly-signed alert is rejected, because the
receiver holds both values across phases 1-3.

**The proof must run inside GitHub Actions.** `scripts/notify-production-alert.mjs`
requires `GITHUB_REPOSITORY === "lapeninns/nabaperks"` (`:36-40`),
`GITHUB_SERVER_URL === "https://github.com"` (`:42-43`) and a numeric
`GITHUB_RUN_ID` (`:45-46`); and `production-alert-core.mjs:138-145` rejects any
payload whose `runUrl` does not match
`^https://github\.com/lapeninns/nabaperks/actions/runs/\d+$` with
`400 invalid_run_url`. A laptop cannot produce a valid payload, by design.

**`scripts/check-alert-delivery.mjs` (new).** Today's only paging proof is the
release-canary trigger/resolve pair at `production-deploy.yml:165-166`, which
proves neither deduplication nor Resend delivery. The new script runs
immediately after `:166` and does three things: (1) issues one
`trigger release-canary` and one **byte-identical replay** with the same
`deliveryId`, asserting the second is rejected by the dedup path
(`production-alert-core.mjs:114-129`, `:239 completeDelivery(payload.deliveryId)`);
(2) issues a fresh `deliveryId` and asserts acceptance, proving the dedup key is
per-delivery and not per-kind; (3) reads the Resend delivery id back from the
function's response body and asserts it is non-empty. Registered as
`ops:alert:verify`.

**Governance change:** add `"PRODUCTION_ALERT_WEBHOOK_SECRET"` to
`environments.Production.requiredSecrets`
(`config/github-governance-contract.json:40-46`). This closes a real existing
gap — `production-deploy.yml:76,92,141-148` consumes and requires it, and
governance does not currently prove the `Production` copy exists.

## 5.2 UptimeRobot configuration

**Operator amendment (2026-09-05):** the operator rejected both UptimeRobot and
Healthchecks and selected a GitHub Actions watchdog. The implementation and
activation rehearsal are specified in [the watchdog runbook](local-ci-watchdog.md).
The external-provider objects below are superseded for this installation; do
not create their accounts or secrets. GitHub schedules can be delayed or dropped,
so this choice does not satisfy an independent availability observer or a fixed
alert deadline. Step 6's UptimeRobot uptime-ratio reader and seven-day warm-up
must be redesigned and qualified before any availability gate is promoted;
passing scheduled probes must not be represented as an independent uptime ratio.
The ordering and evidence requirements for every other cutover step remain.

Three provider-side objects, none of which can be created from the repository.

1. **Public health monitor.** Keyword monitor on
   `https://nabaperks.com/api/health`, **5-minute interval**, asserting the
   response contains `"status":"ok"`. Friendly name exactly
   `nabaperks-production-health` — the reader matches on both the friendly name
   and the URL and rejects a monitor whose `url` differs.
2. **CI-agent heartbeat monitor.** Friendly name
   `nabaperks-local-ci-agent`, expected interval 5 minutes, grace period 15
   minutes. The local CI agent pushes to its heartbeat URL from
   `~/.nabaperks-local-ci/` (mode `0600`, never in git). This monitor is
   **reported, not gating** — coupling production availability to CI-agent
   liveness is a category error. `agentLiveness.gating: false` is explicit in
   config and asserted by a contract test. Agent liveness is proved on the
   merge path by `check-local-ci-proof.mjs` and nightly by
   `check-nightly-proof.mjs`; this monitor exists only so a silent agent pages a
   human out of hours.
3. **Read-only API key**, installed as `UPTIMEROBOT_READ_API_KEY` in the GitHub
   **`Monitoring`** environment. Governance changes:
   append it to `environments.Monitoring.requiredSecrets`
   (`config/github-governance-contract.json:51-55`) and insert it into
   `forbiddenRepositorySecrets` between `SUPABASE_SEND_EMAIL_HOOK_SECRET`
   (`:80`) and `VERCEL_TOKEN` (`:81`), taking that list from **17 to 18**
   entries.

**Confirm the API contract against live documentation before the reader
ships.** There are zero UptimeRobot references anywhere in the tree today, so
nothing here is verifiable from the repository: specifically, whether the v2
form-encoded `getMonitors` endpoint with `custom_uptime_ratios` is still the
right surface versus the newer v3 Bearer REST API, and whether the plan in use
returns `custom_uptime_ratio` for a read-only key. Mitigation: `apiVersion` and
`endpoint` are config-driven fields (see step 6), so a v3 switch is a JSON edit
plus the module's request builder, and the unit test asserts the request shape
**from config**.

## 5.3 Step 5 summary

- **Files touched:** `supabase/functions/_shared/production-alert-core.mjs`,
  `supabase/functions/production-alert/index.mjs`,
  `scripts/check-alert-delivery.mjs` (new), `.github/workflows/production-deploy.yml`,
  `config/github-governance-contract.json`, `package.json` (`ops:alert:verify`),
  `AGENTS.md`, `tests/unit/production-alert.test.mjs`,
  `tests/unit/alert-delivery-proof.test.mjs` (new),
  `tests/contracts/production-alert-receiver.test.mjs`.
- **Tests that break:** `tests/unit/production-alert.test.mjs:13,99` pass a
  single `PRODUCTION_ALERT_WEBHOOK_SECRET`; they gain candidate-list cases
  (old accepted, new accepted, neither accepted → `503 receiver_not_configured`,
  empty list → `503`). `tests/contracts/production-alert-receiver.test.mjs:20`
  names the single secret and `:34` pins verify-before-parse; the first is
  extended, the second must not move.
  `tests/contracts/production-operational-readiness.test.mjs:120`
  (`assert.match(workflow, /secrets\.PRODUCTION_ALERT_WEBHOOK_SECRET/)`)
  survives unchanged.
- **Manual prerequisites:** the five-phase rotation above; both UptimeRobot
  monitors created; the read-only key minted and installed in `Monitoring`;
  `PRODUCTION_ALERT_WEBHOOK_URL` in `Monitoring` set to
  `https://skonlhwstejberyzobep.supabase.co/functions/v1/production-alert`.
- **Rollback:** the rotation is reversible at any phase before 4 by removing the
  new value and leaving the old one in place; phase 4 is the point of no
  return, and it is deliberately the last and cheapest step. The
  candidate-list receiver is backward-compatible with a single secret, so the
  code change never needs reverting.

---

# Step 6 — SLO v2 and the recovery contract

## 6.1 Probe cadence drops to hourly

`config/production-slos.json` today runs the smoke probe every 15 minutes
(`:6-7`) and `.github/workflows/production-smoke.yml:5` carries the matching
`cron: "7/15 * * * *"`. Step 6 drops both to hourly.

| Field                                                                                                         | Today (line)                          | v2                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `schema`                                                                                                      | `nabaperks.production-slos.v1` (`:2`) | `nabaperks.production-slos.v2`                                                                                          |
| `probeSchedule`                                                                                               | `"7/15 * * * *"` (`:6`)               | **`"7 * * * *"`**                                                                                                       |
| `probeIntervalMinutes`                                                                                        | `15` (`:7`)                           | **`60`**                                                                                                                |
| `probeMinuteOffset`                                                                                           | `7` (`:8`)                            | unchanged — still `< 60`, satisfying `check-production-slo.mjs:22-26`                                                   |
| `evaluationLagMinutes`                                                                                        | `10` (`:9`)                           | unchanged — still `5 ≤ lag ≤ probeIntervalMinutes` (`:27-31`), and still greater than the probes job's 7-minute timeout |
| `windowDays`, `availabilityObjective`, `minimumCoverageRatio`, `minimumObservationDays`, all six `thresholds` | `30`, `0.999`, `0.95`, `7`, `:14-21`  | unchanged                                                                                                               |
| `publicLiveness`                                                                                              | absent                                | new (below)                                                                                                             |
| `agentLiveness`                                                                                               | absent                                | new (below)                                                                                                             |

`.github/workflows/production-smoke.yml:5` changes to `cron: "7 * * * *"` in the
**same commit**, and `:21` `cancel-in-progress: true` becomes `false` so a
deployment-triggered smoke cannot cancel a scheduled one and register a
`cancelled` conclusion — `check-production-slo.mjs:226-228` counts only
`success`, so a cancelled run is indistinguishable from an outage.

**This config/assert pair is the highest-risk edit in the whole plan.**
`scripts/check-production-slo.mjs:19` is
`assert.equal(config.probeSchedule, "7/15 * * * *")`, and `readSloConfig` is
imported by `scripts/check-production-probe-latency.mjs:4`, which runs **live**
inside `production-smoke.yml`. If the config and the assert do not land
atomically, every scheduled probe throws and fires a real P0 page. The
acceptance command for this step is therefore
`node -e "…readSloConfig()…"` plus a grep that the workflow cron equals the
config value **in the same tree**.

## 6.2 The arithmetic problem that moves the availability source

`check-production-slo.mjs:240-245`:

```js
const allowedUnavailableSamples = Math.floor(
  expectedSamples * (1 - config.availabilityObjective)
)
```

At today's 15-minute cadence over a 30-day window,
`expectedSamples = 30 × 24 × 4 = 2880`, so
`floor(2880 × 0.001) = 2` — the error budget is two failed probes.

At hourly cadence, `expectedSamples = 30 × 24 = 720`, and
**`floor(720 × 0.001) = 0`**. The error budget is zero slots. And
`meetsObjective` at `:247-249` requires
`availabilityRatio >= 0.999`, where `availabilityRatio = successfulSamples / observed.length`
(`:234-236`): a single failed probe gives `719/720 = 0.99861`, which is below
`0.999`. **One failed hourly probe breaches a 99.9% objective.** A GitHub-run-
derived availability ratio at hourly cadence is not a usable gating signal; it
would page on any transient runner failure, GitHub Actions incident, or
rate-limited API call.

Therefore, in v2:

- **UptimeRobot becomes the gating availability source.** Its 5-minute checks
  give `30 × 24 × 12 = 8640` observations in the window and
  `floor(8640 × 0.001) = 8` error-budget slots — a real budget. The
  error-budget trio at `:240-245` is re-based on the UptimeRobot check count.
- **The GitHub probe history supplies the coverage floor only.**
  `meetsObjective` becomes
  `publicAvailabilityRatio >= availabilityObjective && coverageRatio >= minimumCoverageRatio`,
  where `coverageRatio` is the GitHub-derived
  `observed.length / expectedSamples` and `minimumCoverageRatio` stays `0.95`.
  At 720 expected samples that tolerates 36 missing hourly runs per window.
- `availabilityRatio`, `errorRate` and `failedRunUrls` are **retained and
  reported as non-gating readiness health**, not deleted. They remain the best
  signal for authenticated readiness, which UptimeRobot cannot see.

New config blocks:

```json
"publicLiveness": {
  "provider": "uptimerobot", "apiVersion": "v2",
  "endpoint": "https://api.uptimerobot.com/v2/getMonitors",
  "apiKeyEnv": "UPTIMEROBOT_READ_API_KEY",
  "monitorFriendlyName": "nabaperks-production-health",
  "monitorUrl": "https://nabaperks.com/api/health",
  "checkIntervalMinutes": 5, "uptimeRatioWindowDays": 30,
  "minimumUptimeRatio": 0.999, "requestTimeoutMs": 15000,
  "activatedAt": "<ISO-8601 UTC, hand-entered at cutover step 5>",
  "warmUpDays": 7, "failClosed": true
},
"agentLiveness": {
  "provider": "uptimerobot", "kind": "heartbeat",
  "monitorFriendlyName": "nabaperks-local-ci-agent",
  "expectedIntervalMinutes": 5, "gracePeriodMinutes": 15,
  "gating": false
}
```

## 6.3 Script changes

**`scripts/production-slo/uptimerobot.mjs` (new).**
`fetchPublicUptimeRatio({ apiKey, config, fetcher = fetch })`. Form-encoded POST
with `api_key`, `format=json`, `custom_uptime_ratios=<windowDays>`,
`redirect: "error"` and `AbortSignal.timeout(requestTimeoutMs)`. Asserts the
endpoint origin is exactly `https://api.uptimerobot.com`. **Rejects — never
returns a default —** on non-2xx, `stat !== "ok"`, no matching monitor, a
monitor whose `url` differs from `monitorUrl`, or a non-finite
`custom_uptime_ratio`. Returns `{ ratio: Number(ratio) / 100, monitorId, friendlyName, readAt }`.
The key never enters a URL or the returned object. Fully offline-testable
through the injected `fetcher`.

**`scripts/check-production-slo.mjs`:** `:17` schema assert → v2; `:19`
`probeSchedule` assert → `"7 * * * *"`; validate `publicLiveness` and
`agentLiveness` in `readSloConfig`; extend `observationStartMs` (`:219-221`) to
also `Math.max(…, Date.parse(config.publicLiveness.activatedAt))`; replace
`meetsObjective` (`:247-249`) as above; add an `"evidence-unavailable"` state
branch **before** the warming/compliant/breached ternary at `:250-254`, with
`compliant: false` and the report JSON **still written to stdout** — today a
throw writes an empty file and loses the diagnostic; bump the report schema to
`nabaperks.production-slo-report.v2` with `publicAvailabilityRatio`,
`publicAvailabilitySource`, `publicMonitorId`, `publicMonitorFriendlyName`,
`publicUptimeWindowDays`, `publicCheckIntervalMinutes`, `publicEvidenceReadAt`,
`publicEvidenceState`, `publicEvidenceError`, `readinessCoverageRatio`,
`evidenceActivatedAt`, `warmUpEndsAt`. **Never log or serialise the API key.**

**`.github/workflows/slo-report.yml`:** add
`UPTIMEROBOT_READ_API_KEY: ${{ secrets.UPTIMEROBOT_READ_API_KEY }}` to the
`Calculate the rolling SLO` step env alongside `:32-33`; extend the summary
`jq` at `:61` with public availability, evidence state, readiness coverage and
warm-up end. **Do not add `evidence-unavailable` to the accept-list at `:43`.**
Leaving it out is precisely what routes a failed readback to `state=error`,
which pages (`:69`) and opens the P1 incident. Keep `cron: "13 7 * * *"`,
`retention-days: 365` (`:55`), `environment: Monitoring` (`:22`) and
`test "$SLO_OUTCOME" = "success"` (`:136-140`).

## 6.4 The recovery profile

`config/supabase-governance-contract.json` today asserts
`pitrRequired: true` (`:13`) and `maximumLatestAgeHours: 36` (`:15`), while
`docs/operations/devops-maturity.md:108` records that paid point-in-time
recovery is disabled and explicitly cost-deferred, with seven completed daily
physical backups, no gap above 30 hours, and a latest backup 8.3 hours old at
readback. The contract asserts a posture the organisation has decided not to
buy. Step 6 makes the accepted posture explicit instead of permanently failing.

**Contract edits:** `pitrRequired: true → false`; add `"pitrStatus": "not-enabled"`;
`maximumLatestAgeHours: 36 → 30`; add `"rpoHours": 30`; add top-level
`"recoveryProfile": "config/recovery-profile.json"`. **Unchanged:**
`minimumCompletedPhysicalBackups: 7` (`:14`), `maximumGapHours: 30` (`:16`),
`walgRequired: true` (`:12`), `region: "eu-west-2"` (`:11`) and the whole
`productionProject` block (`:2-9`).

**`config/recovery-profile.json` (new):** `schema: "nabaperks.recovery-profile.v1"`;
`productionProjectRef: "skonlhwstejberyzobep"`;
`objectives: { rpoHours: 30, rtoHours: 4, rtoMinutes: 240 }`;
`backups: { kind: "physical", region: "eu-west-2", walgRequired: true, minimumCompletedPhysicalBackups: 7, maximumLatestAgeHours: 30, maximumGapHours: 30 }`;
`pitr: { required: false, status: "not-enabled", reason: "Ongoing paid add-on cost is not accepted; seven daily physical backups with a 30-hour recovery point are the accepted posture.", decidedOn: "2026-09-04", reviewCadence: "quarterly" }`;
`drill: { workflow: "recovery-drill.yml", environment: "Recovery Drill", cadence: "quarterly", maximumAgeDays: 100, maximumBackupAgeDays: 8, evidenceRetentionDays: 90, projectNamePrefix: "nabaperks-restore-drill-", credentialsAreEphemeral: true, teardownGraceDays: 3 }`.

**RPO 30h / RTO 4h.** The recovery point is 30 hours because seven daily
physical backups with `maximumGapHours: 30` cannot guarantee anything tighter.
The recovery time is 4 hours (240 minutes). **The live `Recovery Drill`
environment currently carries `RECOVERY_RTO_MINUTES = 30`**
(`docs/operations/devops-maturity.md:103`), and
`scripts/check-restored-backup.mjs:70-74` accepts anything in `5..240`. Step 6
replaces that range check with `assert.equal(rtoMinutes, profile.objectives.rtoMinutes)`,
so **the operator must change the live variable from 30 to 240 before the PR
merges**, or every drill fails. `expectedVariableValues` in the governance
contract makes the mismatch a FAIL rather than a surprise.

**`scripts/supabase-governance/checks.mjs`** gains a `note(control, detail)`
helper returning `status: "NOTE"`. The `supabase:pitr` block at `:164-172` is
today

```js
;("supabase:pitr",
  target.pitrRequired !== true || backupEvidence.pitrEnabled === true,
  backupEvidence.pitrEnabled === true
    ? "point-in-time recovery is enabled"
    : "point-in-time recovery is disabled")
```

Merely flipping `pitrRequired` to `false` would therefore emit
`PASS supabase:pitr: point-in-time recovery is disabled` — a passing control
whose own detail says the control is off. **Never emit PASS for a disabled
optional control.** When `pitrRequired === true` keep today's PASS/FAIL
predicate; otherwise emit **NOTE** with "point-in-time recovery is not enabled
(optional; the 30-hour recovery point is met by seven daily physical backups)".
Reword the freshness details at `:182-190` to name the 30-hour RPO.

`scripts/check-supabase-governance.mjs:80` computes
`const passes = findings.length - failures.length`, which would silently count
every NOTE as a pass. Replace with an explicit
`findings.filter(({ status }) => status === "PASS").length` and a separate NOTE
count. Keep the `FAIL → process.exit(1)` gate at `:81-86`.

**`scripts/check-restored-backup.mjs`** reads `config/recovery-profile.json`
**module-relative** via `new URL("../config/recovery-profile.json", import.meta.url)`.
Never root-relative: `resolveRestoreDrillConfig` is exercised with
`root='/workspace'` in `tests/unit/restore-drill-config.test.mjs:28` and with a
`mkdtemp` root, and a cwd-relative read would let a decoy profile weaken the
RTO — the exact attack `tests/unit/production-poster-supabase-target.test.mjs:67-85`
already guards against. Then: replace the `5..240` range check (`:70-74`) with
the equality above; replace the literal `8 * 86_400_000` (`:157`) with
`profile.drill.maximumBackupAgeDays * 86_400_000`; replace the hardcoded
`/^nabaperks-restore-drill-/` (`:182`) with `profile.drill.projectNamePrefix`;
extend the evidence object (`:336-346`) with
`schema: "nabaperks.restore-drill-evidence.v2"`, `rpoHours`, `rtoMinutes` and
`backupAgeHours`.

## 6.5 Drill governance: a 100-day window proved by run and deployment records

`config/github-governance-contract.json` `environments["Recovery Drill"]`
(`:58-62`) becomes:

```json
"Recovery Drill": {
  "independentReview": true,
  "requiredSecrets": [],
  "requiredVariables": ["RECOVERY_RTO_MINUTES"],
  "expectedVariableValues": { "RECOVERY_RTO_MINUTES": "240" },
  "ephemeralSecrets": ["RESTORE_DRILL_DB_URL", "SUPABASE_BACKUP_READ_TOKEN"],
  "ephemeralVariables": ["RESTORE_DRILL_PROJECT_REF"],
  "drillProof": {
    "workflow": "recovery-drill.yml", "maximumAgeDays": 100,
    "requireSuccessfulDeployment": true,
    "artifactNamePattern": "^recovery-drill-\\d+$", "evidenceRetentionDays": 90,
    "requireCredentialTeardown": true, "teardownGraceDays": 3
  }
}
```

The important change is that `RESTORE_DRILL_DB_URL` and
`SUPABASE_BACKUP_READ_TOKEN` move out of `requiredSecrets` and into
`ephemeralSecrets`. Today the contract demands that live restore credentials for
a disposable project exist **permanently**, which is the opposite of the desired
posture. They stay in `forbiddenRepositorySecrets` (`:68`, `:78`).

`scripts/github-governance/checks.mjs` gains: `NOTE` support in the finding
helper at `:1-7`; `ephemeralSecrets`/`ephemeralVariables` handled in
`environmentFindings` (`:40-119`) as a NOTE listing which names are present,
**never a FAIL on absence**; an `expectedVariableValues` check so
`environment:Recovery Drill:variables` FAILs when `RECOVERY_RTO_MINUTES !== "240"`;
and four new controls in `evaluateGitHubGovernance` —

- `recovery:drill-recency` — newest successful `workflow_dispatch` run on `main`,
  aged against `evidence.observedAt`, PASS iff ≤ 100 days.
- `recovery:drill-approval` — a `Recovery Drill` deployment with a success
  status matching that run's sha.
- `recovery:drill-evidence` — **NOTE** only (artifact present / expired /
  beyond retention). Never a FAIL.
- `recovery:drill-teardown` — **FAIL** when a drill completed more than
  `teardownGraceDays` (3) ago **and** the environment still holds
  `RESTORE_DRILL_DB_URL` or `SUPABASE_BACKUP_READ_TOKEN` as secrets, or
  `RESTORE_DRILL_PROJECT_REF` as a variable. A drill that leaves live restore
  credentials in place now produces a failing control, not a note.

**The retention/window tension, and what the proof actually is.**
`.github/workflows/recovery-drill.yml:88` changes `retention-days: 365 → 90`
(365 days of retained restore evidence is a needless exposure surface), while
the governance window is **100** days. A drill performed on day 95 therefore has
an **expired artifact**, so artifact presence cannot be the proof — which is why
`recovery:drill-evidence` is a NOTE.

The proof is the pair of durable GitHub records that outlive artifact retention:

1. the **workflow-run record** for `recovery-drill.yml` (a successful
   `workflow_dispatch` on `main`), which carries its own timestamp and sha; and
2. the **deployment record** that `environment: Recovery Drill`
   (`recovery-drill.yml:48`) causes GitHub to create, with a success status on
   that same sha.

The deployment record is the credential-free proof that the **approved** path
ran, not merely that a workflow ran. Both are read through the GitHub API by
`scripts/check-recovery-drill-freshness.mjs`.

Drill **content** is kept auditable past 90 days by a different mechanism:
`recovery-drill.yml` gains `issues: write` and a final `actions/github-script`
step that creates or updates a durable
`[Recovery drill] <backup_id> <YYYY-MM-DD>` issue carrying the redacted evidence
JSON. **Do not touch** `environment: Recovery Drill` (`:48`), the production-ref
guard at `:40` (`test "$RESTORE_PROJECT_REF" != "skonlhwstejberyzobep"`) or
`VERIFY_NON_PRODUCTION_RESTORE` (`:38`) — all three are asserted verbatim by
`devops-release-architecture.test.mjs:197-209`.

## 6.6 The enforcement point that does not exist yet

`git grep` over `.github/` returns **zero** references to
`check-github-governance.mjs`, `check-supabase-governance.mjs` or
`check-vercel-governance.mjs`. The three entry points live only in
`package.json` as `ops:github:check`, `ops:supabase:check` and
`ops:vercel:check`. A 100-day drill requirement, a backup-continuity
requirement, an environment-secret-scope requirement or a Vercel-target
requirement living only inside those scripts would therefore **never block
anything, at any cutover step**.

`.github/workflows/governance.yml` (new) closes that: daily
`cron: "41 6 * * *"` plus `workflow_dispatch`;
`permissions: { actions: read, deployments: read, contents: read, issues: write }`;
`environment: Monitoring`; three `continue-on-error: true` steps invoking
`node scripts/check-github-governance.mjs`,
`node scripts/check-supabase-governance.mjs` and
`node scripts/check-vercel-governance.mjs` directly (never `pnpm ops:*` —
matching `slo-report.yml:34`); a fourth step running
`scripts/check-recovery-drill-freshness.mjs`; a classification step; a
create-or-comment `[Governance] Nabaperks control readback is failing` issue
mirroring `slo-report.yml:68-88`; and a final
`test "$GH_OUTCOME" = "success" && test "$SB_OUTCOME" = "success" && test "$VC_OUTCOME" = "success"`.

`tests/contracts/governance-enforcement.test.mjs` (new) asserts that every
`scripts/check-*governance*.mjs` file is referenced by at least one workflow, so
a future checker cannot be added without an enforcement point.

**`governance.yml` reports and pages; it does not become a required check.** See
step 7.

## 6.7 Step 6 summary

- **Files touched:** `config/production-slos.json`,
  `config/supabase-governance-contract.json`, `config/recovery-profile.json`
  (new), `config/github-governance-contract.json`,
  `scripts/check-production-slo.mjs`, `scripts/production-slo/uptimerobot.mjs`
  (new), `scripts/supabase-governance/checks.mjs`,
  `scripts/check-supabase-governance.mjs`, `scripts/github-governance/checks.mjs`,
  `scripts/check-github-governance.mjs`,
  `scripts/github-governance/metadata.mjs` (new),
  `scripts/check-recovery-drill-freshness.mjs` (new),
  `scripts/check-restored-backup.mjs`, `.github/workflows/production-smoke.yml`,
  `.github/workflows/slo-report.yml`, `.github/workflows/recovery-drill.yml`,
  `.github/workflows/governance.yml` (new), `package.json`, `AGENTS.md`.
- **Tests that break:**
  `tests/contracts/devops-release-architecture.test.mjs:229`
  (`assert.match(config, /"probeSchedule": "7\/15 \* \* \* \*"/)`) and `:256`
  (`assert.match(script, /availabilityRatio >= config\.availabilityObjective/)`)
  both invert; `:207` (`assert.match(workflow, /retention-days: 365/)` on
  `recovery-drill.yml`) becomes `90`; `:208-209`
  (`secrets.SUPABASE_BACKUP_READ_TOKEN`, `secrets.RESTORE_DRILL_DB_URL`) stay,
  because the workflow still consumes them at run time even though the contract
  no longer requires them to exist permanently. `tests/unit/production-slo.test.mjs:36-37`
  becomes `"7 * * * *"` / `60` and every derived assertion in `:47-106` is
  recomputed — `expectedSamples` per observation day goes from 96 to **24**.
  `tests/unit/restore-drill-config.test.mjs` gains profile-driven cases and a
  decoy-profile case. New unit files: `production-uptime`, `recovery-drill-freshness`.
  New contract files: `production-slo-v2`, `recovery-profile`,
  `governance-enforcement`.
- **Manual prerequisites:** both UptimeRobot monitors live and warm (the
  `warmUpDays: 7` window starts at `publicLiveness.activatedAt`, which is
  hand-entered);
  `UPTIMEROBOT_READ_API_KEY` installed in `Monitoring`; the live
  `RECOVERY_RTO_MINUTES` changed from `30` to `240`; one complete restore drill
  performed (create a same-region `nabaperks-restore-drill-*` project, install
  short-lived credentials, run the workflow, then **revoke and delete within 3
  days** or `recovery:drill-teardown` FAILs).
- **Rollback:** the SLO half and the recovery half are independently
  revertable, but **the SLO config and the smoke cron must revert together** for
  the same atomicity reason they must land together. Reverting the recovery half
  restores `pitrRequired: true`, which returns `supabase:pitr` to a permanent
  FAIL — an honest state, not a broken one.

---

# Step 7 — make every lane and control blocking

Step 7 is a configuration flip. It touches no workflow and no provider.

## 7.1 What it changes

`config/release-gate-contract.json`:

- `stage: "bridge-enforcing" → "local-primary"`.
- `advisoryLanes: ["zap-baseline"] → []`.
- Every entry in `lanes[]` carries `enforcement: "blocking"`; in practice this
  means flipping `zap-baseline`, the last lane still advisory after step 3.

`config/local-ci-contract.json`: `stage: "bridge-enforcing" → "local-primary"`
and `cutoverStep: 3 → 7`. Nothing else — in particular **`shadowMode.enabled`
is not touched here**. The contract shipped in step 1 records
`shadowMode.flipsAtCutoverStep: 3`, so that field is already `false` from step 3
and the agent has been enforcing since then. The two `stage` fields must move
together, and a contract test asserts they are equal.

`gh variable set LOCAL_CI_MODE --body enforcing` is optional, because of the
direction of the combination in `scripts/check-release-gate.mjs`:

```
mode = stricter(vars.LOCAL_CI_MODE ?? "shadow", shadowMode.enabled ? "shadow" : "enforcing")
```

A repository variable can only **tighten** the mode, never loosen it. Since
`shadowMode.enabled` became `false` at step 3, the committed contract has
already yielded `enforcing` since then and the variable has been a no-op. It is
worth setting anyway as defence in depth, and during steps 2-3 it is the only
way to tighten without a merge.

`tests/contracts/release-gate-graph.test.mjs` Test 3 already binds the two
halves together:

```js
assert.equal(
  contract.stage === "local-primary",
  contract.lanes.every((l) => l.enforcement === "blocking")
)
```

so declaring `local-primary` while leaving a lane advisory fails, and flipping
every lane without declaring `local-primary` fails too. There is no half-applied
state.

## 7.2 What it deliberately does not change

**`config/github-governance-contract.json:13-17` `ruleset.requiredChecks` stays
at exactly three names** — `Release gate`,
`Analyze (javascript-typescript)`, `Review dependency changes` — through every
step of this plan. A contract test deep-equals that list, so no future PR can
add the bridge, the reusable workflow, or a governance workflow to branch
protection without failing.

"Require all governance checks" therefore means _every lane and control becomes
merge-blocking through `Release gate`_, not _add more names to branch
protection_. Two things follow:

- `.github/workflows/governance.yml` is **never** a required check. It reads
  live provider state — GitHub environments, Supabase backups, Vercel
  configuration — over three network APIs. A provider outage or an expired
  read-only token must page a human, not deadlock every merge in the
  repository. It publishes daily and opens an issue on FAIL; that is the whole
  enforcement mechanism, by design.
- The reusable workflow contributes check runs named
  `Hosted CI proof / <job>`, whose set changes with the routing decision. A
  required check whose name is absent on some routes deadlocks those routes
  permanently, which is why the release-gate contract records
  `"checkName": null` for that entry and a contract test asserts no
  called-workflow name appears in `requiredChecks`.

## 7.3 Why it must be last

Each of steps 3-6 deliberately leaves something advisory, and step 7 is the
single commit that removes all of it. Landing it earlier makes a merge depend on
a control whose provider side does not yet exist:

| Removed escape hatch      | Would break before step | Because                                                                                                                                                                                          |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `zap-baseline` → blocking | 3                       | It is the one lane with no local fallback at all — ZAP images are `linux/amd64` — so it must be observed stable on the hosted plane across the whole step-3 window                               |
| `advisoryLanes: []`       | 4                       | The staging path would be blocking while the `Staging` environment has no Supabase project (`devops-maturity.md:100`)                                                                            |
| `advisoryLanes: []`       | 5                       | The alert receiver would be blocking mid-rotation, when phases 1-3 have two live secrets                                                                                                         |
| `stage: "local-primary"`  | 6                       | `local-primary` asserts every lane blocking, including the availability lane, whose GitHub-derived ratio breaches on a single failed hourly probe until UptimeRobot becomes the source (see 6.2) |

There is also a hard, non-negotiable precondition inherited from step 3 and
re-checked here: `pnpm ops:github:check` must report
`github:ruleset-status-checks-exact` as **PASS** on the day. Flipping
enforcement does not change any check name, so step 7 adds no new deadlock risk
of its own — but it is the last opportunity to catch a rollup name that was
live-required and stopped reporting at step 3, and a required check that never
reports blocks every PR until a repository admin edits branch protection by
hand.

## 7.4 Step 7 summary

- **Files touched:** `config/release-gate-contract.json`, plus the `stage` and
  `cutoverStep` fields of `config/local-ci-contract.json`. Optionally one
  `gh variable set`.
- **Tests that break:** none, if steps 3-6 landed correctly.
  `tests/contracts/release-gate-graph.test.mjs` Test 3 changes behaviour rather
  than breaking: its `stage`/`enforcement` equality now holds on the other
  branch. A contract assertion that `advisoryLanes` is empty at
  `stage: "local-primary"` is added in the same commit.
- **Manual prerequisite:** `pnpm ops:github:check` reporting
  `github:ruleset-status-checks-exact` PASS, read by a human on the day.
- **Rollback:** revert the one-field change. This is the cheapest rollback in
  the plan and the reason step 7 is a standalone commit rather than a rider on
  step 6.

---

# Consolidated matrix

| Step | Files touched                                                                                                                                                                | Tests that break                                                                                                                                                                                                                                        | Manual / provider prerequisite                                                                                                                        | Rollback                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 3a   | 2 new configs, 11 new scripts, 1 new composite action, `hosted-proof.yml`, `ci.yml` (+3 jobs), CODEOWNERS, `package.json`, `AGENTS.md`                                       | none — additive                                                                                                                                                                                                                                         | GitHub App installed; `appId`/`repositoryId` pinned; VM and launchd agent live                                                                        | revert the PR                                                                         |
| 3b   | `ci.yml` (−10 jobs, gate rewritten), 6 contract tests, 1 e2e spec, `release-gate-contract.json`                                                                              | `devops-release-architecture` ×5, `agent-readiness-level5` ×11 (+4 unsafe slices), `architecture-audit-hardening` ×3, `auth-recovery-ux` ×1, `nfc-card-print-wire` ×1, `production-release-controls` ×2, `production-review-closure.desktop.spec.ts` ×1 | shadow qualification `satisfied: true`; fork-PR route observed; fallback rehearsal via **Re-run all jobs**; `github:ruleset-status-checks-exact` PASS | revert one commit; all 168 jobs and `[fast, build]` return                            |
| 4    | `production-database.yml`, `check-staging-release.mjs`, 2 new scripts, `github-governance-contract.json`, 2 test files, `devops-maturity.md`                                 | `devops-release-architecture` staging test: 2 inverted, 2 replaced, 5 deleted, 8 added; 9 new unit cases                                                                                                                                                | staging Supabase project; 8 secrets + 3 variables; 21 Vercel staging keys; `Staging` reviewer rule removed; hosted deploy-shape qualification         | revert; re-run with `staging_mode: ephemeral`                                         |
| 5    | 2 Supabase function files, `check-alert-delivery.mjs`, `production-deploy.yml`, `github-governance-contract.json`, 3 test files                                              | `production-alert` unit cases extended; receiver contract secret list extended                                                                                                                                                                          | 5-phase HMAC rotation across 3 install points; 2 UptimeRobot monitors; read-only key in `Monitoring`                                                  | reversible at any phase before 4; receiver is backward-compatible                     |
| 6    | `production-slos.json`, `supabase-governance-contract.json`, `recovery-profile.json`, `github-governance-contract.json`, 8 scripts, 4 workflows, `package.json`, `AGENTS.md` | `devops-release-architecture` ×4 (`:207`, `:229`, `:256`, plus recovery rows), `production-slo` unit ×all derived, `restore-drill-config` unit                                                                                                          | monitors warm past `warmUpDays: 7`; `RECOVERY_RTO_MINUTES` changed **30 → 240**; one complete restore drill with teardown inside 3 days               | SLO half and recovery half revert independently; config and cron must revert together |
| 7    | `release-gate-contract.json`, `local-ci-contract.json` (`stage`, `cutoverStep`)                                                                                              | none                                                                                                                                                                                                                                                    | `github:ruleset-status-checks-exact` PASS, read on the day                                                                                            | revert one field                                                                      |

# Verification commands

Run before opening each PR, and again before merging it.

```sh
pnpm quality:check
pnpm test:contracts
pnpm test:unit
```

Step-specific gates:

- **3** — `node scripts/lane-routing.mjs --print` prints all nine
  `(profile, route)` selections; `NEEDS_JSON='{}' node scripts/check-release-gate.mjs`
  exits **non-zero** (the fail-closed proof); `pnpm ops:github:check` reports
  `github:ruleset-status-checks-exact` PASS.
- **4** — the `staging` job slice contains none of `--prod`, `vercel promote`,
  `secrets.VERCEL_TOKEN`, `nabaperks.com`, and **does** contain
  `STAGING_APP_URL=`; `pnpm ops:github:check` and `pnpm ops:vercel:check` report
  the staging controls PASS.
- **5** — `pnpm ops:alert:verify` from inside a GitHub Actions run (it cannot
  pass anywhere else).
- **6** — `readSloConfig()` does not throw **and** `production-smoke.yml`'s cron
  equals `config.probeSchedule` in the same tree; `pnpm ops:supabase:check`
  reports `supabase:pitr` as **NOTE**, not PASS and not FAIL;
  `pnpm ops:github:check` reports `environment:Recovery Drill:variables` PASS.
- **7** — `pnpm test:contracts` alone; there is nothing else to prove.

# Known divergences from the reference design

Recorded so a reviewer comparing this document against the design notes does not
treat these as transcription errors. In each case the repository was treated as
the source of truth.

1. **Step 3 is split into 3a and 3b.** The reference design landed the routing
   plane in cutover step 1. Step 1's binding scope excluded it, so it moves to
   step 3 and is split so that the deletion still lands as a single revertable
   commit.
2. **`production-security-closure.test.mjs:108`'s loop is extended, not
   repointed.** The design replaces `nightly.yml` with `hosted-proof.yml` in
   `["ci.yml", "nightly.yml"]`. No step touches `nightly.yml`, and it still
   carries a `CUSTOMER_SESSION_SECRET` fixture, so the correct edit is
   `["ci.yml", "nightly.yml", "hosted-proof.yml"]`. The same applies to the
   `whsec_` source list at `:96-102`, which gains `hosted-proof.yml` and keeps
   `ci.yml`.
3. **Steady-state PR row count is 30 by the derivation in 3.4, not ≈37.** The
   larger figure counts each sub-lane as a callee check row; the callee has one
   `e2e` job covering four lanes and one `a11y` job covering two, and the
   sentinel matrix collapses each unselected sharded lane to one row. Recompute
   from the routing table regardless — the number is a function of the table.
4. **`visual` gets `needs: route`, not an empty `needs:`.** With `fast` deleted
   it would otherwise start unconditionally, and a `route` failure would leave
   `visual-gate` green under `if: always()`. `needs: route` makes it fail closed.
5. **`shadowMode` is owned by `config/local-ci-contract.json` alone, and flips
   at step 3, not step 7.** The design describes a `shadowMode.enabled` on the
   release-gate contract that flips at step 7. Duplicating the field name across
   two files with different flip points is a confusion hazard, and the contract
   actually shipped in step 1 records `shadowMode.flipsAtCutoverStep: 3`.
   `config/release-gate-contract.json` therefore carries `stage`,
   `advisoryLanes` and per-lane `enforcement` only.
6. **`RECOVERY_RTO_MINUTES` is live at `30`, not `240`.** `devops-maturity.md:103`
   records the configured value; `check-restored-backup.mjs:70-74` accepts
   `5..240` so nothing fails today. Step 6 turns the range into an equality, so
   the operator variable change is a hard prerequisite the design does not name.
