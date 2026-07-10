---
spec_id: MS-governance-pr97-ci-recovery
status: active
risk_class: migrations
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/governance/**
  - micro-specs/governance/ai-delivery-framework.md
  - micro-specs/platform/pwa.md
  - supabase/seed.sql
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/e2e/visual.spec.ts-snapshots/home-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/how-it-works-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/pricing-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-pubs-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-cafes-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-takeaways-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-bars-*-linux.png
implementation_surfaces:
  - micro-specs/governance/ai-delivery-framework.md
  - micro-specs/platform/pwa.md
  - supabase/seed.sql
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/e2e/visual.spec.ts-snapshots/home-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/how-it-works-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/pricing-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-pubs-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-cafes-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-takeaways-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-bars-*-linux.png
related_tests:
  - tests/e2e/visual.spec.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm db:seed
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:linux-visual-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Fresh local Supabase seed and database output proving every active join QR satisfies the three-active-reward invariant.
  - Linux Chromium and mobile Safari screenshots for the seven changed marketing routes, reviewed as intentional baseline updates.
  - Source-contract output proving active-spec browser gates stay inside their declared Playwright project matrix and CodeQL-sensitive test fixtures remain explicit.
  - GitHub PR check output proving Typecheck and build, DB behavioral moat, Visual regression, and CodeQL all pass on the pushed commit.
approved_exceptions: []
---

# MS-governance-pr97-ci-recovery — Restore PR 97 CI proof integrity

## 1. Exact Goal and User-Visible Outcomes

Restore PR #97 to a trustworthy mergeable state without weakening product,
database, accessibility, visual, or security contracts. A merchant-facing
change is complete only when the same committed tree passes the repository's
fresh-database, Linux-visual, CodeQL, and governed browser proof in GitHub CI.

## 2. Blast Radius

In scope are the two active Micro-Spec gate commands that overrun their
declared browser matrix, the canonical seed rows that violate the current join
QR invariant on a fresh database, the two test-only CodeQL data-flow/assertion
sites, a focused governance regression test, and only the fourteen stale Linux
marketing snapshots named by the failed Visual regression job.

Out of scope are production password storage, authentication policy, runtime
rate-limit hashing, merchant schema/RPC changes, marketing redesign, broad
snapshot refreshes, CI required-check removal, and threshold relaxation.

## 3. Strict Constraints and Assumptions

- The three-active-reward launch invariant remains unchanged and fail-closed.
- Bubble Yard remains an active seeded demo venue because its activity fixture
  references the stable join QR; the seed must add valid rewards rather than
  disable or bypass that QR.
- SHA-256 remains the production-compatible rate-limit bucket derivation; test
  password candidates and rate-limit cleanup identities must have separate
  data flow so static analysis cannot confuse that hash with password storage.
- Browser gates must execute exactly the projects declared in
  `required_playwright_projects`; missing Firefox/WebKit snapshots are not a
  reason to invent unrequired proof.
- Linux snapshots may change only after a stable two-capture run and visual
  inspection. Pixel thresholds and retries remain unchanged.
- The full lifecycle proof runs once at `active -> implemented`; focused Red /
  Green checks provide the per-edit feedback loop.

## 4. Decisions Already Made

- Scope `test:e2e` and `test:a11y` gates in both active specs to Chromium and
  mobile Safari, matching their existing declared matrix and dedicated CI jobs.
- Add two active Bubble Yard reward-pool rows before the QR upsert; do not
  weaken the database trigger or reorder the QR ahead of valid dependencies.
- Replace static URL regex assertions with literal containment checks.
- Separate rejected password values from generated fixture emails rather than
  suppressing CodeQL or changing production password hashing.
- Regenerate only home, how-it-works, pricing, and four persona-spoke Linux
  twins for Chromium and mobile Safari.

## 5. Behavioral Requirements (EARS)

- WHEN the active governance and PWA specs run browser gates, THE gate commands
  SHALL name Chromium and mobile Safari and SHALL NOT implicitly expand to
  undeclared desktop Firefox or desktop Safari projects.
- WHEN the canonical seed is applied to a freshly migrated database, THE
  Bubble Yard join QR SHALL activate only after its card owns at least three
  active rewards.
- WHEN the password-policy live proof cleans rate-limit buckets, THE fixture
  email identities SHALL be independent of rejected password values while the
  bucket keys remain production-compatible.
- WHEN auth-hook URL source contracts are checked, THE tests SHALL use exact
  literal URL containment and SHALL NOT use unanchored URL regular expressions.
- WHEN Linux renders the seven intentionally changed marketing routes, THE
  committed Chromium and mobile Safari baselines SHALL match stable output and
  retain the approved Wet Ink layout.
- IF any required PR #97 check remains red after the pushed fix, THEN THE work
  SHALL remain unmergeable and the failing job SHALL be triaged from its new
  log rather than bypassed.

## 6. Verification Criteria and Task Breakdown

Verification is complete when:

1. A focused source contract fails against the current bare active-spec browser
   gates and passes after both specs name their declared projects.
2. A fresh local Supabase reset/seed succeeds and the seeded active join QRs
   each read back at or above three active rewards.
3. The password-policy and auth-recovery source contracts pass without CodeQL's
   rejected-password hash or unanchored-URL patterns.
4. Linux updates exactly fourteen marketing snapshots; the same Linux visual
   command then passes 38/38 and the refreshed images are reviewed.
5. Lint, typecheck, governance, build, unit/Micro-Spec, coverage, database,
   seed, and scoped visual gates pass in the single lifecycle boundary.
6. PR #97 is updated and the pushed commit reports green Typecheck and build,
   DB behavioral moat, Visual regression, and CodeQL checks.

Task order: activate this contract; add focused Red tests; repair gate scoping;
repair seed dependencies; repair the CodeQL-sensitive test shapes; regenerate
and inspect Linux baselines; run the lifecycle proof once; commit, push, update
the PR body, and monitor required checks.
