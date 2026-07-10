---
spec_id: MS-merchant-auth
status: implemented
risk_class: auth-session
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-10
allowed_blast_radius:
  - app/(auth)/**
  - app/auth/confirm/**
  - lib/auth/**
  - micro-specs/merchant/**
implementation_surfaces:
  - app/(auth)/signup/page.tsx
  - app/(auth)/login/page.tsx
  - app/(auth)/actions.ts
  - app/auth/confirm/route.ts
  - lib/auth/merchant-email-otp-alias.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - app/(auth)/actions.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-merchant-auth — Password + one-time email-OTP signup / signin / reset

## Intent

A merchant signs up with an email and password and confirms with a one-time
6-digit email OTP, after which they land in onboarding; they sign in with their
password and can reset it via the same email-OTP path. The OTP is delivered as a
short alias that maps to the underlying Supabase token, is single-use, and
expires after an hour. Every entry point is rate-limited per email + request
identity.

## Scope (in)

- `/signup`, `/login`, `/auth/confirm`, and the password-reset path; the actions
  `signUpAction`, `signInAction`, `verifyEmailOtpAction`,
  `requestPasswordResetAction`, `confirmPasswordResetAction`.
- The 6-digit email-OTP alias (`lib/auth/merchant-email-otp-alias.ts` +
  `consume_merchant_email_otp_alias`).
- The auth rate-limit scopes.

## Scope (out)

- Customer phone OTP (owned by [MS-customer-join]); admin auth (owned by
  [MS-admin-console]); onboarding itself (owned by [MS-merchant-onboarding]).
  Real email delivery is out; the alias/token mechanics are the tested contract.
  No RLS change. The former Supabase Auth config exclusion is superseded only
  for password-policy alignment by [MS-auth-password-policy-accessibility].

## Decisions already made

- Passwords require 8+ characters containing letters and digits.
- The email OTP is a 6-digit alias stored in `merchant_email_otp_aliases` with a
  1-hour expiry, consumed once via `consume_merchant_email_otp_alias`; signup
  verification uses Supabase `verifyOtp({ type: "signup" })`, reset uses
  `type: "recovery"`.
- Rate limits per `${scope}:${email}:${requestIdentity}`, 15-minute window:
  `merchant-signup` = 3 attempts; `merchant-signin` / `merchant-verify` /
  `merchant-reset` = 5 attempts.
- `signInAction` redirects to `/app`; `verifyEmailOtpAction` redirects to
  `/app/onboarding`; `/auth/confirm` exchanges a `token_hash`/code for a session.

## EARS requirements

- **MA-1 (signup):** WHEN a merchant submits a valid email and a policy-compliant
  password, THE system SHALL create the auth user and issue a 6-digit email OTP.
- **MA-2 (password policy):** IF the password is shorter than 8 characters or
  lacks at least one letter or lacks at least one digit, THEN THE system SHALL
  reject the signup. [MS-auth-password-policy-accessibility] owns provider/app
  parity and accessible presentation of this rule.
- **MA-3 (verify):** WHEN the merchant submits the correct, unexpired OTP, THE
  system SHALL verify it, establish a session, and route to `/app/onboarding`.
- **MA-4 (single-use OTP):** THE email-OTP alias SHALL be consumable at most once
  and SHALL expire one hour after issue.
- **MA-5 (signin):** WHEN a merchant signs in with the correct password, THE
  system SHALL establish a session and route to `/app`.
- **MA-6 (rate limits):** THE system SHALL rate-limit each auth entry point per
  email + request identity over a 15-minute window (signup 3, signin/verify/reset
  5), and SHALL reject further attempts beyond the cap.
- **MA-7 (reset):** WHEN a merchant completes the email-OTP reset, THE system
  SHALL update the password (Supabase `type: "recovery"`) and route to `/app`.
- **MA-8 (confirm route):** WHEN `/auth/confirm` receives a valid token_hash/code,
  THE system SHALL exchange it for a session and redirect onward.

## Verification method

Pure action-path coverage: the email-OTP alias single-use/expiry (MA-4) and the
claim logic are unit-testable against `merchant_email_otp_aliases`. Rate-limit
caps (MA-6) and password policy (MA-2) are deterministic guards.
`tests/micro-specs/marketing-auth-legal.test.mjs` covers the public auth surface.
A future DB-free e2e can drive `/signup` → OTP (dev code) → `/app/onboarding`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
