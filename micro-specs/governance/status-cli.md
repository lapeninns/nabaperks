---
spec_id: MS-governance-status-cli
status: active
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/governance/**
  - micro-specs/evidence/**
  - micro-specs/README.md
  - scripts/**
  - tests/micro-specs/**
  - ai-governance-starter-kit/**
  - .factory/skills/**
  - package.json
implementation_surfaces:
  - micro-specs/governance/status-cli.md
  - micro-specs/README.md
  - scripts/governance-status.mjs
  - scripts/governance-version.mjs
  - tests/micro-specs/governance-status.test.mjs
  - ai-governance-starter-kit/templates/scripts/governance-status.mjs
  - ai-governance-starter-kit/templates/scripts/governance-version.mjs
  - ai-governance-starter-kit/templates/micro-specs/README.md
  - package.json
related_tests:
  - not-yet-created
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-governance-status-cli — governance:status portfolio dashboard with aging report

## 1. Exact Goal and User-Visible Outcomes

There is no way to see the spec portfolio without opening files, and the
observed cost is real: specs sit at `implemented` indefinitely with the
"owner owes verification/closure" list living in nobody's head. When this
ships, `pnpm governance:status` prints a read-only dashboard — every
non-terminal spec with its status, risk class, review age, latest recorded
run (sha, age, green/red/stub), and waiver count — plus an attention section
listing implemented/verified specs by how long they have been awaiting the
next lifecycle step and every failure the full checker currently reports.
It never mutates anything and always exits 0: enforcement stays the
checker's job.

## 2. Blast Radius

In scope: the new `scripts/governance-status.mjs` engine file (added to
`ENGINE_FILES` in `governance-version.mjs`, kit template twin created), the
`governance:status` package script, a new repo test suite driving the CLI
against fixture repos and the real repo, and one-line documentation in the
repo and kit READMEs.

Out of scope: any new enforcement rule, constants, thresholds, colors/TTY
detection, and the installer's script wiring (targets can run
`node scripts/governance-status.mjs` directly).

## 3. Strict Constraints and Assumptions

- Read-only and report-only: exit 0 even when the checker reports failures
  (they are displayed, not enforced here); exit 2 only for unknown flags.
- Reuses `validateGovernance` and the ledger reader — no duplicated rule
  logic; blast-radius enforcement is skipped (`changedFiles: []`) because
  the dashboard is about specs, not the working tree.
- Terminal statuses (`closed`, `superseded`) collapse to a count line by
  default; `--all` lists them. `--json` emits the machine shape.
- Engine lockstep: the new file and the manifest stay byte-identical with
  the kit templates.

## 4. Decisions Already Made

- Aging is presented, not thresholded: the attention section sorts
  implemented/verified specs by days since their latest recorded transition
  and says what each awaits; no constant governs a cutoff.
- A ledger with attestations but no runs displays as `stub`
  (grandfathered); a missing ledger displays as `none`.
- Table sorting is lifecycle-first (active, implemented, verified, draft),
  then spec id.

## 5. Behavioral Requirements (EARS)

- WHEN governance:status runs, THE CLI SHALL print one row per non-terminal
  spec with status, risk class, review age, latest-run summary, and waiver
  count, plus a count line for terminal specs.
- WHERE --all is passed, THE CLI SHALL list terminal specs too.
- WHERE --json is passed, THE CLI SHALL emit rows, attention entries, and
  checker failures as JSON.
- THE attention section SHALL list implemented and verified specs ordered
  by days since their latest transition, naming the awaited next step.
- IF the full checker reports failures, THEN THE CLI SHALL print them and
  still exit 0.
- IF an unknown flag is passed, THEN THE CLI SHALL exit 2 with usage.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- a fixture with an active spec, an implemented spec (green run + recorded
  transition), and a planted checker failure renders the row, the awaiting
  nudge, and the failure while exiting 0; `--json` parses with the same
  content; an unknown flag exits 2;
- the real repo renders (smoke: exit 0, contains a known spec id).

Tasks: red CLI tests; engine file + manifest + package script + kit twins;
README lines; re-record any spec staled by the README edit; prove with
`governance:run-gates --spec MS-governance-status-cli --record` and advance
with `governance:advance`.
