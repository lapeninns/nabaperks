---
spec_id: MS-governance-sync-guard
status: active
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/governance/**
  - micro-specs/evidence/**
  - scripts/sync-skill-bundles.mjs
  - tests/micro-specs/**
implementation_surfaces:
  - micro-specs/governance/sync-guard.md
  - scripts/sync-skill-bundles.mjs
  - tests/micro-specs/sync-guard.test.mjs
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

# MS-governance-sync-guard — Sync guard: refuse to clobber uncommitted lockstep edits

## 1. Exact Goal and User-Visible Outcomes

`sync-skill-bundles` copies the kit templates over the repo's lockstep files
(`scripts/`, `tests/micro-specs/`) unconditionally. Someone who edits a repo
engine file directly and runs the sync loses their uncommitted work with no
warning — the kit is canonical, but a silent clobber is not the way to say
so. When this ships, the sync refuses (exit 1, naming each file and the
port-to-kit remedy) whenever a lockstep target has uncommitted git changes
AND differs from its kit template; `--force` overrides deliberately.
Committed differences keep propagating exactly as before — overwriting them
is the sync's job.

## 2. Blast Radius

In scope: `scripts/sync-skill-bundles.mjs` (repo-only, not lockstep-owned)
and a new `tests/micro-specs/sync-guard.test.mjs` exercising the real script
against disposable fixture repos.

Out of scope: engine/kit files, bundle and mirror copies (derived artifacts
already protected by the managed-by marker), `--check` mode semantics, and
documentation surfaces owned by other in-flight specs.

## 3. Strict Constraints and Assumptions

- The guard protects lockstep files only; refusal must not stop the rest of
  the sync run — it finishes, reports every refused file, and exits 1.
- Fail-open when git cannot answer (no repo, no git): propagation is the
  script's primary job.
- Testability: the script accepts a `GOVERNANCE_SYNC_ROOT` environment
  override for its repo root so tests can point the real CLI at a fixture
  tree (the lockstep file lists still come from the real manifests).
- An absent target is bootstrap, not a conflict: the guard only fires when
  the target exists, differs from the kit source, and is git-dirty
  (untracked-with-content counts as dirty — it is still unrecoverable).

## 4. Decisions Already Made

- The kit template is canonical; the remedy in the refusal message is "port
  your edits into the kit template first" (or `--force` to discard).
- Dirty detection is `git status --porcelain -- <file>` scoped to the target
  path, run in the sync root.
- No new documentation surfaces: the guard documents itself in the script
  header and the refusal message.

## 5. Behavioral Requirements (EARS)

- IF a lockstep target file exists, differs from its kit template, and has
  uncommitted git changes, THEN THE sync SHALL refuse that file, name it and
  the remedy, continue the remaining work, and exit non-zero.
- WHERE `--force` is passed, THE sync SHALL overwrite refused files and exit
  zero.
- WHEN a lockstep target differs from the kit template but is committed
  clean, THE sync SHALL overwrite it (normal kit propagation).
- IF the target does not exist or git cannot report its state, THEN THE sync
  SHALL copy without refusing.
- WHILE running in `--check` mode, THE sync SHALL behave exactly as before
  (report drift, write nothing).

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify with the real CLI against fixture repos:

- kit-side edit with a clean repo copy propagates (exit 0, target updated);
- a dirty, differing repo copy is refused (exit 1, message names the file,
  target preserved) and `--force` overrides it (exit 0, target replaced);
- a missing target bootstraps without refusal.

Tasks: red tests via the `GOVERNANCE_SYNC_ROOT` fixture harness; guard
implementation; prove with `governance:run-gates --spec
MS-governance-sync-guard --record` and advance with `governance:advance`.
