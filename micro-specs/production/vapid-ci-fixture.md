---
spec_id: MS-production-vapid-ci-fixture
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-14
allowed_blast_radius:
  - micro-specs/production/**
  - .github/workflows/ci.yml
  - scripts/generate-ci-vapid-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - .github/workflows/ci.yml
  - scripts/generate-ci-vapid-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
related_tests:
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

# MS-production-vapid-ci-fixture — Generate valid CI VAPID fixtures

## 1. Exact Goal and User-Visible Outcomes

CI generates a valid ephemeral matching P-256 VAPID pair before the production
environment gate, so the strengthened validator protects releases without
making the protected build job permanently fail on obsolete fake fixtures.

## 2. Blast Radius

In scope: the CI build fixture step, a small non-secret fixture generator, its
source/behavior contract, and this lifecycle record. Out of scope: production
or preview credentials, runtime Web Push behavior, other CI jobs, UI, database,
and provider writes.

## 3. Strict Constraints and Assumptions

- Generate a fresh `prime256v1` pair at runtime; commit no fixed private key or
  detector-shaped credential.
- Left-pad a short private scalar export to exactly 32 bytes before Base64URL
  encoding, matching the production fixture contract.
- Append only the three VAPID names to `GITHUB_ENV`; do not print key material
  into action logs.
- Run the generator after checkout/setup and before
  `pnpm env:check:production`.
- Keep the generator deterministic in output shape and free of network or
  provider side effects.

## 4. Decisions Already Made

- Use a checked-in Node script instead of multiline workflow JavaScript so the
  generator can be executed and contract-tested locally.
- Remove the obsolete short VAPID values from the job-level environment.
- Keep the CI subject as a non-deliverable `mailto:ci@example.test` fixture.
- Add direct proof that left-padding a supplied 31-byte buffer preserves its
  bytes and yields exactly 32 bytes.

## 5. Behavioral Requirements (EARS)

- **VC-1:** WHEN the CI fixture generator runs, THE script SHALL emit exactly
  one matching canonical VAPID public key, private key, and valid subject.
- **VC-2:** WHEN a generated private scalar is shorter than 32 bytes, THE
  fixture path SHALL left-pad it to 32 bytes without changing its value.
- **VC-3:** WHEN the CI build job starts, THE workflow SHALL generate VAPID
  values before executing the production environment check.
- **VC-4:** THE CI workflow SHALL NOT retain the obsolete `ci-vapid-*` strings
  or a committed fixed VAPID private key.
- **VC-5:** WHEN the generated CI trio is passed to the production validator,
  THE validator SHALL succeed.

## 6. Verification Criteria and Task Breakdown

1. Add a red source contract proving the obsolete strings remain and no valid
   generator runs before the production check.
2. Add the ephemeral P-256 generator with explicit short-scalar padding and
   wire it into the CI build job before environment validation.
3. Execute the generator, parse its three names, and prove the production
   validator accepts them; directly exercise the 31-byte padding boundary.
4. Run the focused release-control suite, then advance the lifecycle with all
   declared gates recorded.
