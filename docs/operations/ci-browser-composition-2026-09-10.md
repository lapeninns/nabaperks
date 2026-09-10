# Browser tier composition proposal, 10 September 2026

This is a separate review from the browser memory and evidence repair in PR #300.
It moves accessibility checks out of the CI E2E selection and into the dedicated
accessibility tier for all four projects. Both halves must land together.

## Exact selection comparison

The before inventory is from `7b369521e786d541119d8ff1aa8be0acf6b695e4`, whose
browser selection matches original PR #300. The after inventory was generated
from this change using Playwright's JSON `--list` reporter. Identities include
project, file and full test title; this is selection evidence, not executed tests.

| Project          | Before E2E | Before a11y | After E2E | After a11y |
| ---------------- | ---------: | ----------: | --------: | ---------: |
| Chromium         |        246 |          72 |       174 |         72 |
| Mobile Safari    |        292 |          75 |       217 |         75 |
| Desktop Firefox  |        243 |           0 |       171 |         72 |
| Desktop Safari   |        243 |           0 |       171 |         72 |
| Total executions |       1024 |         147 |       733 |        291 |

The distinct union remains **1024** with **zero missing and zero added identities**.
Executions fall from **1171 to 1024**, removing all **147 duplicates** (12.6%).
The accessibility union remains 291. The comparison tool rejects either half on
its own: exclusion alone loses Firefox/Safari accessibility; expansion alone
leaves duplicated execution. It also rejects a missing tier, rather than accepting
an empty inventory as successful removal.

Reproduce after recording the four JSON inventories:

```sh
node scripts/ci/check-browser-composition.mjs \
  before-e2e.json before-a11y.json after-e2e.json after-a11y.json
```

Before E2E selects all four projects with `--grep-invert @visual`; before a11y
selects Chromium and Mobile Safari with `--grep @a11y`. After E2E selects all
four with `--grep-invert '@visual|@a11y'`; after a11y selects all four with
`--grep @a11y`. All other fixtures, project matching and test files are identical.
The four inventories and comparison are retained under
`~/.codex/tmp/nabaperks-ci-remediation-20260910/`.

## Runtime and policy boundaries

The manifest drives CI selection. The generic `pnpm test:e2e` convenience command
retains its original behaviour: the release workflow explicitly selects the
merchant ID-verification specs, including their accessibility assertions, against
a production build. Changing that generic command's default would silently remove
those release tests. It is deliberately unchanged.

Hosted E2E keeps four packs of eight /32 shards per project. Hosted a11y keeps
/4 sharding and now covers four projects, so it has 16 jobs instead of eight.
Local E2E retains /32; local a11y retains /8 and adds two independent lanes.
All local lanes retain the proposed 4096 MiB heap and 8 GiB cgroup cap. The
scheduler still admits against the same combined lane/daemon/VM limits.
Visual snapshots, server mode, retries, workers, flaky-test policy, test files,
required checks and protected provider settings are unchanged. The visual
exclusion guard accepts the quoted combined expression and rejects repeated
`--grep-invert` overrides that could otherwise discard the visual exclusion.

This removes test executions, but does not by itself prove lower wall time or
machine time: widening hosted a11y adds eight job setups. Those outcomes require
measurement on the same full candidate and architecture. `--list` cannot prove
runtime outcomes, skip reasons, teardown, resource peaks or release readiness.

The existing local qualification floors and skip ceilings are **unchanged**.
Moving 291 tests between lane families makes the old per-lane qualification
baseline inapplicable, and the two new a11y lanes have no qualified baseline.
The local plane must remain paused and unqualified. A reviewer must approve a
new complete per-identity composition ledger and its per-lane baseline from
real hosted and isolated local executions before any future local qualification.
A shorter E2E count must not be accepted by lowering old floors to get green.

## Executed accessibility comparison and validation

Predeclared attempt D executed only the four a11y lanes from
`c47bccf77ae97af9cd1d566f20b96fa38d5810d5`, from 16:37:10 to 16:42:52 UTC on
10 September (341 seconds). It used isolated canary state and the pinned original
PR #300 dispatcher at `61c7b690c481c5c70c06efb46e00bc9b778fb5ec`; no installed
controller, publication client or signing credential was used. This was a bounded
a11y run, not the entire revised main profile.

| Project         | Passed | Skipped | JSON shards | Duration, seconds | Sampled cgroup peak, GiB |
| --------------- | -----: | ------: | ----------: | ----------------: | -----------------------: |
| Chromium        |     71 |       1 |           8 |               292 |                    4.839 |
| Mobile Safari   |     73 |       2 |           8 |               341 |                    6.434 |
| Desktop Firefox |     71 |       1 |           8 |               321 |                    5.352 |
| Desktop Safari  |     71 |       1 |           8 |               333 |                    6.269 |

All four lanes succeeded with zero missing parts, failed tests, retries or flaky
outcomes. Comparing their 32 executed JSON reports with the `@a11y` subset of
the earlier full-main B run's 128 E2E reports established the same **291 distinct
identities**, **286 passes**, **five skips**, and **identical per-identity outcomes
and skip reasons**. No identity was missing or added, and every skip had a reason.
`a11y-runtime-comparison.json` and `canary-d-summary.json` retain the reconciliation
in the external evidence directory.

The kernel capture had no new OOM scopes; it retained the same ten historical
scopes as after C, with the last OOM long before these experiments. Sampled
cgroup OOM counters stayed zero. The image was pinned by observed immutable
Docker ID, not attested contents; its declared source was older, and frozen
candidate dependencies were installed in each lane. Ten-second `memory.peak`
samples can miss a container's final interval and measure all cgroup charges,
not process RSS. B and D have different heap policy and scheduling. This outcome
comparison is not a full resource-parity or qualification report, nor proof of
lower end-to-end main-profile or hosted duration.

`pnpm quality:check` passed for this implementation: 717 contracts and 1787 unit
tests, plus lint/typecheck, hygiene and documentation gates. A fixture-only
production build passed. The composition comparator also passed against four
real Playwright list reports and has regressions rejecting exclusion alone,
expansion alone and a missing tier.

Intermediate validation failures were retained and corrected: the first CI unit
run had one old fixed lane-count expectation; the first quality run had two
source contracts tied to the old selector/two-project matrix; the second had
19 unit failures from old selectors and hosted-evidence fixtures with no new
lane policy. The final run above passed after those assumptions were updated.
Production qualification policy was not relaxed. Provider/collector unit tests
use an explicitly synthetic offline policy with the two extra a11y entries, while
a new regression asserts that the **actual unchanged qualification contract
refuses the expanded matrix** until a real reviewed baseline exists. Synthetic
test records were never installed or published as qualification evidence.

Status: **IMPLEMENTED, PENDING REVIEW OR INSTALLATION**. Draft PR #301 is stacked
on PR #300, and the CI pull-request trigger targets `main`; this draft therefore
does not have the complete hosted candidate run. Next: independently review and
merge #300, retarget #301 to main, run its full hosted checks, and review a new
per-identity composition ledger and per-lane baseline before local qualification.

## Nightly investigation

`nightly.yml` currently declares four projects times 32 unpacked shards, or
128 browser jobs. Its selection matches the original CI E2E union of 1024
identities; its other jobs are mutation, k6, DB stress and a full ZAP scan.
The nightly browser command still uses the generic E2E selector, so it retains
the same complete union after this proposal. However, its browser installation,
Chromium channel and fixture environment differ from the prepared CI containers.
Selection overlap alone does not prove identical runtime evidence. This change
retains nightly and does not retire local nightly proof or observers.

Next action: review whether the nightly browser runtime adds a deliberate
variant; then separately compare a packed or removed nightly browser tier against
an all-hosted execution of the same full SHA. Keep mutation, load, DB stress,
full ZAP and the paused-plane audit trail in that decision.

## Rollback

Revert this composition change as one unit, returning both E2E selection and
the a11y project set together. Keep the resource, signal and evidence fixes from
PR #300. No service installation or provider configuration is part of this PR.
