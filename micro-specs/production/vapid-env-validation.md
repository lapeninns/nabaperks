---
spec_id: MS-production-vapid-env-validation
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/production/**
  - scripts/check-env.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - micro-specs/production/vapid-env-validation.md
  - scripts/check-env.mjs
related_tests:
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-vapid-env-validation — Reject malformed production Web Push keys

## 1. Exact Goal and User-Visible Outcomes

Production and hosted builds fail before deployment when Web Push VAPID keys or
their subject are malformed, so a configuration that cannot send push
notifications cannot pass the production environment gate.

## 2. Blast Radius

In scope: the production environment validator, its focused release-control
and provider-readiness contracts, and this lifecycle record. Out of scope:
rotating provider keys, changing Web Push delivery or subscription behavior,
UI changes, database changes, and accepting any detector-shaped credential
fixture.

## 3. Strict Constraints and Assumptions

- Validation runs only for hosted Vercel environments or the explicit
  production profile; local optional-provider behavior remains unchanged.
- VAPID keys use unpadded URL-safe Base64 and decode to the byte lengths
  required by the installed `web-push` provider: 32 private and 65 public.
- The VAPID subject is an HTTPS URL or `mailto:` URI accepted by the provider.
- Error output names the invalid environment variable but never prints its
  value.
- Tests generate ephemeral valid key material at runtime and commit no key.

## 4. Decisions Already Made

- Extend the existing environment gate rather than initializing `web-push` at
  build time or adding a second validation command.
- Reject partial hosted VAPID configuration: public key, private key, and
  subject must be present together whenever any one is configured.
- Preserve the production requirement that all three values are present.
- Keep provider-compatible validation deterministic and side-effect free.

## 5. Behavioral Requirements (EARS)

- **VE-1:** WHEN a hosted or production check receives malformed VAPID private
  key material, THE environment validator SHALL fail and name
  `WEB_PUSH_VAPID_PRIVATE_KEY` without echoing its value.
- **VE-2:** WHEN a hosted or production check receives malformed VAPID public
  key material, THE environment validator SHALL fail and name
  `WEB_PUSH_VAPID_PUBLIC_KEY` without echoing its value.
- **VE-3:** WHEN a hosted or production check receives a VAPID subject outside
  HTTPS or `mailto:`, THE environment validator SHALL fail and name
  `WEB_PUSH_VAPID_SUBJECT` without echoing its value.
- **VE-4:** IF only part of the VAPID trio is configured in a hosted check,
  THEN THE environment validator SHALL fail before deployment.
- **VE-5:** WHEN the VAPID trio is provider-compatible, THE production
  environment validator SHALL preserve a successful result.
- **VE-6:** WHILE local development does not configure Web Push, THE default
  environment validator SHALL remain successful.

## 6. Verification Criteria and Task Breakdown

1. Replace permissive short-key production and provider-readiness fixtures
   with ephemeral valid VAPID material, and add red cases for bad
   private/public encodings, byte lengths, subject schemes, and a partial
   hosted trio.
2. Add small side-effect-free VAPID shape and subject helpers to the existing
   hosted/production validation path, with variable-name-only errors.
3. Prove valid hosted and explicit production profiles still pass, while local
   optional-provider checks stay unchanged.
4. Run the focused test while converging, then record every declared gate with
   `governance:run-gates --spec MS-production-vapid-env-validation --record`
   and advance the lifecycle with `governance:advance`.
