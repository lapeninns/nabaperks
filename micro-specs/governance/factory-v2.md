---
spec_id: MS-governance-factory-v2
status: verified
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-05
allowed_blast_radius:
  - ai-governance-starter-kit/**
  - .factory/skills/**
  - scripts/check-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/governance-frontmatter.mjs
  - scripts/governance-glob.mjs
  - scripts/governance-commands.mjs
  - scripts/governance-evidence.mjs
  - scripts/governance-version.mjs
  - scripts/new-spec.mjs
  - scripts/advance-spec.mjs
  - scripts/run-governance-gates.mjs
  - scripts/sync-skill-bundles.mjs
  - tests/micro-specs/**
  - micro-specs/**
  - package.json
  - AGENTS.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - CLAUDE.md
implementation_surfaces:
  - ai-governance-starter-kit/templates/scripts/**
  - ai-governance-starter-kit/install-ai-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/sync-skill-bundles.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
  - micro-specs/README.md
related_docs:
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
related_tests:
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
  - tests/micro-specs/ai-governance-starter-kit.test.mjs
verification_gates:
  - pnpm governance:check
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Governance checker and micro-spec test output for the hardened engine.
  - Factory smoke evidence from a scratch repo (install, scaffold, activate, advance, tamper-detect).
approved_exceptions: []
---

## Why It Exists

An audit of the original starter kit rated it 8.5/10 and found enforcement
that trusted silently: the frontmatter parser dropped wrapped continuation
lines (eleven lines of real spec content were being lost in this repo alone),
the glob matcher was a bare prefix test (`scripts/**` wrongly matched
`scripts-other/x`), exceptions never expired, statuses were hand-edited
prose, and "evidence" was unverifiable claims. Factory-v2 rebuilt the kit
into a closed loop — scaffold, prove, transition — where anything the engine
cannot parse or verify is a named failure with file/line context, statuses
are machine-written against fresh gate runs, and evidence is a tracked JSON
ledger the checker audits. The repo's live engine is byte-identical to the
kit it ships (lockstep), so this repository always runs exactly what
consumers install.

## Invariants

- Engine files are byte-identical kit <-> repo <-> distributed bundles;
  `scripts/governance-constants.mjs` is the only divergent file, and even it
  keeps export-shape parity with the kit template. Sync direction is kit ->
  everywhere.
- `status:` lines and the ledgers under `micro-specs/evidence` are
  machine-written only: the lifecycle CLI runs the spec's declared gates
  fresh before rewriting a status, records the run and transition, and the
  checker fails any enforced status with no matching recorded transition.
- The frontmatter dialect is a strict subset — one line per entry, inline
  `[]`, no nested maps, block scalars, tabs, or continuations; parse failures
  carry file:line and suppress that spec's cascading metadata noise.
- The glob dialect is engine-fixed, never per-repo: `**` crosses segments,
  `*` stays within one, `?` is one character, and a bare path matches itself
  and its subtree.
- Exceptions are temporary by construction: every `approved_exceptions` entry
  carries `(expires: YYYY-MM-DD)` and fails past its date; active specs go
  stale without review inside the configured window.
- Evidence enforcement is adoption-gated (`EVIDENCE_ADOPTION_DATE`,
  2026-07-05 in this repo); pre-adoption implemented specs carry grandfather
  stubs that permanently expire on their spec's first machine transition.
- Gate execution stays `shell: false` and is restricted to package-script
  invocations plus recorded-but-never-executed `manual:*` tokens.
- Docs-drift is bidirectional: the README gate list and the CI workflow's
  gate commands must stay equal, both filtered through the same
  candidate test.

## Code Pointers

- Checker: `scripts/governance-rules.mjs` (metadata, risk floors, blast
  radius, docs drift, evidence, closed records), entry point
  `scripts/check-governance.mjs`.
- Strict parser and glob dialect: `scripts/governance-frontmatter.mjs` and
  `scripts/governance-glob.mjs`.
- Factory stations: `scripts/new-spec.mjs` (intake),
  `scripts/advance-spec.mjs` (lifecycle), `scripts/governance-evidence.mjs`
  (ledger read/write/evaluate), `scripts/run-governance-gates.mjs`
  (proof runs, `--record`).
- Canonical kit: `ai-governance-starter-kit/templates/scripts` (engine
  templates) with installer `ai-governance-starter-kit/install-ai-governance.mjs`;
  lockstep + bundle sync in `scripts/sync-skill-bundles.mjs`.
- Behavior pins: `tests/micro-specs/governance-enforcement.test.mjs`,
  `tests/micro-specs/advance-spec.test.mjs`,
  `tests/micro-specs/governance-evidence.test.mjs`,
  `tests/micro-specs/skill-bundle-sync.test.mjs`, and
  `tests/micro-specs/ai-governance-starter-kit.test.mjs` (installer,
  upgrade, scratch-repo loop).

## Dead Ends

- Per-repo configurable glob semantics: rejected — lockstep is meaningless if
  pattern matching differs between the kit and a consumer; the dialect is
  engine-fixed and documented as such.
- Auto-repairing malformed frontmatter: rejected — silent tolerance is
  exactly how the historical parser lost spec content; strictness-first means
  refusing with a clickable file:line.
- Binary evidence folders (screenshots, traces) in the repo: rejected —
  evidence stays tracked JSON so ledger diffs review like code.
- Passing the changed-file list into every gate's environment: rejected after
  it leaked into hermetic test sandboxes during this spec's own dogfood
  advance (the harness installs the kit into temp repos and runs the checker
  there); the lifecycle CLI scopes it to the governance-check gate only, and
  the red run it caused is preserved in this spec's ledger as honest history.
