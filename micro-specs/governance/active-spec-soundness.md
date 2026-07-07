---
spec_id: MS-governance-active-spec-soundness
status: implemented
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
  - Instructions_MircroSpecsCreation.md
implementation_surfaces:
  - micro-specs/governance/active-spec-soundness.md
  - micro-specs/governance/ai-delivery-framework.md
  - micro-specs/README.md
  - scripts/governance-rules.mjs
  - scripts/governance-constants.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - ai-governance-starter-kit/templates/scripts/governance-rules.mjs
  - ai-governance-starter-kit/templates/scripts/governance-constants.mjs
  - ai-governance-starter-kit/templates/tests/micro-specs/governance-enforcement.test.mjs
  - ai-governance-starter-kit/templates/micro-specs/README.md
  - Instructions_MircroSpecsCreation.md
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

# MS-governance-active-spec-soundness — Active-spec soundness cross-checks (risk hints, radius breadth, grep crosscheck)

## 1. Exact Goal and User-Visible Outcomes

Today the checker trusts three self-declarations on an active spec with no
cross-verification: the author-chosen `risk_class` (which selects the entire
gate floor), the breadth of `allowed_blast_radius` (one repo-wide spec makes
blast-radius enforcement vacuous for every file), and the `--grep` pattern on
a scoped browser gate (a tag that matches someone else's tests proves the
wrong thing and never fails).

When this ships, `pnpm governance:check` (and therefore activation via
`governance:advance --to active`) fails an active spec that (a) declares
implementation surfaces matching a configured high-risk path while declaring a
weaker risk class, (b) claims more broad top-level radius roots than the
configured limit without a dated exception, or (c) carries a scoped browser
gate whose grep pattern matches none of the spec's own declared browser
tests. Existing implemented/verified/closed specs are untouched.

## 2. Blast Radius

In scope: the shared governance engine (`scripts/governance-rules.mjs` and its
kit template twin), the repo and kit `governance-constants.mjs` tuning files
(new constants, matching export names), the dual-flavor
`governance-enforcement.test.mjs` suites, `micro-specs/README.md` and the kit
README template rule documentation, `Instructions_MircroSpecsCreation.md`, the
`.factory` bundle mirrors produced by `sync-skill-bundles`, and
`micro-specs/governance/ai-delivery-framework.md` (which must gain a dated
broad-radius exception under the new lint).

Out of scope: app runtime code, `advance-spec.mjs` diff-time enforcement
(v1 checks declared surfaces, not the branch diff), any change to gate
floors or the lifecycle, and any rewrite of non-active specs.

## 3. Strict Constraints and Assumptions

- Engine lockstep: `governance-rules.mjs` must stay byte-identical between
  `scripts/` and the kit template; constants files share export names only.
- All three checks are constants-driven and disable cleanly (empty hint list,
  empty roots list) so kit adopters can tune or opt out per repo.
- Checks apply to `status: active` specs only.
- No new dependencies; strict-frontmatter and glob dialects stay unchanged.
- The current active specs must pass without weakening: MS-pwa as-is, and the
  framework spec via a dated broad-radius exception (its repo-wide radius is
  deliberate).

## 4. Decisions Already Made

- Risk hints compare against `implementation_surfaces` (the spec's claimed
  edit set), not `allowed_blast_radius` (a permission list), and match in both
  glob directions so a broad surface cannot hide a hinted path.
- Repo hint values: `supabase/migrations/**` requires `migrations` or
  `rls-rpc-ledger`; `app/api/stripe/webhook/**` requires `webhooks` or
  `billing`. The kit ships an empty hint list (paths are repo-specific).
- A radius entry is "broad" only when it exactly equals a configured root
  (e.g. `app/**`); scoped subpaths like `components/pwa/**` never count.
  The limit is a count, not a ban; exceeding it requires a dated
  `broad-blast-radius:` approved exception.
- The grep crosscheck compiles the gate's `--grep` value as a JavaScript
  regular expression and requires it to match the raw content of at least one
  existing `related_tests` file under `tests/e2e|a11y|visual/`; an
  uncompilable pattern is its own failure. It runs only when the spec already
  passes the existing related-browser-test requirement (no double noise).

## 5. Behavioral Requirements (EARS)

- IF an active spec's implementation surface matches a configured risk-hint
  path AND its risk_class is not in that hint's accepted classes, THEN THE
  checker SHALL fail naming the surface, the pattern, and the accepted
  classes.
- IF an active spec's allowed_blast_radius contains more exact broad-root
  entries than the configured limit AND no approved_exceptions entry contains
  the broad-radius token, THEN THE checker SHALL fail naming the offending
  roots.
- WHERE a dated approved_exceptions entry contains the broad-radius token,
  THE checker SHALL accept the broad radius (expiry is still enforced by the
  existing exception rule).
- IF an active spec declares a scoped browser gate whose --grep pattern does
  not compile as a regular expression, THEN THE checker SHALL fail naming the
  pattern.
- IF an active spec declares a scoped browser gate whose --grep pattern
  matches the content of none of its existing related browser test files,
  THEN THE checker SHALL fail naming the pattern and the files consulted.
- WHILE a spec's status is not active, THE checker SHALL apply none of these
  three checks.
- WHERE a tuning list is empty (no hints, no broad roots), THE checker SHALL
  skip the corresponding check entirely.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (fixture repos, real validator):

- a ui-only active spec with a migrations surface fails with the hint message;
  the same spec declaring `migrations` produces no hint failure;
- an active spec with two exact broad roots fails; one broad root passes; a
  dated `broad-blast-radius:` exception silences it; scoped subpaths never
  count as broad;
- an active spec whose e2e gate greps a tag present in its related e2e file
  passes; a tag absent from every related browser test fails; an invalid
  regex fails; implemented specs with the same shapes produce no failures;
- the real repo (both current active specs plus the framework exception)
  validates clean.

Tasks: red tests in the repo-flavor enforcement suite; engine rule +
constants (both flavors); kit-flavor tests; docs (repo README, kit README,
authoring instructions); framework-spec exception; sync bundles; prove with
`governance:run-gates --spec MS-governance-active-spec-soundness --record`
and advance the lifecycle with `governance:advance`.
