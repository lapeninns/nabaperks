---
spec_id: MS-analytics-funnel-identity-privacy
status: implemented
risk_class: customer-pii
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/analytics/**
  - micro-specs/analytics/funnel-identity-privacy.md
  - micro-specs/evidence/MS-analytics-funnel-identity-privacy.json
  - lib/analytics/events.ts
  - lib/analytics/privacy-core.ts
  - lib/analytics/funnel-contract.ts
  - lib/analytics/funnel-token.ts
  - lib/analytics/funnel-events.ts
  - app/api/analytics/funnel/route.ts
  - components/analytics/marketing-funnel-tracker.tsx
  - components/layout/marketing-layout.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/signup-verify-form.tsx
  - app/(auth)/actions.ts
  - app/(auth)/signup/page.tsx
  - app/(auth)/signup/verify/page.tsx
  - .env.example
  - config/env-contract.json
  - lib/env/public.ts
  - scripts/check-env.mjs
  - scripts/env-keys.mjs
  - scripts/provider-readiness/checks.mjs
  - lib/legal/content.ts
  - tests/unit/analytics-privacy.test.mjs
  - tests/micro-specs/analytics-funnel-privacy.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/e2e/analytics-funnel-privacy.spec.ts
  - tests/e2e/analytics-funnel-privacy.desktop.spec.ts
implementation_surfaces:
  - micro-specs/analytics/funnel-identity-privacy.md
  - micro-specs/evidence/MS-analytics-funnel-identity-privacy.json
  - lib/analytics/events.ts
  - lib/analytics/privacy-core.ts
  - lib/analytics/funnel-contract.ts
  - lib/analytics/funnel-token.ts
  - lib/analytics/funnel-events.ts
  - app/api/analytics/funnel/route.ts
  - components/analytics/marketing-funnel-tracker.tsx
  - components/layout/marketing-layout.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/signup-verify-form.tsx
  - app/(auth)/actions.ts
  - app/(auth)/signup/page.tsx
  - app/(auth)/signup/verify/page.tsx
  - .env.example
  - config/env-contract.json
  - lib/env/public.ts
  - scripts/check-env.mjs
  - scripts/env-keys.mjs
  - scripts/provider-readiness/checks.mjs
  - lib/legal/content.ts
  - tests/unit/analytics-privacy.test.mjs
  - tests/micro-specs/analytics-funnel-privacy.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/e2e/analytics-funnel-privacy.spec.ts
  - tests/e2e/analytics-funnel-privacy.desktop.spec.ts
related_tests:
  - tests/unit/analytics-privacy.test.mjs
  - tests/micro-specs/analytics-funnel-privacy.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/e2e/analytics-funnel-privacy.spec.ts
  - tests/e2e/analytics-funnel-privacy.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --grep "@MS-analytics-funnel-identity-privacy"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Unit payload inspection proving raw identifiers and nested personal data cannot reach external analytics.
  - Token expiry and tamper proof plus deterministic first-party event idempotency proof.
  - Browser proof that acquisition continuity uses sessionStorage only and creates no analytics cookie or localStorage entry.
  - Browser proof that analytics network and storage failure never block marketing navigation or signup form submission.
approved_exceptions: []
---

# MS-analytics-funnel-identity-privacy — Privacy-safe merchant funnel identity

## 1. Exact Goal and User-Visible Outcomes

A prospective merchant can move from a marketing page into signup and email
verification without analytics changing or blocking that journey. Nabaperks
records distinct first-party acquisition and OTP milestones against one
short-lived pseudonymous funnel identity, while optional PostHog delivery is
off by default and can never receive raw account, merchant, customer, QR,
provider, contact, form, URL, or location values.

## 2. Blast Radius

May edit only the canonical product-event recorder and new privacy/funnel
helpers, the same-origin analytics endpoint and its small client tracker, the
marketing layout, signup and verification forms/pages/actions, the PostHog
environment/readiness contract, the privacy summary, this Micro-Spec, and its
focused unit/source/browser proofs.

Out of scope: database schema, RLS, cohort/admin reporting, onboarding/setup
instrumentation, billing or Stripe call sites, hosted writes, browser analytics
SDKs, cookies, fingerprinting, support-ticket integrations, and deciding the
legal approval or retention period for optional external processing. Those
durable activation and billing facts belong to the dependent Micro-Specs.

## 3. Strict Constraints and Assumptions

- `product_events` remains the first-party source of truth; PostHog is a
  best-effort mirror and its failure is never returned to a merchant flow.
- External capture is disabled unless an explicit pseudonymous mode, server-only
  project configuration, and a dedicated HMAC secret are all present.
- A server-only, domain-separated HMAC pseudonym is the only external distinct
  identity. Raw UUIDs and provider/contact values remain inside first-party
  storage.
- Funnel continuity uses a signed token with a two-hour lifetime in
  `sessionStorage`; no token is placed in a URL, cookie, `localStorage`, log, or
  external payload.
- The public endpoint accepts a bounded enum-only body, verifies same-origin
  requests, applies the existing server rate limiter, sends `Cache-Control:
  no-store`, and records only deterministic first-party events.
- Missing, expired, malformed, tampered, blocked-storage, rate-limit, database,
  or network states degrade to unattributed/no telemetry and never block the
  primary journey.
- Existing event callers may retain richer first-party metadata. External
  metadata is separately allowlisted and recursively rejected when unsafe.

## 4. Decisions Already Made

- Keep manual server-side PostHog capture and use the documented `/i/v0/e/`
  endpoint; do not add a browser or Node SDK dependency.
- Set `$process_person_profile: false` and use no PostHog session/person
  persistence.
- Sign funnel tokens with the existing server session secret under an analytics
  domain separator. Use `ANALYTICS_PSEUDONYM_SECRET` only for external identity.
- Issue and persist a funnel token before sending the first milestone write, so
  a lost issuance response cannot create an orphan event and a lost write
  response retries with the same deterministic UUID.
- Schedule successful auth milestones with Next `after()` so signup, resend,
  verification, and redirects never wait on analytics while Vercel keeps the
  registered server-side write alive after the response.
- Move PostHog key and host to server-only `POSTHOG_PROJECT_KEY` and
  `POSTHOG_HOST`; public environment variables no longer enable capture.
- Predeclare downstream activation event names while this spec owns the event
  registry: launch entered, billing reached, checkout started, checkout
  returned, and billing activated.
- Canonical acquisition events are marketing viewed, signup clicked, signup
  started, account created, verification viewed, OTP resent, and email verified.
- First-party event IDs are deterministic per funnel identity and semantic
  milestone. Repeated page hydration, clicks, retries, or action replay must not
  create duplicate milestone rows.

## 5. Behavioral Requirements (EARS)

- **FP-1:** WHILE external processing mode is absent or not `pseudonymous`, THE
  system SHALL make no PostHog request even when project key and host exist.
- **FP-2:** WHEN external capture is enabled, THE system SHALL send a
  domain-separated HMAC `distinct_id`, `$process_person_profile: false`, the
  canonical event name, and only explicitly allowlisted bounded properties.
- **FP-3:** IF an event contains a raw UUID, email, phone, IP address, URL,
  coordinate, token, secret, provider identifier, unknown identifier key,
  nested object, or array in outbound metadata, THEN THE system SHALL suppress
  that external event without exposing the value.
- **FP-4:** WHEN a new acquisition session is measured, THE system SHALL issue
  a signed two-hour token and store it only in browser `sessionStorage`.
- **FP-5:** IF the funnel token is missing, expired, malformed, or tampered,
  THEN THE server SHALL reject attribution and SHALL NOT trust client identity.
- **FP-6:** WHEN the same funnel milestone is delivered more than once, THE
  first-party recorder SHALL use the same deterministic event ID and retain one
  row without turning the duplicate into a user-visible error.
- **FP-6a:** IF the first token response is lost, THEN no milestone SHALL have
  been inserted; IF a later write response is lost, THEN retry SHALL reuse the
  stored token and deterministic event ID.
- **FP-7:** WHEN the homepage is shown and a signup CTA is activated, THE system
  SHALL record distinct marketing-view and signup-click milestones while
  preserving normal link navigation.
- **FP-8:** WHEN signup is shown and submitted, THE system SHALL record signup
  start and, only after Supabase accepts creation, account-created milestones.
- **FP-9:** WHEN verification is shown, a resend succeeds, or verification
  succeeds, THE system SHALL record distinct verify-viewed, OTP-resent, and
  email-verified milestones with success-only semantics.
- **FP-10:** IF analytics configuration, session storage, fetch, rate limiting,
  signing, persistence, or PostHog fails, THEN navigation, signup, resend, and
  verification SHALL continue according to their existing authoritative paths.
- **FP-11:** THE public analytics route SHALL enforce same-origin, a small JSON
  body, a closed event/source vocabulary, request throttling, and `no-store`
  responses.
- **FP-12:** THE privacy summary SHALL accurately distinguish first-party
  session measurement from optional pseudonymous PostHog processing and SHALL
  state that contact, form, provider, URL, and precise-location values are
  excluded.

## 6. Verification Criteria and Task Breakdown

1. Add red pure-function proofs for mode gating, HMAC stability/domain
   separation, unsafe nested-value rejection, signed-token tamper/expiry, and
   deterministic UUID generation.
2. Add red source-contract proofs for the server-only environment, closed event
   vocabulary, fail-open auth integration, route safeguards, and privacy copy.
3. Add a focused real-browser proof tagged
   `@MS-analytics-funnel-identity-privacy` that intercepts network calls,
   exercises marketing-to-signup continuity, inspects cookies/local/session
   storage, and proves a failed capture request does not block navigation.
4. Implement the pure privacy and token cores, then harden external capture
   before adding any new event callers.
5. Implement bounded same-origin first-party capture and session-only client
   continuity with issuance-before-write; instrument acquisition, account
   creation, verify arrival, successful resend, and successful verification,
   scheduling auth telemetry with `after()`.
6. Align environment tooling and the privacy summary, run all gates
   sequentially, record evidence, and re-prove every implemented predecessor
   whose declared surface becomes stale.
