---
spec_id: MS-auth-otp-alias-token-encryption
status: active
risk_class: auth-session
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/auth/**
  - lib/auth/merchant-email-otp-alias.ts
  - lib/security/**
  - config/env-contract.json
  - tests/unit/merchant-email-otp-alias-encryption.test.mjs
  - tests/micro-specs/auth-otp-alias-token-encryption.test.mjs
implementation_surfaces:
  - lib/auth/merchant-email-otp-alias.ts
  - lib/security/**
  - config/env-contract.json
  - tests/unit/merchant-email-otp-alias-encryption.test.mjs
  - tests/micro-specs/auth-otp-alias-token-encryption.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/e2e/auth-hook-routes.desktop.spec.ts
  - tests/micro-specs/auth-hooks.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --grep "@governance"
required_playwright_projects:
  - chromium
evidence_required:
  - Command output for the declared verification gates.
  - Unit test output covering encrypt/decrypt round-trip, auth-tag tamper rejection, and legacy plaintext fallback on consume.
  - Manual psql readback on a post-change database showing a freshly created alias row stores versioned ciphertext, not a plaintext token.
approved_exceptions: []
---

# MS-auth-otp-alias-token-encryption — Encrypt merchant email OTP alias tokens at rest

## 1. Exact Goal and User-Visible Outcomes

A database read (backup leak, compromised dashboard session, misused
service-role query) can no longer yield usable merchant login tokens. Today
`merchant_email_otp_aliases.supabase_token` stores the Supabase auth OTP token
in plaintext for its ≤60-minute lifetime; anyone who can read the table inside
that window can complete a merchant login. When this ships, the stored value
is AES-256-GCM ciphertext produced with a server-only key, decrypted only
inside the consume path. Merchants notice nothing: same codes, same expiry,
same rate limits, same login UX.

## 2. Blast Radius

May edit: `lib/auth/merchant-email-otp-alias.ts` (encrypt on create, decrypt
on consume), `lib/security/**` (shared AES-GCM helper — add one only if no
reusable primitive exists), `config/env-contract.json` (new server-only secret
entry), `tests/unit/merchant-email-otp-alias-encryption.test.mjs` (new),
`tests/micro-specs/auth-otp-alias-token-encryption.test.mjs` (new), and this
spec's folder.

Out of scope: the `merchant_email_otp_aliases` schema and its RPCs
(`consume_merchant_email_otp_alias` returns the stored text verbatim — no SQL
change needed or allowed here); OTP length, expiry, and rate-limit behavior;
customer phone encryption; `.env.example` (repo rule: env vars are documented
in `config/env-contract.json` only); any UI.

## 3. Strict Constraints and Assumptions

- Encryption happens at the app layer, not pgcrypto — keys must never reach
  the database (matches the `customers.phone_ciphertext` precedent).
- Key: a new server-only environment secret (32-byte, base64) declared in
  `config/env-contract.json` with `visibility` marking it server-side; local
  and CI setup notes belong in that contract entry's description.
- The stored format must be self-describing and versioned (e.g. a `v1:`
  prefix carrying IV + auth tag + ciphertext) so key rotation stays possible.
- Rollout compatibility: rows written before deploy hold plaintext and live at
  most 60 minutes. The consume path must handle both formats.
- Fail closed: alias creation with a missing/malformed key must error
  server-side without writing a plaintext token.
- The post-consume scrub (`supabase_token = ''`) and the attempt rate limiting
  added by migration 20260630124000 stay exactly as they are.

## 4. Decisions Already Made

- AES-256-GCM with a random IV per row; auth-tag verification failures are
  treated as invalid tokens (consume fails), never as plaintext passthrough.
- Legacy fallback rule: a stored value without the version prefix is treated
  as legacy plaintext and accepted during the compatibility window; the
  fallback branch is small, explicit, and may be removed in a later spec.
- No dual-write, no backfill: pre-deploy rows expire naturally within an hour.
- The Supabase token semantics (what the token is exchanged for) are
  unchanged; this spec only changes the at-rest representation.

## 5. Behavioral Requirements (EARS)

- WHEN a merchant OTP alias row is created, THE system SHALL store
  `supabase_token` as versioned AES-256-GCM ciphertext produced with the
  server-side key.
- WHEN an alias is consumed, THE system SHALL decrypt the stored value
  server-side and use the plaintext token only within the server login flow.
- IF the stored value lacks the version prefix, THEN THE consume path SHALL
  treat it as legacy plaintext and complete the login (compatibility window).
- IF decryption fails auth-tag verification, THEN THE system SHALL reject the
  consume attempt as an invalid token.
- IF the encryption key is absent or malformed at runtime, THEN THE system
  SHALL refuse to create alias rows and SHALL NOT write a plaintext token.
- THE merchant login experience (codes, expiry, rate limits, error copy)
  SHALL be behaviorally unchanged.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Round-trip: a token encrypted on create decrypts to the identical plaintext
  on consume.
- Tampering with ciphertext or auth tag makes consume fail.
- A legacy plaintext row (no version prefix) still consumes successfully.
- With the key unset, alias creation fails and no row is written.
- Existing auth-route e2e smoke stays green (login flow unchanged).
- Manual psql readback: freshly created row shows the versioned ciphertext.

Task order: (1) failing unit tests for the helper + create/consume paths;
(2) implement the AES-GCM helper (or reuse the existing primitive) and
integrate; (3) add the env-contract entry; (4) green; (5)
`pnpm governance:run-gates --spec MS-auth-otp-alias-token-encryption --record`
and advance with `governance:advance`.
