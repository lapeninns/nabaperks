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
All local lanes retain the reviewed 4096 MiB heap and 8 GiB cgroup cap. The
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
