---
spec_id: MS-auth-recovery-ux
status: active
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-09
allowed_blast_radius:
  - micro-specs/auth/recovery-ux.md
  - micro-specs/evidence/MS-auth-recovery-ux.json
  - app/(auth)/actions.ts
  - app/(auth)/signup/page.tsx
  - app/(auth)/signup/verify/page.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/reset-password/page.tsx
  - app/auth/confirm/route.ts
  - components/auth/auth-form.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/signup-verify-form.tsx
  - components/auth/reset-password-form.tsx
  - components/auth/otp-resend-control.tsx
  - lib/auth/merchant-auth-action-state.ts
  - lib/auth/merchant-otp-resend.ts
  - lib/navigation/merchant-auth-hrefs.ts
  - lib/security/rate-limit.ts
  - tests/unit/merchant-auth-action-state.test.mjs
  - tests/unit/merchant-otp-resend.test.mjs
  - tests/unit/safe-next-path.test.mjs
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/e2e/merchant-auth-recovery.spec.ts
  - tests/e2e/merchant-auth-recovery.desktop.spec.ts
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-*.png
implementation_surfaces:
  - micro-specs/auth/recovery-ux.md
  - micro-specs/evidence/MS-auth-recovery-ux.json
  - app/(auth)/actions.ts
  - app/(auth)/signup/page.tsx
  - app/(auth)/signup/verify/page.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/reset-password/page.tsx
  - app/auth/confirm/route.ts
  - components/auth/auth-form.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/signup-verify-form.tsx
  - components/auth/reset-password-form.tsx
  - components/auth/otp-resend-control.tsx
  - lib/auth/merchant-auth-action-state.ts
  - lib/auth/merchant-otp-resend.ts
  - lib/navigation/merchant-auth-hrefs.ts
  - lib/security/rate-limit.ts
  - tests/unit/merchant-auth-action-state.test.mjs
  - tests/unit/merchant-otp-resend.test.mjs
  - tests/unit/safe-next-path.test.mjs
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/e2e/merchant-auth-recovery.spec.ts
  - tests/e2e/merchant-auth-recovery.desktop.spec.ts
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-*.png
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
  - supabase/config.toml
related_tests:
  - tests/unit/merchant-auth-action-state.test.mjs
  - tests/unit/merchant-otp-resend.test.mjs
  - tests/unit/safe-next-path.test.mjs
  - tests/micro-specs/auth-recovery-ux.test.mjs
  - tests/e2e/merchant-auth-recovery.spec.ts
  - tests/e2e/merchant-auth-recovery.desktop.spec.ts
  - tests/e2e/a11y.spec.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-auth-recovery-ux"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:local-supabase-session-proof
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Mobile and desktop browser proof for exact OTP outcomes, resend cooldown, cross-form pending coordination, focus, and live-region behavior.
  - Live local-Supabase proof that a disposable provider token entered through the real signup and recovery forms establishes a session and reaches the sanitized next route.
  - Accessibility proof with zero serious or critical axe violations across signup, verification, login, and password reset.
  - Visual regression proof for the four merchant auth routes at mobile and desktop viewports.
  - Source and runtime proof that passwords, provider tokens, raw provider errors, and untrusted redirect targets never enter action state or browser output.
approved_exceptions: []
---

# MS-auth-recovery-ux — Recoverable merchant email verification

## 1. Exact Goal and User-Visible Outcomes

A merchant who signs up, needs a fresh verification email, or resets a
password receives exact, calm recovery guidance instead of a generic failure.
The UI distinguishes invalid, expired, used, superseded, busy, throttled, and
temporarily unavailable codes; shows the real resend wait; preserves the
merchant's safe email, name, and destination context; and remains resumable
after refresh. A valid local-Supabase signup or recovery code still establishes
the expected authenticated session and continues to the sanitized destination.

## 2. Blast Radius

May edit only the merchant auth actions and public auth pages, their four form
components plus one shared resend control, the pure action-state and server
resend helpers, merchant auth URL builders, the existing rate-limit readback,
and the focused unit, source-contract, Playwright, accessibility, and snapshot
tests listed in frontmatter.

Out of scope: the OTP alias database migration and lifecycle RPCs, customer OTP,
hosted Supabase or Resend configuration, production email-delivery operations,
password-policy modernisation, funnel analytics, onboarding, billing, shared
marketing layout redesign, and any new database schema. The focused signup,
verification, and reset shell, spam-folder guidance, distinct password-rule
labels, numeric keyboard, one-time-code autocomplete, and paste-friendly single
OTP field already exist and must be preserved.

## 3. Strict Constraints and Assumptions

- Server state and Supabase verification remain authoritative. Countdown text
  is presentation only and may never bypass server or provider limits.
- Supabase local configuration currently enforces a one-minute send frequency;
  the app SHALL use a 60-second resend cooldown and a separate bounded resend
  window for signup and recovery.
- The focused OTP action state may contain only safe context, a closed outcome,
  house-authored copy, and an ISO retry timestamp. It SHALL never contain a
  password, provider token, raw provider error, reservation nonce, or rate-limit
  identity.
- Public UI SHALL collapse the internal alias resolution `rejected` into
  `invalid`; no internal provider or database vocabulary reaches merchants.
- Email-existence responses remain non-enumerating. Reset send success keeps
  the conditional “if that email has a venue account” contract.
- Every `next` value is sanitized with the existing merchant redirect policy
  before entering a URL, hidden input, action result, or redirect.
- Signup and recovery resend buckets are separate from initial signup and from
  code-verification buckets. A resend action must not spend the initial-signup
  allowance.
- A delivery failure after alias creation means no code is promised usable:
  alias creation supersedes the old code and the failed new alias is revoked.
- Successful provider verification remains authoritative even if alias cleanup
  later reports a miss, preserving the prior Micro-Spec invariant.
- The reset verify stage may be resumed from a safe GET URL, but displaying the
  form never proves the email exists; only the real code can establish a
  session.
- Browser proof uses disposable local users and aliases only, never live email
  delivery or linked/production database writes.

## 4. Decisions Already Made

- Add a dedicated `MerchantOtpActionState`, separate from ordinary credential
  field validation, with a closed outcome union: `idle`, `invalid`, `expired`,
  `used`, `superseded`, `busy`, `throttled`, `verification_unavailable`,
  `delivery_unavailable`, `sent`, `verification_required`, and
  `password_update_failed`.
- `retryAt` is an ISO timestamp. Busy and database-throttled outcomes pass
  through the alias lifecycle timestamp; app-level limits read the durable
  bucket reset time; a successful send returns the 60-second cooldown reset.
- Resend enforcement uses purpose-scoped keys, one send per 60 seconds, and a
  five-send-per-15-minute safety window keyed by normalized email plus trusted
  request identity. Initial signup starts only the signup cooldown after its
  provider send succeeds; the verification GET peeks that durable bucket so a
  refresh cannot reset the wait. The provider's frequency rule remains defense
  in depth.
- Signup verification uses one validated `verify | resend` action dispatcher,
  and password reset uses one `request | resend | confirm` dispatcher. Each
  screen therefore has one current OTP state and one pending flag, preventing
  stale feedback and simultaneous submissions without returning passwords in
  resend requests.
- The login “Get a fresh code” affordance becomes a POST action. Success goes
  directly to verification with email, safe next path, and cooldown preserved;
  failure stays on login with honest recovery copy.
- Signup correction preserves email, name, and safe next in both directions.
  Login, password reset, failed confirmation, and reset success preserve email
  where known and the safe next path.
- Password reset has an explicit resumable verify stage so refresh and local
  integration proof do not need to send another email.
- The shared dispatcher exposes one `useActionState` pending flag to every
  control in its flow and disables conflicting controls while any request is in
  flight.
- Invalid or malformed input focuses the OTP field. Terminal or waiting states
  focus their recovery alert/action. A successful resend clears the obsolete
  OTP and focuses the field for the new code.
- Error feedback uses `role="alert"`. Send success and cooldown availability
  use polite status semantics. The visible countdown is not a per-second live
  announcement; assistive technology hears only cooldown start and availability.
- Reset reuses the existing live `PasswordRequirements` component and client
  validation, without changing the actual password policy.

## 5. Behavioral Requirements (EARS)

- WHEN a verification action returns, THE system SHALL expose one closed OTP outcome and only the safe context needed to render recovery.
- IF an alias is invalid or internally rejected, THEN THE UI SHALL associate the error with the OTP field and focus that field.
- IF an alias is expired, used, or superseded, THEN THE UI SHALL explain the exact state and present a POST path to a fresh code.
- WHILE an alias reservation is busy, THE UI SHALL preserve the code and disable verification until the returned retry time.
- WHILE verification is throttled, THE UI SHALL show the remaining wait without extending it on repeated blocked checks.
- IF provider verification is temporarily unavailable, THEN THE UI SHALL say the code remains safe to retry and SHALL NOT request a replacement automatically.
- WHEN a resend succeeds, THE UI SHALL say earlier codes no longer work, clear the obsolete entry, focus the OTP field, and start the server-derived cooldown.
- IF a resend delivery fails, THEN THE UI SHALL say a fresh email could not be sent and SHALL NOT claim that either the old or new code remains usable.
- WHILE resend cooldown is active, THE UI SHALL disable resend and show the remaining time without announcing every second.
- WHEN resend becomes available, THE UI SHALL announce that change once with polite status semantics.
- WHILE verify is pending, THE UI SHALL disable resend; WHILE resend is pending, THE UI SHALL disable verification.
- WHEN sign-in reports an unverified email, THE UI SHALL offer a real POST fresh-code action that preserves email and safe next.
- WHEN a merchant corrects signup details, THE system SHALL preserve email, name, and safe next across signup and verification.
- WHEN a merchant moves between login and password reset, THE system SHALL preserve the known email and safe next destination.
- WHEN password-reset verification succeeds but password update fails, THE UI SHALL state that verification succeeded and require a fresh reset code.
- WHEN reset succeeds, THE system SHALL redirect to the sanitized requested destination instead of a hard-coded route.
- WHEN a merchant refreshes the reset verify stage, THE code, password, and confirmation fields SHALL remain available without revealing whether the email exists.
- WHEN confirmation-link verification fails, THE login recovery route SHALL retain the sanitized next destination.
- WHEN success feedback renders, THE system SHALL use polite status semantics; WHEN an error renders, THE system SHALL use assertive alert semantics.
- THE signup, verification, login, and reset routes SHALL remain responsive, keyboard operable, and free of serious or critical automated accessibility violations.
- THE OTP and reset forms SHALL preserve numeric/autocomplete ergonomics and the live password checklist already used by signup.

## 6. Verification Criteria and Task Breakdown

Verification criteria:

- Pure unit tests cover the complete outcome-to-focus/recovery contract,
  safe retry timestamp handling, purpose-scoped resend keys, cooldown and
  long-window behavior, blocked reset readback, and no secret-bearing fields.
- Source-contract tests prove the two OTP dispatchers validate their intents,
  signup resend no longer uses the signup bucket, login fresh-code is POST,
  reset resumes from GET safely, and all cross-route context uses shared URL
  builders plus redirect sanitization.
- Tagged Playwright tests at 375×812 and 1280×800 prove every exact OTP state,
  countdown and one-time announcement behavior, cross-form pending disabling,
  focus placement, polite versus assertive live regions, context round trips,
  the POST fresh-code path, reset resume, and password-checklist parity.
- A local-Supabase integration helper creates disposable signup and recovery
  provider tokens without sending email, inserts encrypted aliases through the
  service-role RPC, drives the real public forms, asserts session-backed
  continuation to the safe route, and removes the disposable users and rows.
- The auth routes pass the existing axe sweep and gain stable responsive
  screenshots without regressing the wider Wet Ink baseline.
- The full lint, type, build, Node, coverage, targeted browser, accessibility,
  and visual gates pass from a clean implementation commit.

Task breakdown:

1. Add the pure action-state and resend contract tests, source-contract test,
   tagged browser shells, local integration helper, and auth snapshot routes;
   confirm the current implementation fails for the intended reasons.
2. Introduce the dedicated closed OTP action state and exact alias/provider
   outcome mapping, including durable `retryAt` readback and secret-exclusion
   rules.
3. Add purpose-scoped resend enforcement and route signup, login fresh-code,
   and password-reset sends through it with non-enumerating house copy.
4. Add shared auth URL builders and preserve sanitized email/name/next context,
   including the reset verify resume seam and confirmation failure.
5. Refactor signup verification and reset around one dispatcher per flow, the
   resend countdown, controlled OTP clearing, exact focus, and live regions.
6. Reuse live password requirements on reset, add auth-route snapshots, and
   execute the live disposable-user session proof for signup and recovery.
7. Re-prove any earlier Micro-Spec whose implementation surface changed, then
   run `governance:run-gates --spec MS-auth-recovery-ux --record` and advance
   only from a clean implementation commit.
