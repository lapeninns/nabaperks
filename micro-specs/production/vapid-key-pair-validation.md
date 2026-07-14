---
spec_id: MS-production-vapid-key-pair-validation
status: verified
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/production/**
  - scripts/check-env.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - scripts/check-env.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
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

# MS-production-vapid-key-pair-validation — Validate production VAPID key pairs

## 1. Exact Goal and User-Visible Outcomes

Hosted deployment validation rejects invalid P-256 VAPID key material and
public/private mismatches, so every accepted Web Push key pair can actually
produce signatures verifiable by its advertised public key.

## 2. Blast Radius

In scope: the existing hosted environment validator, its two VAPID fixture and
regression-test surfaces, the predecessor VAPID spec's attribution metadata,
and this lifecycle record. Out of scope: rotating hosted values, performing a
live push delivery, changing subscription/runtime delivery behavior, UI, and
database changes.

## 3. Strict Constraints and Assumptions

- Use Node's built-in `prime256v1` ECDH implementation as the validity oracle;
  add no dependency and perform no network or provider write.
- Validate the private scalar, public point, and derived-public-key equality
  only after canonical Base64URL and decoded-length checks succeed.
- Error output names the affected variables but never contains key values.
- Test key generation must left-pad short exported private scalars to 32 bytes,
  matching the installed `web-push` generator's deterministic contract.
- Keep validation limited to hosted environments and explicit production
  profiles; local optional-provider behavior remains unchanged.

## 4. Decisions Already Made

- Derive the expected public point from the supplied private scalar and compare
  bytes to the supplied public point.
- Treat invalid exact-length scalars/points and mismatched valid pairs as
  separate fail-closed regression cases.
- Keep static, value-opaque error messages and ephemeral test-generated keys.
- Correct the predecessor spec's implementation-surface attribution while the
  shared production specs are re-proved after this change.

## 5. Behavioral Requirements (EARS)

- **VP-1:** WHEN an exact-length private key is not a valid P-256 scalar, THE
  hosted environment validator SHALL fail without echoing the value.
- **VP-2:** WHEN an exact-length public key is not a valid P-256 point, THE
  hosted environment validator SHALL fail without echoing the value.
- **VP-3:** WHEN valid P-256 public and private keys belong to different pairs,
  THE hosted environment validator SHALL fail without echoing either value.
- **VP-4:** WHEN a matching P-256 key pair is supplied, THE production
  environment validator SHALL succeed.
- **VP-5:** WHEN test key generation exports a private scalar shorter than 32
  bytes, THE fixture SHALL left-pad it before Base64URL encoding.
- **VP-6:** WHILE the VAPID trio is absent in local development, THE default
  environment validator SHALL remain successful.

## 6. Verification Criteria and Task Breakdown

1. Add red hosted-profile cases for a zero private scalar, invalid exact-length
   public point, and two independently generated but mismatched valid pairs.
2. Parse both keys with Node P-256 ECDH, derive the public point from the
   private scalar, and require exact byte equality using value-opaque errors.
3. Left-pad generated private-key fixtures to exactly 32 bytes and prove the
   matching pair still passes.
4. Re-run both focused contract files, batch-refresh every predecessor spec
   whose implementation surface changed, then advance this spec with fresh
   declared gates.
