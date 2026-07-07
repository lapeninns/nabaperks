---
spec_id: MS-governance-kit-release-hygiene
status: active
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/governance/**
  - micro-specs/evidence/**
  - tests/micro-specs/**
  - ai-governance-starter-kit/**
  - .factory/skills/**
implementation_surfaces:
  - micro-specs/governance/kit-release-hygiene.md
  - tests/micro-specs/ai-governance-starter-kit.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
  - ai-governance-starter-kit/CHANGELOG.md
related_tests:
  - tests/micro-specs/ai-governance-starter-kit.test.mjs
  - tests/micro-specs/skill-bundle-sync.test.mjs
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

# MS-governance-kit-release-hygiene — Kit release hygiene: installed-suite CI proof, version parity, changelog

## 1. Exact Goal and User-Visible Outcomes

Two release-quality gaps shipped silently this week: the kit-flavor
enforcement tests only ever run when someone manually installs the kit into
a scratch repo (CI runs the repo flavor only), and the plugin manifest
version drifted from `KIT_VERSION` with nothing to catch it. When this
ships, `pnpm test` proves on every run that a fresh kit install passes its
own installed test suite, that `.claude-plugin/plugin.json` tracks
`KIT_VERSION`, and that `ai-governance-starter-kit/CHANGELOG.md` carries an
entry for the current version — and the changelog itself exists, telling
adopters what `--upgrade` brings.

## 2. Blast Radius

In scope: `tests/micro-specs/ai-governance-starter-kit.test.mjs` (installed
suite runs in situ), `tests/micro-specs/skill-bundle-sync.test.mjs` (version
parity + changelog pin), the new `ai-governance-starter-kit/CHANGELOG.md`,
and the `.factory` bundle mirrors refreshed by `sync-skill-bundles`.

Out of scope: engine files, constants, the installer itself (its stamping
bug is tracked separately), the shared lockstep test files, and any version
bump — 0.4.0 is already current.

## 3. Strict Constraints and Assumptions

- The installed-suite test must be hermetic: scrub
  `GOVERNANCE_CHANGED_FILES` and `GOVERNANCE_REPROVING_SPECS` from the child
  environment, and enumerate the installed test files explicitly (no shell
  globbing, no runner directory-discovery assumptions) inside the temp
  install.
- The parity test reads `KIT_VERSION` from the repo engine (lockstep with
  the kit template) and compares the kit source manifest and changelog; no
  hardcoded version strings in tests.
- CHANGELOG.md lives at the kit root so every distribution (bundle, mirrors,
  installs) ships it.

## 4. Decisions Already Made

- The changelog format is Keep-a-Changelog-lite: `## <version> — <date>`
  headings, newest first; the machine pin only requires a `## <KIT_VERSION>`
  heading to exist.
- The parity and changelog pins live in `skill-bundle-sync.test.mjs` (the
  kit-distribution contract suite); the installed-suite run lives in
  `ai-governance-starter-kit.test.mjs` (the installer contract suite).
- Repo-only test files: neither suite is lockstep-shared, so no kit template
  twins are edited.

## 5. Behavioral Requirements (EARS)

- THE plugin manifest version SHALL equal `KIT_VERSION`.
- THE changelog SHALL contain a heading for the current `KIT_VERSION`.
- WHEN the kit is installed into a fresh fixture repo, THE installed
  `tests/micro-specs` suite SHALL pass with zero failures.
- IF the installed suite fails or the versions drift, THEN THE repo test
  tier (`pnpm test`) SHALL fail.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- deleting the changelog entry (or bumping KIT_VERSION alone) fails the
  parity test; restoring it passes;
- the installed-suite test fails when a kit template test is broken and
  passes on the current kit;
- the full repo tier stays green.

Tasks: red parity test; author CHANGELOG.md (0.4.0 with this branch's
engine changes, 0.3.0 history); installed-suite test; sync bundles; prove
with `governance:run-gates --spec MS-governance-kit-release-hygiene
--record` and advance with `governance:advance`.
