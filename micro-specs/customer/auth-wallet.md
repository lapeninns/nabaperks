---
spec_id: MS-customer-auth-wallet
status: implemented
risk_class: auth-session
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/home/login/**
  - app/home/session/**
  - app/home/actions.ts
  - lib/customer/**
  - micro-specs/customer/**
implementation_surfaces:
  - app/home/login/page.tsx
  - app/home/actions.ts
  - app/home/session/reset/route.ts
  - lib/customer/session.ts
  - lib/customer/returning-qr-redirect.ts
  - lib/customer/phone-pii.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
  - micro-specs/customer/home.md
related_tests:
  - tests/micro-specs/customer-home-login.test.mjs
  - tests/unit/safe-next-path.test.mjs
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

# MS-customer-auth-wallet — Phone-OTP wallet login, anti-enumeration, session reset

## Intent

A returning customer logs into their wallet with a phone OTP. The flow is
enumeration-safe — it always starts verification, whether or not the phone is
known, and only reveals "no cards found" after a successful code — so an
attacker cannot probe which numbers are registered. A valid login mints an
HMAC-signed session backed by a server-side row that can be revoked; a session
reset revokes it. Phone numbers are stored as an HMAC for lookup plus ciphertext,
never as searchable plaintext.

## Scope (in)

- `/home/login` (`requestCustomerLoginOtpAction`, `verifyCustomerLoginOtpAction`),
  `/home/session/reset`, and `signOutCustomerAction`.
- The customer session model (`lib/customer/session.ts`: register/touch/revoke,
  the signed cookie, `customer_sessions`) and the pending-phone cookie.
- The returning-QR redirect and phone-PII storage.

## Scope (out)

- First-time join + phone verification (owned by [MS-customer-join]); the wallet
  surfaces themselves (owned by [MS-customer-home]). No schema/RLS change.

## Decisions already made

- Login OTP is always started regardless of whether the phone is known
  (anti-enumeration); "no cards found" is only shown after a verified code with
  no matching customer. OTP is 4–8 digits; the dev code (`CUSTOMER_DEV_OTP_CODE`)
  applies in non-production.
- The session cookie `nabaperks_customer_session` is HMAC-SHA256 signed with
  `CUSTOMER_SESSION_SECRET`, httpOnly, 30-day, backed by `customer_sessions`
  (`register_customer_session` / `touch_customer_session` /
  `revoke_customer_session`). The pending-phone cookie expires after 10 minutes.
- Login OTP requests are rate-limited (5 per 15 minutes per IP + contact).
- Phone numbers are stored as `phone_hmac` (lookup) + `phone_ciphertext`
  (storage) + `phone_last4` (readback); they are normalised to E.164 first.

## EARS requirements

- **AW-1 (anti-enumeration):** WHEN a login OTP is requested, THE system SHALL
  start verification whether or not the phone is registered, and SHALL reveal
  "no cards found" only after a verified code with no matching customer.
- **AW-2 (login → session):** WHEN the correct OTP is submitted for a known
  verified phone, THE system SHALL establish a customer session and route to the
  wallet (or a safe `next` path).
- **AW-3 (session integrity):** THE session cookie SHALL be HMAC-signed,
  httpOnly, and backed by a `customer_sessions` row that can be revoked; a forged
  or unsigned cookie SHALL NOT authenticate.
- **AW-4 (session reset):** WHEN `/home/session/reset` is requested, THE system
  SHALL revoke the server-side session and clear the cookie, then route to login.
- **AW-5 (pending TTL):** THE pending-phone verification SHALL expire 10 minutes
  after issue.
- **AW-6 (rate limit):** THE system SHALL rate-limit login OTP requests to 5 per
  15 minutes per IP + contact.
- **AW-7 (returning QR):** WHEN a logged-in returning customer scans a venue QR,
  THE system SHALL route them to their existing membership's stamp/card/reward
  state, never the join wizard.
- **AW-8 (phone PII):** THE system SHALL store phone numbers as HMAC + ciphertext
  + last4, never as searchable plaintext.

## Verification method

`tests/micro-specs/customer-home-login.test.mjs` covers the enumeration-safe
lookup gate (AW-1). The safe-`next` redirect is unit-covered by
`tests/unit/safe-next-path.test.mjs` (AW-2). Session register/touch/revoke
(AW-3/AW-4) and the returning-QR routing (AW-7) are live-DB candidates against
`customer_sessions`; the signed-cookie + rate-limit guards are deterministic.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
