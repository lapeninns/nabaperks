---
spec_id: MS-auth-cooldown-hydration
status: active
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/auth/cooldown-hydration.md
  - micro-specs/evidence/MS-auth-cooldown-hydration.json
  - components/auth/otp-resend-control.tsx
  - components/auth/signup-verify-form.tsx
  - components/auth/reset-password-form.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
implementation_surfaces:
  - micro-specs/auth/cooldown-hydration.md
  - micro-specs/evidence/MS-auth-cooldown-hydration.json
  - components/auth/otp-resend-control.tsx
  - components/auth/signup-verify-form.tsx
  - components/auth/reset-password-form.tsx
  - tests/e2e/merchant-auth-recovery-flow.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/auth/recovery-ux.md
related_tests:
  - tests/e2e/merchant-auth-recovery-flow.ts
  - tests/e2e/merchant-auth-recovery.spec.ts
  - tests/e2e/merchant-auth-recovery.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --grep "@MS-auth-cooldown-hydration"
required_playwright_projects:
  - chromium
evidence_required:
  - Command output for every declared verification gate.
  - Deterministic real-route proof that a client clock offset crossing a countdown boundary produces no hydration mismatch.
  - Browser proof that a persisted cooldown stays disabled through hydration, then shows the browser-clock countdown and enables once when elapsed.
  - Cleanup proof that the disposable local auth fixture and rate-limit bucket are removed after the browser scenario.
approved_exceptions: []
---

# MS-auth-cooldown-hydration — Hydration-stable OTP resend cooldowns

## 1. Exact Goal and User-Visible Outcomes

A merchant who refreshes signup or password-reset verification during an OTP
resend cooldown sees one stable disabled control. The server-rendered page and
the hydrating browser agree, the countdown then follows the browser clock, and
the control becomes available exactly once without React replacing the auth
subtree or emitting a hydration error.

## 2. Blast Radius

May edit only the shared OTP resend control, its two direct countdown-copy
callers, the existing real-route auth recovery browser flow, this Micro-Spec,
and its evidence ledger.

Out of scope: changing OTP delivery, aliases, rate-limit duration or identity,
server actions, sessions, password policy, database schema or RLS, provider
configuration, auth copy after hydration, or visual baselines.

## 3. Strict Constraints and Assumptions

- The server action and durable rate-limit bucket remain authoritative. Client
  timing is presentation only and must never permit an early resend.
- Server HTML and the browser's first hydration render must be deterministic;
  render-time `Date.now()` and `suppressHydrationWarning` are forbidden fixes.
- A valid persisted `retryAt` must keep the button disabled before the client
  clock is ready, even if the numeric countdown is temporarily withheld.
- After mount, the displayed seconds must use the current browser clock rather
  than replaying a stale server duration.
- The regression must drive the real `/signup/verify` server-readback path
  against disposable local Supabase and must inject a deterministic client
  clock offset that crosses a rounded-second boundary.
- Local proof must refuse hosted URLs, use one Playwright worker, and clean up
  its auth user, aliases, attempts, sessions, and rate-limit buckets.

## 4. Decisions Already Made

- Initialise the shared hook with a hydration-stable pending snapshot instead
  of calling `Date.now()` during render.
- While a valid retry timestamp exists but the browser clock is not ready,
  render the normal base label in a disabled cooldown state. Numeric seconds
  appear only after a post-mount clock sample.
- Continue to sample once per second while active and preserve the existing
  one-time elapsed announcement.
- Keep the fix in `OtpResendControl` so signup verification, reset
  verification, and client-action retry states share the same safety contract.
- Assert on React hydration diagnostics in the browser console; an eventual
  recovered DOM alone is not proof because React can regenerate the subtree.

## 5. Behavioral Requirements (EARS)

- **CH-1:** WHEN a verification page hydrates with a valid future `retryAt`,
  THE resend control SHALL produce identical server and first-client markup
  and SHALL emit no hydration mismatch.
- **CH-2:** WHILE the browser clock has not been sampled, THE resend control
  SHALL remain disabled and SHALL avoid presenting a fabricated second count.
- **CH-3:** WHEN hydration completes, THE resend control SHALL calculate the
  countdown from the current browser clock and SHALL update it once per second.
- **CH-4:** WHEN the cooldown elapses, THE resend control SHALL enable once and
  SHALL announce that another code can be requested.
- **CH-5:** IF the client clock differs from the server clock across a rounded
  second boundary, THEN THE page SHALL preserve the auth subtree instead of
  relying on React hydration recovery.
- **CH-6:** THE shared presentation fix SHALL NOT weaken the server-owned
  resend limit or change OTP, session, password, provider, or persistence
  behaviour.

## 6. Verification Criteria and Task Breakdown

1. Add a focused live browser regression that seeds a persisted cooldown,
   offsets browser `Date.now()` across a second boundary, captures console
   errors before navigation, and fails on React's hydration mismatch text.
2. Run the focused Chromium command and capture the exact red mismatch.
3. Make the shared hook's initial server/client snapshot deterministic while
   preserving a disabled safety state, then sample the browser clock after
   mount and guard numeric copy until it is ready.
4. Re-run the focused scenario and assert the hydrated countdown, elapsed
   announcement, single enablement, and exact local cleanup.
5. Run every declared gate sequentially, record the evidence ledger, advance
   only through `governance:advance`, and re-prove any implemented predecessor
   whose declared surface becomes stale.
