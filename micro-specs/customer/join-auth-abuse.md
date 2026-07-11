---
spec_id: MS-customer-join-auth-abuse
status: implemented
risk_class: auth-session
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/join-auth-abuse.md
  - micro-specs/evidence/MS-customer-join-auth-abuse.json
  - app/m/[merchantSlug]/join/actions.ts
  - app/home/actions.ts
  - app/home/login/page.tsx
  - app/q/[qrId]/page.tsx
  - components/customer/join-forms.tsx
  - components/customer/customer-login-form.tsx
  - components/customer/join-otp-form.tsx
  - components/customer/join-wizard.tsx
  - lib/customer/phone.ts
  - lib/customer/verification.ts
  - lib/customer/otp-rate-limit-core.ts
  - lib/customer/otp-rate-limit.ts
  - lib/security/rate-limit-core.ts
  - lib/security/rate-limit.ts
  - lib/security/customer-device-token.ts
  - lib/security/csp.ts
  - config/env-contract.json
  - proxy.ts
  - scripts/check-env.mjs
  - .env.example
  - tests/unit/customer-phone.test.mjs
  - tests/unit/customer-verification.test.mjs
  - tests/unit/rate-limit-core.test.mjs
  - tests/unit/customer-device-token.test.mjs
  - tests/unit/customer-otp-rate-limit-core.test.mjs
  - tests/micro-specs/customer-join-auth-abuse.test.mjs
  - tests/micro-specs/public-qr-router-contract.test.mjs
  - tests/e2e/customer-join-otp-resilience/visual.spec.ts
implementation_surfaces:
  - app/m/[merchantSlug]/join/actions.ts
  - app/home/actions.ts
  - app/home/login/page.tsx
  - app/q/[qrId]/page.tsx
  - components/customer/join-forms.tsx
  - components/customer/customer-login-form.tsx
  - components/customer/join-otp-form.tsx
  - components/customer/join-wizard.tsx
  - lib/customer/phone.ts
  - lib/customer/verification.ts
  - lib/customer/otp-rate-limit-core.ts
  - lib/customer/otp-rate-limit.ts
  - lib/security/rate-limit-core.ts
  - lib/security/rate-limit.ts
  - lib/security/customer-device-token.ts
  - lib/security/csp.ts
  - config/env-contract.json
  - proxy.ts
  - scripts/check-env.mjs
  - .env.example
  - tests/unit/customer-phone.test.mjs
  - tests/unit/customer-verification.test.mjs
  - tests/unit/rate-limit-core.test.mjs
  - tests/unit/customer-device-token.test.mjs
  - tests/unit/customer-otp-rate-limit-core.test.mjs
  - tests/micro-specs/customer-join-auth-abuse.test.mjs
  - tests/micro-specs/public-qr-router-contract.test.mjs
  - tests/e2e/customer-join-otp-resilience/visual.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
related_tests:
  - tests/unit/customer-phone.test.mjs
  - tests/unit/customer-verification.test.mjs
  - tests/unit/rate-limit-core.test.mjs
  - tests/unit/customer-device-token.test.mjs
  - tests/unit/customer-otp-rate-limit-core.test.mjs
  - tests/micro-specs/customer-join-auth-abuse.test.mjs
  - tests/e2e/customer-join-otp-resilience/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-customer-join-auth-abuse"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Provider-boundary proof for timeout, network, 429, 5xx, wrong-code, and success outcomes without raw provider details or phone values.
  - Browser evidence that country validation, resend, and incorrect-code failures stay inside the composed join form with a usable recovery action.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-join-auth-abuse — Customer join OTP abuse and provider resilience

## 1. Exact Goal and User-Visible Outcomes

A legitimate UK customer can request and verify a join or wallet OTP without a provider outage producing a broken page. Automated number rotation cannot create unbounded SMS cost from one request identity, unsupported international destinations are refused before provider dispatch, and rate-limit feedback remains calm and actionable.

## 2. Blast Radius

This spec owns the shared customer phone parser, OTP rate-limit policy, Twilio Verify boundary, the join and wallet OTP actions, their focused form feedback, environment validation, and focused tests listed in frontmatter. It may not change customer persistence, session-cookie encoding, membership/stamp RPCs, referral logic, merchant auth, or the Wet Ink design system.

## 3. Strict Constraints and Assumptions

- Phone OTP remains the passwordless customer identity gate.
- The supported production destination is GB. Test-only numbers and provider bypasses remain non-production only.
- Limits must cover both repeated sends to one phone and total sends from one trusted request identity; raw phone values must never appear in stored bucket keys or logs.
- Provider calls have a bounded timeout. Timeout, network, 429, and 5xx outcomes are retryable product states, not incorrect-code states.
- OTP send and verification remain fail-closed: no pending cookie, customer, or session may be created after a rejected boundary.
- The phone-wide and hard identity-wide ceilings block repeated sends and number rotation; trusted resends rely on the encrypted pending-phone state.

## 4. Decisions Already Made

- Join and wallet use the same shared OTP policy.
- Customer OTP abuse protection stays server-side so a third-party challenge cannot block or crash the phone step.
- GB-only is the initial country policy; expanding it requires a later explicit product decision.
- Request identity is derived from trusted proxy input and may not depend on user-agent alone for reset resistance.
- Product copy never exposes Twilio, database, credentials, raw phone values, or provider response bodies.
- Existing dev OTP behavior remains deterministic outside production and must refuse to activate in Vercel preview or production.

## 5. Behavioral Requirements (EARS)

- WHEN a valid GB phone requests a code within all limits, THE system SHALL dispatch one bounded provider request and advance to the OTP state.
- IF a parsed phone is outside the supported country policy, THEN THE system SHALL reject it before rate-limit reservation or provider dispatch.
- THE system SHALL enforce a phone-wide send limit and an identity-wide daily send ceiling across both join and wallet entry points.
- IF phone rotation consumes the identity-wide ceiling, THEN THE system SHALL reject the send before calling the provider.
- IF a verification provider request times out, fails at the network, returns 429, returns 5xx, or returns malformed data, THEN THE form SHALL retain the customer’s flow context and show a retry or resend action without creating identity or session state.
- IF a provider rejects a syntactically valid code, THEN THE system SHALL show the ordinary incorrect-code response and SHALL NOT classify it as provider unavailability.
- WHEN a resend is rejected or succeeds, THE OTP screen SHALL announce the settled outcome once without losing QR or referral intent.
- WHERE a non-production deterministic OTP is configured, THE system SHALL skip the provider only outside Vercel preview and production.
- THE system SHALL avoid logging or persisting raw phone numbers, OTPs, provider bodies, or provider credentials.

## 6. Verification Criteria and Task Breakdown

1. Prove the country policy, identity-wide daily ceiling, phone-wide limits, and opaque stored bucket keys with failing pure tests.
2. Prove provider success, rejection, timeout, network, 429, 5xx, malformed response, and redaction behavior with a mocked external boundary.
3. Implement the shared policy and bounded provider adapter, then integrate both join and wallet actions without changing their successful navigation contract.
4. Prove in Chromium and mobile Safari that send, resend, wrong-code, and provider-unavailable states remain in-form, preserve intent, and expose a usable next action.
5. Run and record every declared gate, then advance only when no provider or phone PII appears in evidence output.
