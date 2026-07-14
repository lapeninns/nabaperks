---
spec_id: MS-production-secret-rotation
status: implemented
risk_class: docs-tooling
owner: codex
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - scripts/check-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - scripts/check-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
related_tests:
  - tests/micro-specs/production-release-controls.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-secret-rotation — Accept secure generated production secrets

## 1. Exact Goal and User-Visible Outcomes

Operators can rotate Nabaperks production secrets with standard cryptographic
generators without the environment checker rejecting secure hex or base64url
values merely because they do not resemble human passwords.

## 2. Blast Radius

Only the production environment validator, its focused release-control tests,
and this Micro-Spec may change. Secret storage, provider credentials, runtime
authentication, and minimum secret lengths are out of scope.

## 3. Strict Constraints and Assumptions

- Protected secrets remain at least 32 characters, whitespace-free,
  non-placeholder, non-sequential, and non-periodic.
- The checker must continue rejecting low-diversity and detector-shaped test
  values.
- No real secret may enter source, test output, or evidence.

## 4. Decisions Already Made

- Cryptographic encodings are evaluated as machine-generated secrets, not as
  human passwords.
- Character-class quotas are not a reliable entropy estimator.
- Existing placeholder, repetition, sequence, and low-uniqueness controls stay.

## 5. Behavioral Requirements (EARS)

- **SR-1:** WHEN a protected secret is a unique 64-character hexadecimal value, THE production checker SHALL accept it.
- **SR-2:** WHEN a protected secret is a unique base64url value of at least 32 characters, THE production checker SHALL accept it.
- **SR-3:** IF a protected secret is short, whitespace-bearing, placeholder-shaped, sequential, periodic, or low-diversity, THEN THE production checker SHALL reject it.

## 6. Verification Criteria and Task Breakdown

1. Add failing production-check cases for secure hex and base64url secrets.
2. Replace password-style character-class enforcement with encoding-neutral
   structural checks while retaining the existing weak-secret rejections.
3. Run and record every declared gate, then advance to implemented.
