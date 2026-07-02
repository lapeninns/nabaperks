---
spec_id: MS-platform-merchant-digest-email
status: implemented
risk_class: product-analytics
owner: codex
last_reviewed: 2026-07-02
allowed_blast_radius:
  - micro-specs/platform/merchant-weekly-digest.md
  - lib/notifications/resend.ts
  - lib/notifications/merchant-digest-email.ts
  - lib/notifications/merchant-digest.ts
  - lib/analytics/events.ts
  - app/api/cron/merchant-digest/route.ts
  - vercel.json
  - tests/unit/merchant-digest-email.test.mjs
  - tests/micro-specs/merchant-weekly-digest.test.mjs
implementation_surfaces:
  - lib/notifications/resend.ts
  - lib/notifications/merchant-digest-email.ts
  - lib/notifications/merchant-digest.ts
  - lib/analytics/events.ts
  - app/api/cron/merchant-digest/route.ts
  - vercel.json
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/notifications.md
related_tests:
  - tests/unit/merchant-digest-email.test.mjs
  - tests/micro-specs/merchant-weekly-digest.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm build
required_playwright_projects: []
evidence_required:
  - Unit output proving the weekly digest template renders metrics and dashboard trend labels, escapes merchant text in HTML, and keeps copy free of exclamation marks.
  - Micro-Spec output proving the cron guard, Vercel schedule, Resend wrapper export, product-event contract, and dedupe-before-send worker ordering.
  - Product-analytics gate floor output from the declared verification gates.
approved_exceptions: []
---

# MS-platform-merchant-digest-email

## Intent

The merchant weekly digest promised in the product copy sends real weekly email
summaries to active and trial venues. The digest reuses the dashboard metric
source so email and console numbers do not drift, dedupes successful sends in
`product_events`, and keeps OTP email behaviour unchanged.

## Scope

In scope:

- A reusable Resend transactional email sender that preserves `sendEmailOtp`.
- A pure weekly digest email template built from merchant dashboard metrics and
  `MerchantDashboardTrends` labels.
- A sequential service-role worker that selects digest-eligible merchants,
  dedupes recent successful sends, sends one email per merchant, and records a
  product event only after a successful send.
- A bearer-protected cron route and weekly Vercel schedule.

Out of scope:

- `notification_events`, push delivery, SMS, preference schema, account toggles,
  migrations, dashboard metric formula changes, and new email dependencies.
- Browser-only proof. This is a server/analytics slice and has no UI surface.

## Decisions Already Made

- The cron route uses the existing `CRON_SECRET` bearer guard shape.
- Digest candidates are merchants with `status in ('trial', 'active')` and a
  non-null email, loaded in pages of 100.
- A successful digest records `merchant_weekly_digest_sent` in
  `product_events`; failed sends retry on the next run.
- Dedupe checks the same product event within the previous six days before any
  send attempt.
- Opt-out v1 is honest copy: "Reply to this email if you'd rather not receive
  weekly summaries."

## EARS Requirements

- **MD-1 (OTP invariant):** WHEN OTP email is sent, THE system SHALL keep the
  current `sendEmailOtp({ to, code, audience })` signature and copy behaviour.
- **MD-2 (transactional sender):** THE Resend module SHALL expose
  `sendTransactionalEmail({ to, subject, text, html })` so non-OTP emails use
  the same provider configuration and failure handling.
- **MD-3 (template agreement):** THE digest email SHALL render dashboard metrics
  with `MerchantDashboardTrends` labels verbatim so email and dashboard trend
  copy agree.
- **MD-4 (merchant escaping):** WHEN merchant-controlled business names are
  rendered into HTML, THE digest template SHALL escape them.
- **MD-5 (eligible merchants):** THE worker SHALL list only `trial` and `active`
  merchants with an email address, paged at 100 rows.
- **MD-6 (dedupe before send):** IF a merchant already has
  `merchant_weekly_digest_sent` in `product_events` within six days, THEN THE
  worker SHALL skip that merchant before sending email.
- **MD-7 (record after send):** WHEN a digest email send succeeds, THE worker
  SHALL record `merchant_weekly_digest_sent`; failed sends SHALL NOT record the
  event.
- **MD-8 (sequential worker):** THE digest worker SHALL process merchants
  sequentially and SHALL NOT dispatch the merchant list with `Promise.all`.
- **MD-9 (cron auth):** IF `/api/cron/merchant-digest` is called without the
  valid `CRON_SECRET` bearer token, THEN THE system SHALL reject it with 401.
- **MD-10 (schedule):** THE Vercel cron SHALL call `/api/cron/merchant-digest`
  at `0 8 * * 1`.

## Verification

Required checks:

- Unit tests for digest template metrics, trend labels, HTML escaping, opt-out
  copy, en-GB number formatting, and no exclamation marks.
- Micro-Spec source checks for Resend exports/wrapper, cron bearer guard,
  weekly Vercel schedule, product event name, dedupe-before-send ordering, and
  no `notification_events` or list-level `Promise.all`.
- Product-analytics gate floor from `micro-specs/README.md`.

## Implementation Evidence

2026-07-02 local gate evidence: `pnpm governance:run-gates` passed after the
merchant digest route, worker, email template, Resend sender extraction,
product-event name, tests, and Vercel cron entry were present. Final `verified`
status still needs production deployment, bearer-protected cron proof, and one
real received merchant digest email.
