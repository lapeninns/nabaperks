---
spec_id: MS-production-security-closure
status: active
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/production/**
  - app/auth/confirm/route.ts
  - scripts/provider-readiness/runtime.mjs
  - scripts/check-supabase-migrations.mjs
  - scripts/supabase-linked.mjs
  - scripts/supabase-local.mjs
  - tests/db/governance-db.test.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/unit/csp-theme-hash.test.mjs
  - tests/micro-specs/customer-join-auth-abuse.test.mjs
  - .github/workflows/ci.yml
  - .github/workflows/nightly.yml
  - playwright.config.ts
  - tests/e2e/auth-confirm-safety.spec.ts
  - tests/e2e/auth-hook-routes.desktop.spec.ts
  - tests/micro-specs/production-security-closure.test.mjs
  - package.json
  - pnpm-lock.yaml
implementation_surfaces:
  - app/auth/confirm/route.ts
  - scripts/provider-readiness/runtime.mjs
  - scripts/check-supabase-migrations.mjs
  - scripts/supabase-linked.mjs
  - scripts/supabase-local.mjs
  - tests/db/governance-db.test.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/unit/csp-theme-hash.test.mjs
  - tests/micro-specs/customer-join-auth-abuse.test.mjs
  - .github/workflows/ci.yml
  - .github/workflows/nightly.yml
  - playwright.config.ts
  - tests/e2e/auth-confirm-safety.spec.ts
  - tests/e2e/auth-hook-routes.desktop.spec.ts
  - tests/micro-specs/production-security-closure.test.mjs
  - package.json
  - pnpm-lock.yaml
related_tests:
  - tests/micro-specs/production-security-closure.test.mjs
  - tests/e2e/auth-confirm-safety.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --grep "@MS-production-security-closure"
  - pnpm governance:check
  - pnpm security:audit
  - manual:github-security-alerts
  - manual:production-otp-bypass-absent
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-security-closure — Production security alert and dependency closure

## 1. Exact Goal and User-Visible Outcomes

Production has no customer OTP bypass, no known vulnerable production
dependency, and no unresolved repository security alert. Merchant auth
callbacks continue to fail closed: only Supabase-verified authorization codes
or OTP token hashes can establish a session, and redirects remain same-origin.

## 2. Blast Radius

In scope: the auth callback proof, hostname validation used by provider and DB
verification tools, security-sensitive test assertions, non-secret CI/local
provider fixtures, the PostCSS resolution, GitHub CodeQL/secret-scanning alert
disposition, the Vercel production OTP-bypass setting, and this spec's focused
tests.

Out of scope: changing Supabase Auth semantics, rotating real provider secrets,
Stripe live-mode setup, schema changes, UI redesign, staging provisioning, and
production deployment.

## 3. Strict Constraints and Assumptions

- Never expose, log, or commit a real secret while replacing detector-shaped
  fixtures.
- Static-analysis alerts may be dismissed only after the exact path and data
  flow are inspected; a plausible vulnerability must be fixed and re-proved.
- The auth callback may redirect to success only after Supabase returns no
  verification error; user input is never itself the authorization decision.
- Hosted preview and production must contain neither customer OTP bypass
  variable. Local Playwright may keep a deterministic OTP.
- Provider tooling may read developer-selected env files, but hosted URLs must
  be classified by parsed hostname rather than substring matching.
- The PostCSS override must be at least 8.5.10 and must survive the full build.

## 4. Decisions Already Made

- Resolve the transitive PostCSS advisory with a pnpm override rather than an
  unrelated Next.js upgrade.
- Keep the existing Supabase verification calls; the CodeQL auth findings are
  validated against their fail-closed control flow before disposition.
- Remove detector-shaped fixture literals from scripts and workflows without
  moving test secrets into repository or provider secret stores.
- Treat provider-readiness outbound requests as an intentional local CLI trust
  boundary, not an application SSRF path, and record that evidence explicitly.
- Stripe remains deferred to the final production-readiness wave.

## 5. Behavioral Requirements (EARS)

- **SC-1:** WHEN an auth callback contains an unverified or absent credential,
  THE route SHALL redirect to login with a verification error and SHALL NOT
  establish a session.
- **SC-2:** IF an auth callback supplies an external `next` URL, THEN THE route
  SHALL replace it with the safe onboarding destination.
- **SC-3:** WHEN provider tooling classifies a Supabase host, THE classifier
  SHALL accept `supabase.com` and its subdomains and SHALL reject lookalike
  suffixes.
- **SC-4:** THE production dependency graph SHALL contain no package advisory
  reported by `pnpm audit --prod`.
- **SC-5:** THE repository SHALL contain no active GitHub code-scanning or
  secret-scanning alert after validated findings are fixed or documented as
  test/tooling false positives.
- **SC-6:** WHILE Vercel is building preview or production, THE environment
  SHALL contain neither `CUSTOMER_OTP_BYPASS_MODE` nor
  `CUSTOMER_DEV_OTP_CODE`.
- **SC-7:** CI and local harness fixtures SHALL remain deterministic without
  embedding strings that provider secret scanners classify as credentials.

## 6. Verification Criteria and Task Breakdown

1. Capture the red production audit, active GitHub alerts, detector-shaped test
   fixtures, lookalike Supabase-host classification, and production OTP-bypass
   setting.
2. Add focused source contracts and browser proof for same-origin auth callback
   failure behavior and parsed hostname classification.
3. Patch the transitive advisory, replace detector-shaped fixtures, and improve
   the security-sensitive test assertions without changing product behavior.
4. Remove the hosted production bypass and prove both Vercel hosted scopes are
   clean by environment-name readback.
5. Re-run CodeQL, validate each finding's source/sink/control flow, and close
   only alerts proved to be false positives or test/tooling fixtures.
6. Run and record all declared gates, attach the two manual readbacks, and
   advance the lifecycle.
