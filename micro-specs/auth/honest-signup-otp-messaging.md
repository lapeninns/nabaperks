---
spec_id: MS-auth-honest-signup-otp-messaging
status: closed
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/auth/**
  - app/(auth)/actions.ts
  - app/(auth)/signup/verify/page.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-signup-verify-mobile-safari-linux.png
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
implementation_surfaces:
  - app/(auth)/actions.ts
  - app/(auth)/signup/verify/page.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-signup-verify-mobile-safari-linux.png
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
related_tests:
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/visual.spec.ts
  - tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --grep "enumeration-neutral resend presentation"
  - pnpm test:visual -- --project=mobile-safari --grep "Given auth-signup-verify"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Focused Playwright evidence that a successful signup resend remains useful without claiming delivery or revealing whether an account exists.
approved_exceptions: []
---

# MS-auth-honest-signup-otp-messaging — Keep merchant signup OTP messaging honest and enumeration-safe

## Why It Exists

Supabase can accept a signup or resend request without proving that a message
was delivered, particularly when its response is intentionally neutral about
whether an account exists. Conditional delivery language keeps that privacy
boundary intact while still directing merchants to code entry, resend, login,
and password recovery.

## Invariants

- A provider-success response never confirms that an address is registered or
  that a signup code was sent or delivered.
- Initial verification guidance and resend feedback both describe delivery as
  conditional until the merchant receives a code.
- Code entry, login, and password recovery remain available after a successful
  resend response; resend remains visible and becomes actionable after the
  server-controlled cooldown, while the empty code field regains focus.
- Raw provider errors are never returned to merchants; existing server-side
  diagnostics remain intact, and this seam adds no browser-only authority, new
  persistence, or password-reset enumeration change.

## Code Pointers

- `app/(auth)/actions.ts` owns the enumeration-safe signup resend response.
- `app/(auth)/signup/verify/page.tsx` owns the initial conditional verification guidance.
- `tests/e2e/merchant-auth-recovery-flow.ts` exercises the rendered resend and recovery state.
- `tests/micro-specs/auth-honest-signup-otp-messaging.test.mjs` guards the server and page copy contract.
- `tests/e2e/visual.spec.ts-snapshots/auth-signup-verify-mobile-safari-linux.png` records the affected mobile verification baseline.

## Dead Ends

- Treating Supabase's neutral success as delivery proof was rejected because it
  produced a false user-facing claim and risked implying account existence.
- Correcting only the resend response was rejected because the initial
  verification guidance repeated the same unconditional delivery claim.
