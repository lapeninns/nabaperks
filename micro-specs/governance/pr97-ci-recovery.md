---
spec_id: MS-governance-pr97-ci-recovery
status: implemented
risk_class: migrations
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - .gitignore
  - micro-specs/governance/pr97-ci-recovery.md
  - micro-specs/evidence/MS-governance-pr97-ci-recovery.json
  - micro-specs/platform/pwa.md
  - next.config.ts
  - playwright.config.ts
  - scripts/env-keys.mjs
  - scripts/run-playwright.mjs
  - supabase/seed.sql
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-firefox.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-safari.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-firefox-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-safari-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-firefox.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-safari.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-firefox-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-safari-linux.png
  - tests/e2e/visual.spec.ts-snapshots/home-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/how-it-works-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/pricing-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-pubs-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-cafes-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-takeaways-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-bars-*-linux.png
implementation_surfaces:
  - .gitignore
  - micro-specs/platform/pwa.md
  - next.config.ts
  - playwright.config.ts
  - scripts/env-keys.mjs
  - scripts/run-playwright.mjs
  - supabase/seed.sql
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-firefox.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-safari.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-firefox-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-desktop-safari-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-firefox.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-safari.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-firefox-linux.png
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-desktop-safari-linux.png
  - tests/e2e/visual.spec.ts-snapshots/home-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/how-it-works-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/pricing-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-pubs-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-cafes-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-takeaways-*-linux.png
  - tests/e2e/visual.spec.ts-snapshots/loyalty-for-bars-*-linux.png
related_tests:
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/db/reward-pool-lifecycle.test.mjs
  - tests/db/reward-preset-atomic-add.test.mjs
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/next-config-root.test.mjs
  - tests/micro-specs/pr97-ci-recovery.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm db:seed
  - pnpm test:a11y
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:linux-visual-review
required_playwright_projects:
  - chromium
  - mobile-safari
  - desktop-firefox
  - desktop-safari
evidence_required:
  - Fresh local Supabase seed and database output proving every active join QR satisfies the three-active-reward invariant.
  - Linux Chromium and mobile Safari screenshots for the seven changed marketing routes plus separate macOS and Linux Firefox/WebKit launch screenshots, reviewed as intentional baseline updates.
  - Source-contract output proving the governance browser matrix remains four-project, the PWA gates execute their declared two-project matrix, every required launch snapshot exists, Playwright builds are isolated and cleaned, CodeQL-sensitive test fixtures remain explicit, and environment-file writes avoid check-then-use races.
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

In scope are the four missing Linux Firefox/WebKit launch snapshots required by
the active governance matrix, the canonical seed rows that violate the current
join QR invariant on a fresh database, all five CodeQL findings surfaced as
blockers on the PR (three test-only data-flow/assertion sites and two
environment-file check-then-use races), a focused regression test, and only the
fourteen stale Linux marketing snapshots named by the failed Visual regression
job. Also in scope is the proof-runner defect discovered during recovery: a
Playwright dev server can share `.next` with a live local server or another
sequential gate, and Firefox/WebKit launch snapshots currently share one
cross-OS filename.

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
- Environment helper writes must not suppress CodeQL. Non-force creation must
  be exclusive, and merge reads must tolerate a concurrently absent file
  without a separate existence check.
- The governance browser matrix intentionally covers Chromium, mobile Safari,
  desktop Firefox, and desktop Safari; the PWA matrix intentionally covers
  Chromium and mobile Safari. Missing baselines must be supplied rather than
  shrinking either declared contract.
- PWA service-worker behavior is Chromium-only, while its accessibility and
  visual proof must explicitly execute Chromium and mobile Safari instead of
  relying on implicit project selection.
- Every Playwright invocation must use the dedicated project-local `.next-e2e`
  build directory and remove it after the run. The normal app build remains
  `.next`.
- Linux screenshot names must be OS-specific for all four browser projects;
  macOS and Linux baselines must never overwrite or validate each other.
- Linux snapshots may change only after a stable two-capture run and visual
  inspection. Pixel thresholds and retries remain unchanged.
- The full lifecycle proof runs once at `active -> implemented`; focused Red /
  Green checks provide the per-edit feedback loop.

## 4. Decisions Already Made

- Preserve the existing active-spec browser matrices and add only the four
  missing launch-follow-through baselines required by the four-project
  governance accessibility gate.
- Make the active PWA commands executable expressions of its existing matrix:
  Chromium for the desktop-only service-worker scenario, and Chromium plus
  mobile Safari for accessibility and visual proof.
- Add two active Bubble Yard reward-pool rows before the QR upsert; do not
  weaken the database trigger or reorder the QR ahead of valid dependencies.
- Replace static URL regex assertions with literal containment checks.
- Separate rejected password values from generated fixture emails rather than
  suppressing CodeQL or changing production password hashing.
- Replace environment-file preflight checks with exclusive non-force creation
  and an ENOENT-aware direct read before merge writes.
- Make `scripts/run-playwright.mjs` assign and clean a dedicated managed Next
  `distDir`, leaving explicit caller-owned overrides intact for diagnostics.
- Apply the existing Linux snapshot template to desktop Firefox and desktop
  Safari, then approve separate macOS and Linux launch baselines.
- Regenerate only home, how-it-works, pricing, and four persona-spoke Linux
  twins for Chromium/mobile Safari plus the missing dashboard/QR launch twins
  for desktop Firefox and desktop Safari.

## 5. Behavioral Requirements (EARS)

- WHEN the active governance accessibility gate runs its declared four-project
  matrix, THE repository SHALL provide the dashboard and QR launch baselines
  required by desktop Firefox and desktop Safari.
- WHEN the active PWA gates run, THE service-worker scenario SHALL select
  Chromium explicitly and the accessibility/visual gates SHALL select exactly
  Chromium and mobile Safari.
- WHEN the canonical seed is applied to a freshly migrated database, THE
  Bubble Yard join QR SHALL activate only after its card owns at least three
  active rewards.
- WHEN the password-policy live proof cleans rate-limit buckets, THE fixture
  email identities SHALL be independent of rejected password values while the
  bucket keys remain production-compatible.
- WHEN auth-hook URL source contracts are checked, THE tests SHALL use exact
  literal URL containment and SHALL NOT use unanchored URL regular expressions.
- WHEN `.env.local` is created without `--force`, THE helper SHALL use an
  exclusive write and preserve the existing-file refusal contract atomically.
- WHEN an environment merge reads a file that disappears concurrently, THE
  helper SHALL treat ENOENT as an empty starting document without a separate
  existence check, and SHALL rethrow every other read error.
- WHEN Playwright starts a Next server, THE wrapper SHALL use a dedicated
  managed
  build directory inside the project and SHALL remove that directory after the
  child exits, while ordinary development/build commands SHALL keep `.next`.
- WHEN CI runs desktop Firefox or desktop Safari screenshots on Linux, THE
  snapshot path SHALL include `-linux`; WHEN the same proof runs on macOS, THE
  generic macOS baseline SHALL remain separate.
- WHEN Linux renders the seven intentionally changed marketing routes and the
  two governed launch states, THE committed baselines SHALL match stable output
  on every declared project and retain the approved Wet Ink layout.
- IF any required PR #97 check remains red after the pushed fix, THEN THE work
  SHALL remain unmergeable and the failing job SHALL be triaged from its new
  log rather than bypassed.

## 6. Verification Criteria and Task Breakdown

Verification is complete when:

1. A focused source contract proves the governance matrix still names four
   projects, the PWA commands execute their declared two-project matrix,
   Playwright assigns and cleans an isolated Next build directory, all browser
   projects use Linux-specific CI paths, and all eight cross-OS launch snapshot
   files exist.
2. A fresh local Supabase reset/seed succeeds and the seeded active join QRs
   each read back at or above three active rewards.
3. The password-policy, auth-recovery, and environment-helper source contracts
   pass without CodeQL's rejected-password hash, unanchored-URL, or file-race
   patterns.
4. Linux updates exactly fourteen marketing snapshots and creates four Linux
   cross-browser launch snapshots; macOS creates the four matching local
   baselines; full a11y and scoped visual commands pass and the refreshed images
   are reviewed.
5. Lint, typecheck, governance, build, unit/Micro-Spec, coverage, database,
   seed, and scoped visual gates pass in the single lifecycle boundary.
6. PR #97 is updated and the pushed commit reports green Typecheck and build,
   DB behavioral moat, Visual regression, and CodeQL checks.

Task order: activate this contract; add focused Red tests; repair seed
dependencies; repair the CodeQL-sensitive test shapes; generate and inspect
the missing/stale Linux baselines; run the lifecycle proof once; commit, push,
update the PR body, and monitor required checks.
