---
spec_id: MS-governance-evidence-staleness
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
implementation_surfaces:
  - micro-specs/governance/evidence-staleness.md
  - micro-specs/README.md
  - scripts/governance-rules.mjs
  - scripts/governance-commands.mjs
  - scripts/governance-constants.mjs
  - scripts/run-governance-gates.mjs
  - scripts/advance-spec.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - ai-governance-starter-kit/templates/scripts/governance-rules.mjs
  - ai-governance-starter-kit/templates/scripts/governance-commands.mjs
  - ai-governance-starter-kit/templates/scripts/governance-constants.mjs
  - ai-governance-starter-kit/templates/scripts/run-governance-gates.mjs
  - ai-governance-starter-kit/templates/scripts/advance-spec.mjs
  - ai-governance-starter-kit/templates/tests/micro-specs/governance-enforcement.test.mjs
  - ai-governance-starter-kit/templates/micro-specs/README.md
related_tests:
  - tests/micro-specs/governance-enforcement.test.mjs
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

# MS-governance-evidence-staleness — Evidence staleness: surfaces changed since the proving run

## 1. Exact Goal and User-Visible Outcomes

An implemented or verified spec's evidence ledger records the commit its
gates passed on, but nothing notices when the spec's implementation surfaces
change afterwards — the green evidence silently stands for code it never
proved. When this ships, `pnpm governance:check` fails an implemented or
verified spec whose declared implementation surfaces changed in commits made
after its latest recorded run, with a message naming the changed files and
the cure (`governance:run-gates --spec <id> --record`). Re-recording (or
advancing) on the new commit clears the failure.

## 2. Blast Radius

In scope: the shared governance engine (`governance-rules.mjs`,
`governance-commands.mjs`, `run-governance-gates.mjs`, `advance-spec.mjs` and
their kit template twins), the repo and kit `governance-constants.mjs`
(new status-list constant, matching export names), the dual-flavor
enforcement test suites, `micro-specs/README.md` and the kit README, and the
`.factory` bundle mirrors produced by `sync-skill-bundles`.

Out of scope: working-tree (uncommitted) drift — the existing dirty-tree and
blast-radius rules own that; closed specs (code legitimately evolves forever
after closure); any change to how runs are recorded or to ledger file shape.

## 3. Strict Constraints and Assumptions

- Fail-open on unknowable history: no ledger runs, no recorded sha, a sha
  that does not resolve in this clone, a sha that is not an ancestor of HEAD
  (squash-merged branches), or git being unavailable all skip the check —
  it must never invent staleness it cannot prove.
- The check must not deadlock the factory: `governance:check` runs as a gate
  inside the very re-recording run that cures staleness, so the runner and
  the lifecycle CLI must exempt the spec(s) being re-proven in that
  invocation (in-process for pre-validation, via environment for the child
  `governance:check` gate).
- Engine lockstep: all engine files stay byte-identical with kit templates;
  constants files share export names only. Constants-driven off switch
  (empty status list).
- The current repo must validate clean at HEAD: pre-existing implemented
  specs carry grandfather stubs (no runs) or squash-merged shas (not
  ancestors), so neither may be flagged.

## 4. Decisions Already Made

- Staleness compares committed history only: `git diff --name-only
  <run-sha>..HEAD`, intersected with `implementation_surfaces` patterns.
- The spec's own document and its evidence ledger are excluded from the
  intersection — status flips and run records are governance bookkeeping,
  not implementation drift.
- Statuses checked: `implemented` and `verified` (constant
  `EVIDENCE_STALENESS_STATUSES`; `[]` disables).
- The exemption protocol is the environment variable
  `GOVERNANCE_STALENESS_EXEMPT` (comma-separated spec ids), set by
  `run-governance-gates` and `advance-spec` for exactly the specs whose
  gates they are running fresh.
- The git reader is injectable for tests (`options.changedFilesSince`), with
  the real implementation in `governance-commands.mjs`.

## 5. Behavioral Requirements (EARS)

- IF a spec is implemented or verified AND its latest recorded run's sha is
  an ancestor of HEAD AND commits after that sha changed files matching the
  spec's implementation_surfaces (excluding the spec document and its
  ledger), THEN THE checker SHALL fail naming the spec, the sha, the changed
  files, and the re-record cure.
- IF the latest run's sha is missing, unresolvable, or not an ancestor of
  HEAD, THEN THE checker SHALL not flag the spec.
- IF the changed files match none of the spec's implementation_surfaces,
  THEN THE checker SHALL not flag the spec.
- WHILE a spec's status is not in the configured status list, THE checker
  SHALL not apply this check.
- WHERE a spec id is listed in the staleness exemption (in-process option or
  GOVERNANCE_STALENESS_EXEMPT), THE checker SHALL skip that spec so a fresh
  recording run can cure the staleness it is measuring.
- WHEN run-governance-gates or advance-spec runs a spec's gates fresh, THE
  runner SHALL exempt exactly that invocation's target specs.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (fixture repos; injected git reader for rule
semantics, a real git fixture for the ancestor/diff reader):

- an implemented spec with a recorded sha and an injected surface-touching
  diff fails with the changed files and cure named; the same diff touching
  only non-surface files (or only the spec doc/ledger) does not fail;
- an injected "unknowable" reader result produces no failure; active and
  closed specs are never flagged; the exemption (option and environment
  forms) silences exactly the exempted spec id;
- the real reader returns the committed diff for an ancestor sha and null
  for an unresolvable or non-ancestor sha (real temporary git repo);
- the real repo at HEAD validates clean (stubs and squash-merged ledgers are
  skipped), and re-recording a deliberately staled spec clears the failure.

Tasks: red tests in the repo-flavor enforcement suite; reader + rule +
constants (both flavors) + runner/lifecycle exemption; kit-flavor tests;
docs; sync bundles; prove with
`governance:run-gates --spec MS-governance-evidence-staleness --record` and
advance with `governance:advance`.
