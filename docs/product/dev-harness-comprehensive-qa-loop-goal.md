# Dev-Harness Comprehensive QA Loop Goal

This is the tracked mirror of `.omo/plans/dev-harness-comprehensive-qa-loop.md`.
Use it to run a local, no-human QA loop over Nabaperks through the dev harness.

## Execution Prompt

```text
$ulw-loop

cwd: /Users/amankumarshrestha/LapenInns Project/Nabaperks

Goal: Run a comprehensive no-human Nabaperks QA coverage loop through the local dev harness and existing automated gates. The desired verdict is LOCAL HARNESS QA GREEN or LOCAL HARNESS QA NOT READY, not production readiness.

Primary QA surface:
- Use /dev/app-harness/** as the main rendered merchant-console QA surface.
- Use /dev/design-system and /dev/poster-preview for design-system and poster proof.
- Use DB-free Playwright harness routes and static fixtures wherever possible.
- Use existing unit, micro-spec, visual, a11y, and harness E2E tests as supporting evidence.

Hard exclusions:
- Do not require real OTP delivery.
- Do not require real merchant login, customer login, admin login, or admin MFA.
- Do not open Stripe checkout or Stripe portal.
- Do not send Resend, Twilio, Web Push, or real provider traffic.
- Do not mutate production, staging, Vercel, Supabase production, or provider dashboards.
- Do not ask for human involvement unless a safety boundary is hit.

Classification model:
Every route, story, risk, test, or edge case must be classified as one of:
- COVERED_BY_HARNESS
- COVERED_BY_STATIC_TEST
- COVERED_BY_LOCAL_DB_AUTOMATION
- COVERED_BY_EXISTING_PLAYWRIGHT
- BLOCKED_PROVIDER_PROOF
- BLOCKED_HUMAN_AUTH
- OUT_OF_SCOPE_FOR_HARNESS_LOOP
- GAP_REQUIRES_FOLLOW_UP

Phase 1: Inventory and Traceability
- Read AGENTS.md, DESIGN.md, micro-specs/README.md, micro-specs/GLOBAL_CONTEXT.md, Instructions_MircroSpecsCreation.md, Instructions_tdd.md, package.json, playwright.config.ts, tests/**, app/** route tree, app/dev/**, scripts/capture-app-harness.mjs, and supabase/migrations.
- Build a closed QA register: route/story/risk -> required proof layer -> actual evidence source.
- Include these harness routes explicitly:
  - /dev/app-harness/dashboard
  - /dev/app-harness/dashboard?sidebar=collapsed
  - /dev/app-harness/customers
  - /dev/app-harness/activity
  - /dev/app-harness/account?tab=profile
  - /dev/app-harness/account?tab=billing
  - /dev/app-harness/launch?tab=venue
  - /dev/app-harness/launch?tab=card
  - /dev/app-harness/launch?tab=rewards
  - /dev/app-harness/launch?tab=qr
  - /dev/app-harness/onboarding
  - /dev/app-harness/qr
  - /dev/app-harness/scan
  - /dev/app-harness/reward-scan
  - /dev/app-harness/reward-scan?collected=1
  - /dev/app-harness/announcements
  - /dev/app-harness/skeletons
  - /dev/app-harness/states
  - /dev/design-system
  - /dev/poster-preview

Phase 2: Edge-Case Register
Create a closed edge-case matrix covering:
- malformed input
- invalid or expired tokens
- duplicate submissions
- race and concurrency risk
- stale browser state
- unauthenticated access
- wrong tenant or cross-merchant isolation
- missing provider env
- provider unavailable
- offline or PWA fallback
- mobile viewport
- desktop viewport
- cross-browser rendering
- accessibility
- visual regression
- data privacy leakage
- billing entitlement drift
- webhook replay or idempotency
- cron auth
- QR scanner failure
- reward single-use
- daily stamp limit
- erasure and consent
- route-not-found and redirect safety

Phase 3: Execute No-Human Automated Gates
Run and record exact pass/fail/skip output for:
- pnpm lint
- pnpm governance:check
- pnpm governance:run-gates
- pnpm tokens:check
- pnpm claims:check
- pnpm typecheck
- pnpm test
- pnpm test:coverage
- pnpm build
- pnpm bundle:check
- pnpm jsonld:check
- pnpm test:e2e, scoped first to harness/a11y/visual/dev routes if needed, then broader if stable
- pnpm test:a11y
- pnpm test:visual

Optional local-only supporting gates:
- pnpm test:db only if a disposable local SUPABASE_DB_URL is already available. If not, classify DB proof as BLOCKED_PROVIDER_PROOF or BLOCKED_LOCAL_DB, but do not call it passed.
- pnpm lighthouse if the local runtime supports it.
- tests/load only if the required runner is available locally without external services.

Phase 4: Manual Browser QA Through Harness
Drive the rendered harness in a real browser and capture action logs or screenshots for:
- merchant dashboard shell, nav, collapsed sidebar, and soft navigation
- customers table states and responsive layout
- activity feed states
- account profile and billing skeleton/non-provider state
- launch venue/card/rewards/QR tabs
- onboarding setup shell
- QR poster and QR image rendering
- scanner page and reward-scan collected/uncollected states
- announcement success, validation, rate-limit, and moderation fixture states
- skeleton/loading/empty/error states
- design-system components and poster preview

Use the current app server or Playwright webServer. If port 3000 is already locked by Next, reuse the existing server or let Playwright use its configured baseURL instead of fighting the lock.

Phase 5: Gap Report
For every uncovered item, produce a follow-up task with:
- risk area
- missing evidence
- why the harness cannot prove it
- recommended proof path
- priority P0/P1/P2

Do not make production code changes unless a tiny documentation or test-runner fix is clearly required to complete the QA inventory. If a real defect is found, record it with evidence and recommend a separate fix loop.

Final output:
- LOCAL HARNESS QA GREEN or LOCAL HARNESS QA NOT READY.
- Exact commands run and result.
- Harness routes exercised and evidence paths.
- Automated test categories covered.
- Edge-case matrix with classification.
- Blocked provider/human-auth/prod-proof items.
- P0/P1/P2 follow-up list.

Important verdict rule:
Do not say "production ready" from this loop. This loop bypasses human auth, OTP, billing, providers, and production writes by design.
```

