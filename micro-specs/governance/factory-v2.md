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
  - not-yet-created
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
approved_exceptions:
  - evidence-waiver: dogfood advance recorded while the shared working tree carries unrelated marketing WIP from a concurrent session (expires: 2026-08-05)
---

# MS-governance-factory-v2 — Close the loop: hardened engine + machine-enforced lifecycle

## 1. Exact Goal and User-Visible Outcomes

The AI Governance Starter Kit becomes a closed factory loop. An operator can
scaffold a well-formed Micro-Spec with `governance:new-spec`, prove it with
recorded gate runs, and move it through its lifecycle with
`governance:advance` — which runs the declared gates fresh, records
machine-readable evidence under `micro-specs/evidence/`, and rewrites the
spec's `status:` line only when the transition rules hold. The enforcement
engine stops trusting silently: malformed frontmatter, out-of-contract globs,
expired exceptions, stale reviews, and hand-flipped statuses all become named
governance failures. The repo's live engine and the kit's templates are
byte-identical (lockstep), so this repository always runs exactly what the kit
ships.

## 2. Blast Radius

In scope: the canonical kit under `ai-governance-starter-kit/`, its synced
bundles under `.factory/skills/`, the repo's live governance scripts named in
the metadata, governance tests under `tests/micro-specs/`, the `micro-specs/`
tree (spec corpus fixes, this spec, evidence ledgers), `package.json` script
merges, and the agent-facing governance docs.

Out of scope: product feature code (`app/`, `components/`, `lib/` outside the
listed files), CI workflow files other than the kit's template, deployment
configuration, and any change to what existing product specs *require* — their
frontmatter may be repaired (joined lines, dead references) but their
obligations must not be weakened.

## 3. Strict Constraints and Assumptions

- Zero-dependency: engine and station scripts import only `node:*` modules.
- Strictness-first: anything the engine cannot parse or verify is a failure
  with file/line context, never a silent pass.
- Engine files are byte-identical between `ai-governance-starter-kit/templates/scripts/`
  and `scripts/`; all repo-specific tuning lives in
  `scripts/governance-constants.mjs` only.
- The gate runner keeps `shell: false`; gate commands remain restricted to
  package-manager script invocations or `manual:*` tokens.
- Evidence ledgers are tracked JSON only — no binary or screenshot evidence
  folders are added to the repository.
- Assumption: the repo's own CI (`.github/workflows/ci.yml`) already runs the
  governance check and gate runner; this program does not restructure CI jobs.

## 4. Decisions Already Made

- Lifecycle transitions are machine-operated: `status:` is rewritten only by
  `governance:advance`; hand edits to implemented/verified without a recorded
  transition become checker failures once evidence enforcement is switched on.
- Evidence enforcement is gated by `EVIDENCE_ADOPTION_DATE` in constants
  (`null` = off) and existing implemented specs are grandfathered via backfill
  stubs that expire on first machine transition.
- Exceptions carry an inline expiry: `- <reason> (expires: YYYY-MM-DD)`.
- The glob dialect is engine-fixed (`**` crosses segments, `*` within a
  segment, `?` one character) and is not configurable per repo.
- The kit remains the canonical source; sync direction is kit → repo → bundles.

## 5. Behavioral Requirements (EARS)

- THE governance checker SHALL reject any Micro-Spec whose frontmatter uses
  YAML constructs outside the supported subset, naming the file and line.
- THE governance checker SHALL fail when an implemented or verified spec lacks
  a ledger transition matching its status, once evidence enforcement is on.
- WHEN `governance:advance` is invoked for a valid transition, THE system
  SHALL run the spec's runnable gates fresh and record the run and transition
  in the spec's ledger before rewriting its status line.
- WHEN `governance:new-spec` is invoked with a valid id, risk class, and
  title, THE system SHALL scaffold a draft spec whose verification gates
  satisfy the risk-class floor resolved against the repository's real
  package scripts.
- WHILE a spec's latest recorded run does not cover its currently declared
  runnable gates with exit code 0, THE checker SHALL treat implemented and
  verified statuses as failures (adoption-gated).
- WHERE `$GITHUB_STEP_SUMMARY` is set, THE checker and gate runner SHALL
  append an escaped markdown summary of specs, attribution, and gate results.
- IF a tree is dirty, THEN `governance:advance` SHALL refuse the transition
  unless explicitly waived, and SHALL stamp any waived transition as dirty.
- IF an `approved_exceptions` entry is malformed or past its expiry date,
  THEN THE checker SHALL fail that spec.
- IF an engine file under `scripts/` differs from its kit template, THEN THE
  sync check SHALL fail.

## 6. Verification Criteria and Task Breakdown

Acceptance criteria — observable behaviors to verify:

- A spec file with an inline flow list parses to a real list; a nested map or
  continuation line is rejected with its line number.
- `src/**/*.ts` matches `src/a.ts`; `scripts/**` does not match
  `scripts-other/x`.
- An expired exception, a stale active review, and a missing related test each
  produce a named failure.
- A hand-flipped `implemented` status without a ledger transition fails the
  checker once the adoption date is set; a grandfathered stub passes until its
  spec first transitions by machine.
- `governance:advance` refuses a dirty tree, an unknown spec, a wrong
  from-status, and an uncovered gate set; on success the spec body is
  byte-identical apart from the rewritten metadata lines.
- The kit installs into a scratch repository and the full loop (scaffold →
  activate → implement → advance) runs there end to end.

Tasks (implement and verify one at a time): spec-corpus data repair (this
commit); kit-side engine hardening; repo engine cutover; lockstep sync
enforcement; evidence + intake stations; lifecycle CLI + adoption flip;
step summaries, installer upgrade path, and documentation.
