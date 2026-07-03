---
spec_id: MS-rewards-customer-birthday
status: implemented
risk_class: customer-pii
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-03
allowed_blast_radius:
  - supabase/migrations/20260704092000_issue_birthday_rewards.sql
  - lib/rewards/**
  - components/merchant/launch/birthday-panel.tsx
  - components/merchant/launch/birthday-reward-form.tsx
  - components/merchant/launch/rewards-panel.tsx
  - components/merchant/loyalty-card-form.tsx
  - app/app/card/actions.ts
  - lib/analytics/events.ts
  - lib/merchant/loyalty-card.ts
  - components/customer/home-birthday-prompt.tsx
  - app/home/(authed)/page.tsx
  - app/home/(authed)/profile/actions.ts
  - app/m/[merchantSlug]/join/actions.ts
  - lib/notifications/catalog.ts
  - app/api/cron/birthday-rewards/route.ts
  - vercel.json
  - app/dev/home-harness/**
  - app/dev/app-harness/launch/page.tsx
  - micro-specs/rewards/**
  - tests/db/issued-rewards-birthday.test.mjs
  - tests/db/loyalty-card-birthday-config.test.mjs
  - tests/unit/birthday-window.test.mjs
  - tests/micro-specs/issued-reward-birthday.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/e2e/customer-birthday-prompt.spec.ts
  - tests/e2e/merchant-birthday-config.spec.ts
  - tests/visual/**
implementation_surfaces:
  - supabase/migrations/20260704092000_issue_birthday_rewards.sql
  - lib/rewards/birthday.ts
  - lib/rewards/issue-birthday.ts
  - components/merchant/launch/birthday-panel.tsx
  - components/merchant/launch/birthday-reward-form.tsx
  - app/app/card/actions.ts
  - lib/analytics/events.ts
  - lib/merchant/loyalty-card.ts
  - components/customer/home-birthday-prompt.tsx
  - app/home/(authed)/page.tsx
  - app/api/cron/birthday-rewards/route.ts
related_docs:
  - micro-specs/rewards/issued-source-rails.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/db/issued-rewards-birthday.test.mjs
  - tests/db/loyalty-card-birthday-config.test.mjs
  - tests/unit/birthday-window.test.mjs
  - tests/micro-specs/issued-reward-birthday.test.mjs
  - tests/e2e/customer-birthday-prompt.spec.ts
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
  - Live-DB proof that birthday issuance is idempotent, respects every gate,
    and never re-arms the stale-PII purge clock for lapsed members.
  - Evidence that a customer's DOB is only ever used to gate/issue, never
    exposed to a merchant beyond the reward itself.
approved_exceptions: []
---

# MS-rewards-customer-birthday — Automatic birthday-month rewards

## Intent

A merchant can offer an automatic **birthday treat**: during a member's birthday
month, the system issues one `birthday_month` reward (on the shared rails from
[MS-rewards-issued-source-rails]) that redeems like any other reward and expires
at month end. Issuance is idempotent (one per merchant+customer+year), gated on
an active/billed programme and a **recent** member (so a yearly auto-issue never
re-arms the GDPR stale-PII purge clock), and merchant-configurable per card. A
member with no stored DOB is invited (prompt-only) to add one.

## Scope (in)

- `issue_birthday_rewards(p_now, p_customer_id)` — the set-based, idempotent
  issuance function + its daily cron.
- The card-level config (`birthday_reward_enabled/name/terms`, landed in the
  rails migration) surfaced via a merchant config panel + `saveBirthdayRewardAction`.
- A customer DOB prompt on `/home` (prompt-only; the join flow is untouched).
- Issuance hooks so a mid-month DOB-setter / new joiner is covered without
  waiting for the next cron tick.
- The `birthday_reward_issued` notification catalog entry (marketing).

## Scope (out)

- Merchant-direct send + invites ([MS-rewards-merchant-sent]).
- Any change to the redemption gates (owned by the rails spec).
- Capturing DOB in the join flow (prompt-only by product decision).

## Decisions already made

- **D1** issuance requires `last_visit_at` within 12 months — otherwise a yearly
  auto-issue re-arms `admin_purge_stale_customer_pii` forever and gifts
  permanently-lapsed members.
- **D2** `birthday_reward_issued` push = marketing (promotional gift); in-app
  visibility is the guarantee, push is best-effort on consent.
- **D3** uniqueness = one birthday reward per (merchant, customer, year) across
  ALL statuses; a cancelled/expired one does not free a re-issue.
- **D4** `redeemable_from = today` (no next-business-day floor); **D5** expiry =
  first instant of next London month (explicit, so the card-level expiry snapshot
  trigger stays inert).
- Issuance is a **separate daily cron** (`0 7 * * *`), not folded into the 15-min
  worker — ledger-write vs notification-delivery blast-radius separation;
  idempotent so a missed day self-heals, and the hooks cover mid-month changes.

## EARS requirements

- **R-1 (issue happy path):** WHEN `issue_birthday_rewards` runs and a member has
  a stored DOB in the current London month, an active birthday-enabled card, an
  active/billed merchant, and a visit within 12 months, THE system SHALL insert
  one `unlocked` `birthday_month` reward (name/terms from the card,
  `redeemable_from = today`, `expires_at =` first instant of next London month,
  `birthday_year =` the London year), enqueue `birthday_reward_issued`, and record
  a `reward_issued` product event.
- **R-2 (idempotent):** WHEN issuance runs twice, THE second run SHALL insert
  nothing (one reward per merchant+customer+year across all statuses); a
  cancelled/expired birthday reward SHALL NOT free a re-issue.
- **R-3 (gates):** IF the card is disabled, the merchant is not trial/active,
  billing is required-and-absent or cancelled/suspended, the DOB month does not
  match, the DOB is absent, the member is under 18, or the last visit is older
  than 12 months, THEN THE system SHALL issue nothing for that member.
- **R-4 (per-customer + sweep):** THE function SHALL issue for a single member
  when `p_customer_id` is given (the hook path) and for all eligible members when
  it is null (the cron sweep).
- **R-5 (config):** THE card owner SHALL enable/name/term the birthday reward via
  `saveBirthdayRewardAction`; a non-owner or enable-without-terms SHALL be
  rejected, and disabling SHALL retain the stored name/terms.
- **R-6 (DOB prompt):** WHILE a signed-in member has no stored DOB and at least
  one card, THE `/home` dashboard SHALL show a dismissible prompt linking to the
  profile form; it SHALL NOT block the dashboard and SHALL NOT appear once a DOB
  is stored.
- **R-7 (hooks):** WHEN a member saves a DOB or joins a card, THE system SHALL
  trigger birthday issuance for that member (best-effort, never breaking the host
  action).
- **R-8 (cron auth):** THE `/api/cron/birthday-rewards` route SHALL require the
  `CRON_SECRET` bearer and run the full sweep, returning `{ ok, issued }`.
- **R-9 (pure window math):** THE pure `lib/rewards/birthday.ts` SHALL compute
  London birthday-month membership and next-month expiry consistently across
  BST/GMT and month lengths (Feb/leap).

## Verification method

Live-Supabase tier: manufacture an eligible member and assert one birthday reward
+ notification (R-1); double-run inserts nothing and a cancelled reward does not
re-issue (R-2); each disqualifier (disabled/inactive/billing trio/wrong
month/null DOB/under-18/>12-month dormant) yields zero (R-3); the sweep issues
for all eligible + the per-customer path issues for one (R-4);
`save_loyalty_card_birthday_reward` owner-auth + validation (R-5). Unit tier
proves the window math month-agnostically (R-9). DB-free harness + Playwright
prove the DOB prompt (R-6) and config panel render.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:coverage`
· `pnpm test:db` · `pnpm test:e2e`.

## Verification log — 2026-07-03

Red → Green throughout (birthday DB tests failed on the absent function; the
source scans + window unit failed on missing modules). Driven green:

- `pnpm test:db` — **65/65** (11 new birthday invariants + all 54 prior). Proves
  R-1…R-4: shape + notification + product event, idempotency, the cancelled-does-
  not-re-issue rule, all eight disqualifiers, and the sweep.
- `pnpm test` — micro-specs 251 + unit 212 (R-5…R-9 source contracts + the pure
  London window math, month-agnostic).
- `pnpm test:coverage` — `lib/**` 93.0 / 84.1 / 90.8, above floor.
- `pnpm test:e2e` — `customer-birthday-prompt` (3) + `merchant-birthday-config`
  green on `mobile-safari` (R-5/R-6 render).
- `pnpm typecheck`, `pnpm governance:check`, `pnpm lint` (own files) green;
  production build verified via `next build --webpack`.

Verdict: **IMPLEMENTED**. Merchant-direct send + invites are the follow-up spec.
