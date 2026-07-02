---
spec_id: MS-merchant-venue-announcements-ui
status: implemented
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-02
allowed_blast_radius:
  - micro-specs/merchant/venue-announcements-ui.md
  - app/app/announcements/page.tsx
  - app/app/page.tsx
  - app/dev/app-harness/layout.tsx
  - app/dev/app-harness/announcements/harness-client.tsx
  - app/dev/app-harness/announcements/page.tsx
  - components/layout/console-nav.ts
  - components/merchant/announcements/announcement-compose.tsx
  - lib/notifications/venue-announcements.ts
  - lib/notifications/venue-announcement-form-copy.ts
  - tests/unit/venue-announcement-form-copy.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/micro-specs/merchant-venue-announcements-ui.test.mjs
  - tests/e2e/helpers/harness.ts
  - tests/e2e/merchant-announcements-flow.ts
  - tests/e2e/merchant-announcements.spec.ts
  - tests/e2e/merchant-announcements.desktop.spec.ts
implementation_surfaces:
  - app/app/announcements/page.tsx
  - app/app/page.tsx
  - app/dev/app-harness/layout.tsx
  - app/dev/app-harness/announcements/harness-client.tsx
  - app/dev/app-harness/announcements/page.tsx
  - components/layout/console-nav.ts
  - components/merchant/announcements/announcement-compose.tsx
  - lib/notifications/venue-announcements.ts
  - lib/notifications/venue-announcement-form-copy.ts
related_docs:
  - AGENTS.md
  - DESIGN.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/notifications.md
related_tests:
  - tests/unit/venue-announcement-form-copy.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/micro-specs/merchant-venue-announcements-ui.test.mjs
  - tests/e2e/merchant-announcements-flow.ts
  - tests/e2e/merchant-announcements.spec.ts
  - tests/e2e/merchant-announcements.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@merchant-announcements"
  - pnpm test:a11y
  - pnpm test:visual
  - pnpm build
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Unit output proving route error codes map to merchant-readable compose copy.
  - Micro-Spec output proving the UI uses the existing venue-announcement route, keeps rate-limit and enqueue invariants unchanged, and keeps the mobile tab bar unchanged.
  - Playwright DB-free harness output proving success, skipped-member, rate-limit, moderation, and zero-eligible compose states.
approved_exceptions: []
---

# MS-merchant-venue-announcements-ui

## Intent

Merchants can compose a short venue announcement from the app console and see
how many members can receive it before sending. The UI is a thin client surface:
it previews server-derived eligibility, posts to the existing announcement API,
and leaves the current validation, rate-limit, and enqueue route unchanged.

## Scope

In scope:

- A merchant console page at `/app/announcements`.
- One read-only server helper that summarizes eligible announcement recipients
  by reusing the existing membership select and private audience resolver.
- A client compose form with title/body limits, live counters, success and error
  states, and an optional submit stub for the DB-free harness.
- A sidebar navigation entry plus a secondary home-page action.
- DB-free Playwright harness coverage for the compose states.

Out of scope:

- Changes to `app/api/**`, rate-limit settings, validation rules, notification
  enqueue payloads, delivery workers, migrations, RLS, preferences, or the
  merchant mobile tab bar.
- Server Actions or client imports from `venue-announcement-core.ts`.

## Decisions Already Made

- Title limit is 80 characters and body limit is 180 characters.
- The API remains `/api/notifications/venue-announcements`.
- Rate-limit copy tells merchants that announcements can go out up to 4 an hour.
- If no members are eligible, the page shows an empty state and disables submit.
- The sidebar label is "Announce"; the mobile tab bar is unchanged.

## EARS Requirements

- **VAU-1 (page guard):** WHEN a merchant opens `/app/announcements`, THE page
  SHALL require `getCurrentMerchant()` and redirect unauthenticated merchants to
  onboarding.
- **VAU-2 (audience preview):** THE page SHALL load
  `getVenueAnnouncementAudienceSummary(merchant.id)` server-side and show copy
  in the shape "About {eligible} of your {members} members can receive this."
- **VAU-3 (shared eligibility):** THE summary helper SHALL reuse the existing
  membership select and private `resolveAnnouncementAudience` path used by send
  so preview eligibility and send eligibility cannot drift.
- **VAU-4 (existing route):** WHEN a merchant sends an announcement, THE client
  SHALL fetch-POST to `/api/notifications/venue-announcements` and SHALL NOT use
  a new Server Action or import `venue-announcement-core.ts` client-side.
- **VAU-5 (compose limits):** THE title and body fields SHALL enforce
  `maxLength` values of 80 and 180, show live counters, and keep submit disabled
  while either field is blank.
- **VAU-6 (success state):** WHEN the API succeeds, THE UI SHALL show a success
  banner with eligible, queued, and skipped counts, including dedupe explanation
  when skipped is greater than zero.
- **VAU-7 (error copy):** WHEN the API returns `rate_limited`, THE UI SHALL say
  announcements can go out up to 4 an hour; WHEN the API returns moderation or
  validation errors, THE UI SHALL show plain-text guidance.
- **VAU-8 (empty state):** IF eligible recipients are zero, THE UI SHALL show an
  empty state and disable submission.
- **VAU-9 (navigation):** THE merchant sidebar SHALL include `/app/announcements`
  labelled "Announce" with `Megaphone01Icon`, and `merchantTabBarItems` SHALL
  remain unchanged.
- **VAU-10 (harness):** THE DB-free app harness SHALL expose an announcements
  route that exercises success, skipped, rate-limit, moderation, and zero-eligible
  states without Supabase.

## Verification

Required checks:

- Unit tests for form error-copy mapping.
- Micro-Spec source checks for the route invariants, helper reuse, page guard,
  form boundaries, navigation placement, and harness route registration.
- Playwright DB-free harness checks for the compose states.
- Full ui-only gate floor from `micro-specs/README.md`.

## Implementation Evidence

2026-07-02 local gate evidence: `pnpm governance:run-gates` passed after the
announcements page, client compose form, read-only audience summary helper,
navigation entry, harness route, unit tests, Micro-Spec checks, and
`@merchant-announcements` Playwright proof were present. Final `verified`
status still needs production deployment and one real announcement push
received on a consented device.
