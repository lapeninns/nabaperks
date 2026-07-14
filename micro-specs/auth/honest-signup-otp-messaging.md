---
spec_id: MS-auth-honest-signup-otp-messaging
status: verified
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/auth/**
  - app/(auth)/actions.ts
  - app/(auth)/signup/verify/page.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
implementation_surfaces:
  - app/(auth)/actions.ts
  - app/(auth)/signup/verify/page.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
related_tests:
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --grep "enumeration-neutral resend presentation"
required_playwright_projects:
  - chromium
evidence_required:
  - Command output for the declared verification gates.
  - Focused Playwright evidence that a successful signup resend remains useful without claiming delivery or revealing whether an account exists.
approved_exceptions: []
---

# MS-auth-honest-signup-otp-messaging — Keep merchant signup OTP messaging honest and enumeration-safe

## 1. Exact Goal and User-Visible Outcomes

Merchant signup and resend screens give an honest, useful next step without
claiming that an email was delivered when Supabase returned an
enumeration-neutral success for an existing account. A merchant can still
enter a code, resend, log in, or recover a password without learning whether
an address is already registered.

## 2. Blast Radius

In scope: merchant signup/resend response copy in `app/(auth)/actions.ts`, the
existing verification guidance in `app/(auth)/signup/verify/page.tsx`, and the
focused recovery-flow assertions in
`tests/e2e/merchant-auth-recovery-flow.ts`.

Out of scope: Supabase hook configuration, OTP generation or verification,
rate limits, account-enumeration policy, login/reset behaviour, database
schema, customer authentication, Stripe, and visual redesign.

## 3. Strict Constraints and Assumptions

- Preserve Supabase's account-enumeration resistance; no response may confirm
  whether an email belongs to an existing merchant.
- Do not claim that a signup email or code was sent or delivered when the
  provider response cannot prove delivery.
- Keep server actions authoritative and preserve current resend cooldown,
  verification, focus, and recovery-link behaviour.
- Add no dependency, schema change, new browser state, or raw provider error.
- Preserve Wet Ink voice: short British copy, no emoji, and no exclamation
  marks.
- Assume Supabase may return a successful signup/resend response without
  invoking the email hook for an already-confirmed address.

## 4. Decisions Already Made

- The verification route and its login/password-reset links remain the single
  recovery surface after signup.
- Delivery language is conditional for signup resends because the provider's
  success response is not delivery proof.
- Password-reset copy stays enumeration-neutral and is not changed by this
  Micro-Spec.
- The focused existing Playwright recovery harness is the regression seam.

## 5. Behavioral Requirements (EARS)

- WHEN a signup resend receives a provider success, THE merchant auth flow
  SHALL return conditional copy that explains a fresh code may be on its way
  and offers login or password recovery without claiming delivery.
- WHEN an accepted signup opens the verification route, THE verification
  guidance SHALL describe the code as conditional until it actually arrives.
- IF the provider used an enumeration-neutral success for an existing account,
  THEN THE merchant auth flow SHALL NOT disclose that the account exists or
  state that a code was sent.
- WHILE the merchant is on signup verification, THE verification surface SHALL
  retain code entry, resend, login, and password-reset paths.

## 6. Verification Criteria and Task Breakdown

Verification criteria:

- Initial signup verification and provider-success resend feedback render
  conditional delivery language and never render the former unconditional
  `we sent` claim.
- The same rendered state still clears the stale code, starts the server
  cooldown, focuses the empty code field, and exposes account recovery links.
- The focused Playwright test fails against the former copy and passes with the
  corrected server-action response.
- Lint, types, build, node tests, coverage, governance, and the declared
  focused browser gate pass.

Task breakdown:

1. Change the focused Playwright assertion first and capture the expected red
   failure against the unconditional delivery claim.
2. Make the smallest server-action copy change that satisfies the requirements.
3. Run the focused recovery test, then advance the governed lifecycle with
   recorded evidence.
