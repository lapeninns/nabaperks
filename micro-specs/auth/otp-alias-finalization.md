---
spec_id: MS-auth-otp-alias-finalization
status: implemented
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-09
allowed_blast_radius:
  - micro-specs/auth/**
  - supabase/migrations/20260710093000_finalize_merchant_email_otp_aliases.sql
  - lib/auth/merchant-email-otp-alias.ts
  - lib/auth/merchant-email-otp-provider.ts
  - app/(auth)/actions.ts
  - app/api/auth/hooks/send-email/route.ts
  - tests/db/merchant-email-otp-alias.test.mjs
  - tests/micro-specs/auth-hooks.test.mjs
  - tests/unit/merchant-email-otp-provider.test.mjs
  - tests/e2e/merchant-signup-verify.spec.ts
  - tests/e2e/auth-hook-routes.desktop.spec.ts
implementation_surfaces:
  - supabase/migrations/20260710093000_finalize_merchant_email_otp_aliases.sql
  - lib/auth/merchant-email-otp-alias.ts
  - lib/auth/merchant-email-otp-provider.ts
  - app/(auth)/actions.ts
  - app/api/auth/hooks/send-email/route.ts
  - tests/db/merchant-email-otp-alias.test.mjs
  - tests/micro-specs/auth-hooks.test.mjs
  - tests/unit/merchant-email-otp-provider.test.mjs
  - tests/e2e/merchant-signup-verify.spec.ts
  - tests/e2e/auth-hook-routes.desktop.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/db/merchant-email-otp-alias.test.mjs
  - tests/micro-specs/auth-hooks.test.mjs
  - tests/unit/merchant-email-otp-alias-encryption.test.mjs
  - tests/unit/merchant-email-otp-provider.test.mjs
  - tests/e2e/merchant-signup-verify.spec.ts
  - tests/e2e/auth-hook-routes.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-auth-otp-alias-finalization"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Live local-Postgres proof that an alias stays unconsumed while reserved, finalizes once after provider success, and becomes reservable again after a transient release or expired lease.
  - Concurrent database proof that exactly one verifier receives the encrypted provider token for an alias lease.
  - ACL and FORCE RLS readback proving only service_role can call the alias lifecycle RPCs or access the backing tables.
  - Delivery-failure proof that an alias created for an email Supabase could not deliver is terminal and exposes no provider token.
approved_exceptions: []
---

# MS-auth-otp-alias-finalization — Finalize merchant OTP aliases only after provider verification

## 1. Exact Goal and User-Visible Outcomes

A merchant who enters a valid signup or password-reset email code does not lose
that code merely because Supabase verification is briefly unavailable. The
alias is leased to one verification attempt, consumed and scrubbed only after
the provider accepts it, and safely released after a transient provider
failure. Reusing, racing, or entering an expired or superseded code returns a
bounded machine-readable outcome so the following UX slice can give accurate
recovery guidance. A resend makes earlier codes terminal, and a failed email
delivery leaves no usable orphan alias.

## 2. Blast Radius

May edit the additive alias-lifecycle migration, the server-only alias module,
the signup and password-reset verification actions, the signed email hook, and
the focused DB, source, and browser tests listed in frontmatter.

Out of scope: the full resend countdown and recovery presentation, auth-page
layout, password policy, customer OTP, onboarding, billing, loyalty ledgers,
production Supabase configuration, hosted database writes, and analytics.
Those merchant-facing states remain a separate auth-session Micro-Spec after
this database contract is proven.

## 3. Strict Constraints and Assumptions

- The database stores only the already-encrypted Supabase token; encryption
  keys and plaintext provider tokens never enter SQL or action return values.
- Every lifecycle RPC is SECURITY DEFINER with an explicit search_path,
  revoked from PUBLIC, anon, and authenticated, and executable only by
  service_role.
- The alias and attempt tables retain enabled and forced RLS with no browser
  policy. Browser and session code cannot read lifecycle rows directly.
- Reservation is a short lease, not a long database transaction. Provider I/O
  happens after the reserve transaction commits.
- A reservation nonce must match for finalize or release, so a stale request
  cannot mutate a newer lease.
- Definitive provider rejection is terminal and scrubs the token. Retryable
  network, timeout, rate-limit, and server failures release the lease without
  consuming it.
- Existing consumed rows are marked legacy_consumed, never retroactively
  described as verified. Existing unconsumed rows remain usable during their
  one-hour compatibility window.
- Expired and terminal rows scrub provider tokens immediately. Their bounded
  metadata becomes eligible for deletion after one day and is deleted by the
  next alias lifecycle purge.
- The existing email-plus-request-identity action limiter remains the primary
  abuse guard. Any DB-global invalid-guess ceiling must not slide when already
  throttled and must return a stable retry timestamp.
- Successful Supabase verification establishes the session. A later cleanup
  miss must not turn a successful login into a false invalid-code response.

## 4. Decisions Already Made

- Add a purpose (signup, recovery, or legacy compatibility), reservation nonce,
  lease deadline, and terminal resolution to the existing alias row.
- Replace destructive consume with service-role-only create, reserve, finalize,
  release, and revoke RPCs. Keep no app call site on the legacy consume RPC.
- Reserve returns one of reserved, invalid, expired, used, superseded,
  rejected, busy, or throttled. Token and reservation ID are present only for
  reserved, and busy or throttled include retry_at.
- A new code atomically supersedes older unconsumed aliases for the same email
  and purpose. Signup and recovery aliases do not supersede each other.
- Failed Resend delivery revokes exactly the just-created alias as
  delivery_failed; it does not revoke an unrelated or newer code.
- Invalid guesses are not retained in plaintext. Already-throttled requests do
  not append attempts or extend the retry window.
- Signup and password-reset actions use the same lifecycle. Password update
  failure after successful recovery verification is not mislabeled as an OTP
  failure.

## 5. Behavioral Requirements (EARS)

- WHEN an encrypted alias is created, THE system SHALL atomically supersede older live aliases for the same normalized email and purpose.
- WHEN a valid active alias is reserved, THE system SHALL return its encrypted token and a random reservation ID without setting consumed_at or scrubbing the token.
- WHILE a reservation lease is live, THE system SHALL prevent a concurrent verifier from receiving the token and SHALL report when it may retry.
- WHEN Supabase accepts the provider token, THE system SHALL finalize the matching reservation once, set resolution to verified, and scrub the token.
- IF Supabase definitively rejects or expires the provider token, THEN THE system SHALL finalize a terminal rejected or expired outcome and scrub it.
- IF Supabase verification is transiently unavailable, THEN THE system SHALL release the matching reservation and preserve the alias for retry.
- IF a verifier crashes after reserve, THEN THE system SHALL make the alias reservable after the short lease expires.
- IF a stale reservation ID attempts to finalize or release a newer lease, THEN THE system SHALL make no change.
- WHEN an exact terminal alias is checked, THE system SHALL distinguish expired, verified-used, superseded, and rejected outcomes without returning a provider token.
- WHEN invalid guesses reach the database safety ceiling, THE system SHALL return a stable retry timestamp and SHALL NOT extend it on throttled checks.
- WHEN email delivery fails after alias creation, THE hook SHALL revoke that exact alias and SHALL NOT leave a usable token row.
- THE lifecycle RPCs and backing rows SHALL remain inaccessible to anon and authenticated roles.

## 6. Verification Criteria and Task Breakdown

Verification criteria:

- Live DB tests prove reserve, finalize, release, revoke, status
  classification, token scrubbing, lease expiry, stale-nonce safety, stable
  throttling, purpose-scoped supersession, migration replay, and RPC or table
  ACLs.
- A concurrent test proves only one of two reservations receives the token.
- Source contracts prove signup and recovery call reserve before provider I/O,
  finalize only after success, release on retryable failure, and revoke on
  failed delivery.
- Tagged mobile and desktop browser smoke proves the verify page and signed
  hook rejection paths remain functional while the server contract changes.
- The full node, DB, build, coverage, and scoped browser gates pass.

Task breakdown:

1. Scaffold the focused DB test and browser tags, activate the spec, and prove
   the current destructive consume path red.
2. Add the idempotent migration and make the lifecycle DB matrix green against
   local Supabase, including concurrent reserve and ACL readback.
3. Refactor the server-only alias module around discriminated lifecycle
   results while retaining AES-GCM and legacy-row compatibility.
4. Move signup and recovery actions to reserve, provider verify, then finalize
   or release, with provider success authoritative.
5. Make alias creation atomic per purpose and revoke the exact alias when
   Resend delivery fails.
6. Refactor, run the focused suites, replay the migration, then run
   `governance:run-gates --spec MS-auth-otp-alias-finalization --record` and
   advance only from a clean implementation commit.
