---
spec_id: MS-rewards-merchant-sent
status: implemented
risk_class: customer-pii
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-03
allowed_blast_radius:
  - supabase/migrations/20260704093000_issue_merchant_direct_reward.sql
  - lib/merchant/send-reward-fields.ts
  - lib/merchant/sent-rewards.ts
  - components/merchant/send-reward-dialog.tsx
  - components/merchant/send-reward-form.tsx
  - components/merchant/customer-readback-table.tsx
  - app/app/customers/send-reward/**
  - app/app/customers/page.tsx
  - app/dev/app-harness/send-reward/**
  - app/dev/app-harness/layout.tsx
  - app/dev/app-harness/customers/page.tsx
  - supabase/migrations/20260704095000_pending_reward_invites.sql
  - supabase/migrations/20260704096000_erase_reward_invites.sql
  - lib/customer/email-pii-core.ts
  - lib/customer/reward-invites.ts
  - lib/customer/identity.ts
  - lib/customer/profile.ts
  - lib/notifications/reward-invite-email.ts
  - app/m/[merchantSlug]/join/actions.ts
  - app/api/cron/privacy-retention/route.ts
  - app/claim/**
  - config/env-contract.json
  - micro-specs/rewards/**
  - tests/db/issued-rewards-direct.test.mjs
  - tests/db/issued-rewards-invites.test.mjs
  - tests/unit/send-reward-fields.test.mjs
  - tests/unit/email-pii.test.mjs
  - tests/unit/reward-invite-email.test.mjs
  - tests/micro-specs/issued-reward-merchant-sent.test.mjs
  - tests/micro-specs/issued-reward-invites.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/e2e/merchant-send-reward.spec.ts
  - tests/visual/**
implementation_surfaces:
  - supabase/migrations/20260704093000_issue_merchant_direct_reward.sql
  - lib/merchant/send-reward-fields.ts
  - lib/merchant/sent-rewards.ts
  - components/merchant/send-reward-form.tsx
  - components/merchant/customer-readback-table.tsx
  - app/app/customers/send-reward/page.tsx
  - app/app/customers/send-reward/actions.ts
related_docs:
  - micro-specs/rewards/issued-source-rails.md
  - micro-specs/rewards/customer-birthday.md
related_tests:
  - tests/db/issued-rewards-direct.test.mjs
  - tests/db/issued-rewards-invites.test.mjs
  - tests/unit/send-reward-fields.test.mjs
  - tests/unit/email-pii.test.mjs
  - tests/unit/reward-invite-email.test.mjs
  - tests/micro-specs/issued-reward-merchant-sent.test.mjs
  - tests/micro-specs/issued-reward-invites.test.mjs
  - tests/e2e/merchant-send-reward.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Live-DB proof that a direct reward respects tenancy, billing, and the daily caps, and that a non-owner cannot send.
  - Evidence that a recipient's raw contact is never echoed back to the merchant.
approved_exceptions: []
---

# MS-rewards-merchant-sent — Merchant-sent rewards (direct + invites)

## Intent

A merchant can **send** a reward to a person. For an existing member it attaches
immediately as a `merchant_direct` reward on the shared rails, redeeming like any
other reward with a merchant-chosen expiry. This spec ships the **direct** path
(member row action + a send page that matches an existing member by contact);
**pending invites** for people not yet on Nabaperks are completed by the Phase 4
extension of this spec.

## Scope (in) — Phase 3

- `issue_merchant_direct_reward(...)` — owner-gated, tenancy-checked, billing
  fail-closed, with SQL rate caps (1 per membership per UK day, 100 per merchant
  per UK day) serialised by an owner-row lock.
- A "Send reward" member-row action + dialog, and an `/app/customers/send-reward`
  page (contact entry that matches an existing member server-side).
- `sendMerchantRewardAction` with an app-level 50/day/merchant throttle and a
  uniform success response that never leaks whether the contact is a member.
- A merchant "sent rewards" readback (masked member + status).

## Scope (out)

- Pending invites / hashed-at-rest matching / claim links — Phase 4 of this spec.
- The redemption gates (owned by the rails spec). No 18+ gate at issue time
  (DOB is usually absent when a gift is sent; every redemption path enforces it).

## Decisions already made

- **D6** rate caps: SQL is the authority — 1 `merchant_direct`/membership/UK-day,
  100/merchant/UK-day; the app throttles the send action at 50/day/merchant to
  bound enumeration.
- Expiry is merchant-chosen 1–365 days (default 30), anchored at issue.
- The send response is **uniform** ("Reward sent. If they're new to Nabaperks,
  it'll be waiting when they join.") so a merchant cannot probe membership by
  typing a contact.
- The row id in the members table IS the membership id; the dialog posts only
  that id (no contact needed for a known member).

## EARS requirements

- **R-1 (direct issue):** WHEN an owner sends a reward to one of their members,
  THE system SHALL insert one `unlocked` `merchant_direct` reward
  (`redeemable_from = today`, `expires_at = now()+N days`, name/terms as given),
  record a `reward_sent` product event + a `direct_reward_issued` audit log, and
  enqueue `merchant_reward_received`.
- **R-2 (tenancy + owner):** IF the caller is not the merchant owner, or the
  membership does not belong to the merchant, THEN the send SHALL be rejected.
- **R-3 (billing fail-closed):** IF the merchant is not trial/active or billing
  is required-and-absent or cancelled/suspended, THEN the send SHALL be rejected.
- **R-4 (caps):** THE system SHALL reject a second `merchant_direct` reward to the
  same membership on the same UK day, and any send beyond 100 for the merchant on
  the same UK day.
- **R-5 (bounds):** THE reward name SHALL be 1–100 chars, terms 12–500, and expiry
  1–365 days; out-of-range input SHALL be rejected.
- **R-6 (uniform response):** THE send action SHALL return the same success
  message whether or not a typed contact matches a member, and SHALL NOT echo the
  raw contact back.
- **R-7 (sent list):** THE merchant SHALL see their sent `merchant_direct` rewards
  and pending invites with a masked identifier and status (invite pending+matched
  collapse to "Invited" so a contact's Nabaperks membership stays private).

### Phase 4 — pending invites

- **R-8 (invite create):** WHEN a send targets a contact that matches no member,
  THE system SHALL store a pending invite keyed ONLY by an HMAC of the contact
  (never raw), deduping an existing active invite for the same
  (merchant, contact).
- **R-9 (hashed matching + attach):** WHEN a person whose verified phone/email
  HMAC matches a live invite becomes a member of that merchant (via join, phone
  verify, email verify, or a claim link), THE system SHALL attach the invite as a
  `merchant_direct` reward and scrub the stored hashes.
- **R-10 (sticky match):** THE first verified match SHALL win; a later identity or
  a forwarded claim token SHALL NOT re-target an invite already matched to someone
  else.
- **R-11 (one-off email + suppression):** THE system SHALL send at most one
  merchant-attributed invite email per invite, with a reason line + unsubscribe
  link, honouring a permanent suppression list and a 3-per-30-day fatigue cap; a
  phone invite SHALL send no message and attach silently.
- **R-12 (retention + erasure):** Invites SHALL expire + scrub after 90 days,
  hard-delete 365 days after going terminal, and a customer erasure SHALL cancel +
  scrub that customer's live invites.

## Verification method

Live-Supabase tier: send to a member and assert the reward + product event +
audit + notification (R-1); a non-owner and a foreign membership are rejected
(R-2); the billing trio rejects (R-3); a same-day repeat and the 100/day ceiling
reject (R-4); bounds reject (R-5). Unit tier proves `send-reward-fields`
validation + the uniform response (R-5/R-6). DB-free harness + Playwright prove
the dialog/page render and the uniform copy with no raw contact echoed.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:coverage`
· `pnpm test:db` · `pnpm test:e2e`.

## Verification log — 2026-07-03

Red → Green throughout. Driven green:

- `pnpm test:db` — **70/70** (5 new direct-send invariants + all prior). Proves
  R-1 (reward + product event + audit + notification), R-2 (non-owner + foreign
  membership), R-3 (billing trio), R-4 (per-membership + 100/day caps), R-5
  (bounds).
- `pnpm test` — micro-specs 255 + unit 216 (R-5 validation + R-6 uniform copy +
  the wiring).
- `pnpm test:coverage` — `lib/**` 93.1 / 83.9 / 90.9.
- `pnpm test:e2e` — `merchant-send-reward` green on `mobile-safari` (form render
  + membership-prefill hides the contact field).
- `pnpm typecheck`, `pnpm governance:check`, `pnpm lint` (own files) green;
  production build via `next build --webpack`.

Implementation note: the member-row "dialog" ships as a prefilled link to
`/app/customers/send-reward?member=…` (the page hides the contact field when a
membership is prefilled) rather than a modal — same outcome, lower risk in the
695-line members table. The unmatched-contact branch returns the uniform success
and records nothing; **Phase 4 replaces it with a pending invite.**

Verdict: **IMPLEMENTED** (direct path). Pending invites complete this spec in
Phase 4.

## Verification log — Phase 4 (2026-07-03)

Pending invites landed on the shared core (the direct RPC now delegates to
`internal_issue_merchant_direct_reward`; the Phase 3 direct test still passes).

- `pnpm test:db` — **79/79** (9 new invite invariants: lifecycle
  pending→matched→attached with scrubbed hashes, sticky match / token
  no-retarget, dedupe, attach-without-membership + billing-blocked, idempotency,
  expiry-scrub + 365-day hard delete, cancel, RLS admin-only, erasure scrubs
  invites, and no raw contact in the audit). Proves R-8…R-12.
- `pnpm test` — micro 260 + unit 222 (email PII codec + invite email builder
  escaping/unsubscribe + the full invite wiring source contract).
- `pnpm test:coverage` — `lib/**` 93.3 / 84.1 / 91.3.
- `pnpm typecheck`, `pnpm governance:check`, `pnpm lint` (own files) green;
  production build via `next build --webpack` (incl. `/claim/[token]`).

Notes: the send action holds an unmatched contact as a hashed invite + one-off
email (suppression + 3/30-day fatigue cap); attach hooks fire at every creation
choke point (`getOrCreateCustomerByVerifiedPhone`, `markCustomerEmailVerified`,
`joinRewardsAction`) plus the `/claim/[token]` landing; `CUSTOMER_EMAIL_HMAC_SECRET`
is required in the env contract; retention runs in `privacy-retention`.

**⚠️ PECR/legal review is recommended before enabling invite emails in production
(D9).** The code implements the mitigations (single send, suppression list,
unsubscribe, merchant attribution, hashed-at-rest, 90-day expiry, 365-day delete)
but the launch decision is a legal one.

Deferred polish (not blocking): the `/home` "join to claim" invite prompt for a
matched non-member — organic attach via the join/verify hooks already delivers
the reward when they join; the prompt is a nudge, left for a follow-up.

Verdict: **IMPLEMENTED** — direct send + pending invites complete.
