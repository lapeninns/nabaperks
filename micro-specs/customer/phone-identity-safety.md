---
spec_id: MS-customer-phone-identity-safety
status: implemented
risk_class: customer-pii
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/phone-identity-safety.md
  - micro-specs/evidence/MS-customer-phone-identity-safety.json
  - lib/customer/session-cookie-core.ts
  - lib/customer/pending-cookie-crypto.ts
  - lib/customer/session-cookie.ts
  - lib/customer/session.ts
  - tests/unit/customer-session-cookie-core.test.mjs
  - tests/unit/session-cookie-core.property.test.mjs
  - tests/micro-specs/customer-phone-identity-safety.test.mjs
  - tests/e2e/customer-phone-identity-safety/visual.spec.ts
implementation_surfaces:
  - lib/customer/session-cookie-core.ts
  - lib/customer/pending-cookie-crypto.ts
  - lib/customer/session-cookie.ts
  - lib/customer/session.ts
  - tests/unit/customer-session-cookie-core.test.mjs
  - tests/unit/session-cookie-core.property.test.mjs
  - tests/micro-specs/customer-phone-identity-safety.test.mjs
  - tests/e2e/customer-phone-identity-safety/visual.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
  - micro-specs/customer/auth-wallet.md
related_tests:
  - tests/unit/customer-session-cookie-core.test.mjs
  - tests/unit/session-cookie-core.property.test.mjs
  - tests/micro-specs/customer-phone-identity-safety.test.mjs
  - tests/e2e/customer-phone-identity-safety/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-customer-phone-identity-safety"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Property-based evidence that pending phone and email values are confidential, authenticated, expiring, and tamper-evident.
  - Browser cookie evidence showing Secure, HttpOnly, SameSite, path, expiry, and opaque value without exposing the phone through HTML, URL, or browser storage.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-phone-identity-safety — Confidential pending customer identity

## 1. Exact Goal and User-Visible Outcomes

Customers retain the same passwordless OTP experience, while the temporary phone and email verification cookies no longer expose their contact data through base64 decoding. Tampered, expired, wrong-key, or obsolete pending state fails safely back to requesting a new code without affecting the durable customer session contract.

## 2. Blast Radius

This spec owns pending customer-cookie encoding, its server adapter, and focused unit/property/browser proof. It does not change durable customer-session payloads or TTL, customer database encryption, OTP provider behavior, membership creation, retention policy, email-verification product behavior, or general cookie policy.

## 3. Strict Constraints and Assumptions

- Pending phone and pending email payloads use authenticated encryption with a fresh nonce per write and an explicit version/context.
- Encryption keys are derived with domain separation from the required server secret; no new browser-readable key or customer identifier is introduced.
- Durable customer session cookies remain signed version 2 and backed by `customer_sessions`; this spec does not migrate their format.
- Pending state remains HTTP-only, SameSite=Lax, Secure in production, path `/`, and expires after ten minutes.
- Invalid or legacy readable pending payloads fail closed. There is no production compatibility requirement for a ten-minute transient cookie.
- Error handling never logs decrypted phone/email values or cryptographic material.

## 4. Decisions Already Made

- Use the existing Node cryptography boundary and AES-256-GCM pattern already used for customer phone PII; add no dependency.
- Phone and email pending cookies use distinct derivation contexts so ciphertext cannot be replayed across purposes.
- Random IVs make equal pending values produce different cookie values.
- Expiry is checked only after successful authentication and parsing.

## 5. Behavioral Requirements (EARS)

- WHEN pending phone or email verification state is written, THE cookie value SHALL use authenticated encryption and SHALL not reveal the contact value or its base64 encoding.
- WHEN the correct secret and context read an unexpired pending value, THE system SHALL return the original typed payload.
- IF ciphertext, nonce, tag, version, purpose, or context is tampered, THEN THE system SHALL reject the pending state without throwing customer PII into logs or UI.
- IF the wrong secret or wrong pending-cookie context is used, THEN THE system SHALL reject the value.
- IF the pending-state expiry has passed, THEN THE system SHALL reject it.
- WHEN the same pending payload is written twice, THE resulting cookie values SHALL differ.
- THE durable customer session cookie format and server-side register/touch/revoke semantics SHALL remain unchanged.

## 6. Verification Criteria and Task Breakdown

1. Add failing example and property tests for opacity, nonce uniqueness, phone/email context separation, tamper, wrong key, malformed data, and expiry.
2. Implement versioned authenticated encryption in the pure cookie core and wire only pending phone/email adapters to it.
3. Prove existing durable customer-session tests remain unchanged and green.
4. Drive the phone-to-OTP browser transition, inspect cookie attributes/value, tamper and expire it, and prove the flow safely asks for a new code.
5. Run all declared gates, record privacy evidence without contact data, and advance.
