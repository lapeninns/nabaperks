---
spec_id: MS-customer-home
status: implemented
risk_class: customer-pii
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/home/(authed)/**
  - app/home/actions.ts
  - components/customer/**
  - lib/customer/**
  - micro-specs/customer/**
implementation_surfaces:
  - app/home/(authed)/page.tsx
  - app/home/(authed)/rewards/page.tsx
  - app/home/(authed)/activity/page.tsx
  - app/home/(authed)/profile/page.tsx
  - app/home/(authed)/profile/actions.ts
  - components/customer/profile-marketing-consent.tsx
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/auth-wallet.md
  - micro-specs/admin/console.md
related_tests:
  - tests/micro-specs/customer-home-rewards.test.mjs
  - tests/micro-specs/customer-home-login.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-customer-home — Wallet: rewards, activity, profile, marketing consent, data request

## Intent

The signed-in customer's wallet at `/home`. They see their loyalty cards and
rewards (redeemable, upcoming, redeemed, expired), their activity history, and a
profile where they manage their details, per-channel marketing consent, and push
settings. Consent is explicit and opt-in. Erasure is NOT self-serve: the privacy
page directs the customer to contact the venue/operator, and an admin executes
the erasure (see [MS-admin-console]), which anonymises personal data while
retaining the loyalty ledger.

## Scope (in)

- `/home/(authed)/{rewards,activity,profile}` and `profile/actions.ts`.
- Marketing consent (`record_customer_marketing_consent` → `consent_records`,
  channels email/sms/whatsapp/push) and email-verification on profile.
- The privacy/data-request information surface (`app/privacy`) — prose that
  directs the customer to contact the operator. There is NO self-serve erasure
  action in the wallet.

## Scope (out)

- Wallet login / session (owned by [MS-customer-auth-wallet]); push delivery
  (owned by [MS-notifications]); the admin execution of erasure/export
  (`admin_erase_customer_pii`, owned by [MS-admin-console]). The stamp/redeem
  ledger is read-only here.

## Decisions already made

- Rewards group by status (`unlocked` → redeemable/upcoming, `redeemed`,
  `expired`) from `reward_events` scoped to the customer.
- Marketing consent is per-channel and explicit: each toggle posts immediately
  and appends a `consent_records` row with the policy version (`2026-06-06`);
  marketing is off until a channel is opted in.
- Erasure (`admin_erase_customer_pii`) masks the email to
  `erased+{uuid}@privacy.invalid`, nullifies contact + `auth_user_id`, and
  **retains** the loyalty ledger (stamps, rewards, events).
- Updating a new email starts an email verification before it is trusted.

## EARS requirements

- **CH-1 (rewards):** THE rewards page SHALL group the customer's own rewards into
  redeemable, upcoming, redeemed, and expired.
- **CH-2 (activity):** THE activity page SHALL show the customer's own stamp and
  reward history only.
- **CH-3 (profile + email verify):** WHEN the customer changes their email, THE
  system SHALL start an email verification before treating the new address as
  verified.
- **CH-4 (explicit consent):** THE system SHALL treat marketing as off until the
  customer opts a channel in; each consent change SHALL append a `consent_records`
  row with the channel and policy version.
- **CH-5 (erasure retains ledger):** WHEN a customer's data is erased, THE system
  SHALL anonymise their contact (email → `erased+{uuid}@privacy.invalid`, contact
  nullified) while retaining the loyalty ledger.
- **CH-6 (own data only):** Every wallet surface SHALL show only the signed-in
  customer's own data and contact.

## Verification method

`tests/micro-specs/customer-home-rewards.test.mjs` covers the rewards grouping
(CH-1, incl. expired visible); `customer-home-login.test.mjs` covers the
privacy-first lookup gate. **Live-DB (`pnpm test:db`):**
`tests/db/customer-consent.test.mjs` proves CH-4 (append-only, one audit row per
membership, zero-membership no-op); `tests/db/customer-erasure.test.mjs` proves
CH-5 (admin-gated anonymisation that retains the ledger);
`tests/db/customer-profile.test.mjs` proves CH-3's DB backstop (verified-contact
immutability) and the redemption profile gate. A DB-free e2e can assert the
per-channel consent toggles render and post.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
