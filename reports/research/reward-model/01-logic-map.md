# 01 — Logic map: how the current reward logic behaves in code

Read-only audit of `naba-perks` at commit `e73a2db2` (main), 2026-09-19. Nothing was modified.

**Method.** The database is defined by 206 migrations in `supabase/migrations/`. Functions are redefined many times, so every citation below is to the **last** `create or replace` in filename order, after checking for later `drop function`. The linked production project has `20260911120000_venue_code_direct_entry` as its newest applied migration, i.e. the repo head and production schema match. Paths are relative to the repo root; `mig/` abbreviates `supabase/migrations/`.

**Verified vs inferred.** Everything marked (V) was read directly from the cited file, or, for the business-date functions, read back from production with `pg_get_functiondef`. Items marked (I) are inferred from code structure or from agent reports I spot-checked rather than re-read line by line. Untested claims about runtime behaviour (e.g. "admin cancel strands the card") are reasoning from the SQL, not reproduced.

---

## 0. Ten-question summary

| #   | Question                                 | Short answer                                                                                                                                                                                                                                                                                                                                                                                                                | Enforced                                       | Configurable                                                                                         |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Qualifying purchase / staff verification | **No purchase concept.** A stamp = one self-service _visit_: customer scans the venue's static join QR and passes a location check (GPS geofence, or the daily 6-digit venue code). Staff never verify a stamp; the staff subsystem was deleted. No minimum spend.                                                                                                                                                          | DB (`private.issue_visit_stamp`)               | Geofence radius, first-verified-visit number, require_geofence per venue. Everything else hardcoded. |
| 2   | Earn limits and "day"                    | **1 earned stamp per membership per location per Europe/London calendar day** (unique index + check). Day = `(now() at time zone 'Europe/London')::date`, midnight London, not UTC, not a trading day. Venue code rolls at **05:00 London** (different boundary). Referral/invite/offer stamps bypass the daily rule.                                                                                                       | DB                                             | Hardcoded                                                                                            |
| 3   | Card fills                               | Stamp + reward insert are **one transaction**. **No next card is opened**: the card stays full ("locked") and every further stamp attempt fails with NBS02 until the reward is redeemed _or expires_. Idempotency: retry after commit returns NBS01 (not success); no unique constraint on one reward per cycle, safety relies on `FOR UPDATE`.                                                                             | DB                                             | Hardcoded                                                                                            |
| 4   | Redemption delay                         | `redeemable_from = next_uk_business_date(now())`: London date + 1, skipping Sat/Sun only. **No bank holidays.** Stored as a date; "ready" is **computed at request time** by comparing to today's London date. Eligibility is re-checked in the DB at token mint, at scan display, and at collect.                                                                                                                          | DB (+ server)                                  | Hardcoded                                                                                            |
| 5   | Expiry                                   | `expires_at = created_at + reward_expires_after_days` (card setting, default 30, UI picklist 14/30/60/90/180), snapshotted at insert, not retroactive. Swept every 15 min; expiry **releases the card** and opens the next cycle. Displayed server-side from the stored value. **No handling of closures, bank holidays or opening hours anywhere.**                                                                        | DB                                             | Per venue (days)                                                                                     |
| 6   | Two simultaneous scans                   | Cannot double-redeem: lock order customer → reward → token with `FOR UPDATE`, then `update … where status='unlocked'` + `if not found raise`, plus one-live-token partial unique index and advisory lock. Only one real race test exists (ID-check path).                                                                                                                                                                   | DB                                             | —                                                                                                    |
| 7   | Pool edits / settings / billing lapse    | Issued rewards carry a **snapshot** of name/terms; pool edits, deactivation and archive do not touch them. Lowering `stamps_required` auto-mints rewards; raising does nothing. Billing lapse **blocks earning and redemption of already-issued rewards** with no grace, while expiry keeps running. QR pause blocks earning only. **`admin_cancel_reward` on a cycle reward strands the card permanently** (probable bug). | DB                                             | Expiry days and pool per venue; rest hardcoded                                                       |
| 8   | Source vs policy                         | Tangled. `reward_events.source` has 3 values; each producer hardcodes its own delay/expiry. **No policy version or settings snapshot** on cards, cycles or rewards. Loyalty _terms_ are snapshotted at join for evidence only and never read.                                                                                                                                                                               | —                                              | —                                                                                                    |
| 9   | Notifications and consent                | Only customer channel is **web push** (6 subscriptions in production). Transactional/reminder pushes need only default-on preferences; marketing pushes need `marketing_enabled` + a per-venue push `opted_in` consent row. Marketing consent is stored separately from phone/email verification, append-only, per venue. Join form: terms required, marketing optional and **not pre-ticked**.                             | Server (delivery worker) + DB (consent writes) | Per customer                                                                                         |
| 10  | DOB and age gate                         | DOB is collected in the profile (not at join), stored **plaintext**. **18+ applies to every reward** (no alcohol flag exists): showing the reward QR needs a self-asserted adult DOB; collecting needs a DOB **verified** by the venue owner (photo ID) or an admin. Birthday reward: whole London calendar month, 18+, verified DOB, once per year.                                                                        | DB triggers + server                           | Birthday reward per venue; age gate hardcoded                                                        |

---

## 1. What makes a purchase "qualifying"; how a stamp is verified (V)

There is no purchase, transaction, basket or receipt-of-sale concept in any live stamp path. Minimum spend was removed by `mig/20260624120000_remove_minimum_spend.sql:1-2` and the columns dropped in `mig/20260707091000_dead_field_cleanup.sql` (test `tests/db/dead-field-cleanup.test.mjs:58,100`). Product copy says "ONE STAMP PER BUSINESS DAY" (`components/customer/customer-flow-system.tsx:196`).

**Live earn paths** (all SECURITY DEFINER RPCs; the only writer of `stamp_events` is the private primitive):

| Path                                                              | Current definition                                                                                     | Called from                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `private.issue_visit_stamp` — the single stamp transaction        | `mig/20260907100100_visit_stamp_private_primitives.sql:162-715`                                        | wrappers below only                                                     |
| `public.issue_self_service_stamp` (7-arg: rate limit + ownership) | same file `:729-791`                                                                                   | `private.issue_qr_visit_stamp`                                          |
| `private.issue_qr_visit_stamp` (QR proof + referral settle)       | same file `:807-941`                                                                                   | 9-arg wrapper `:952-985`, venue-code RPC                                |
| `public.issue_venue_code_stamp`                                   | `mig/20260911120000_venue_code_direct_entry.sql:74-335`                                                | `lib/customer/stamp.ts:190`                                             |
| `join_customer_membership_with_first_stamp` (join gives stamp 1)  | `mig/20260713100000_customer_join_ledger_recovery.sql:61-229`                                          | `app/m/[merchantSlug]/join/actions.ts:630`                              |
| `retry_customer_join_first_stamp`                                 | same file `:231+`                                                                                      | `lib/customer/join-first-stamp-recovery.ts:51`                          |
| Referral bonus stamp: `settle_referral_bonus`                     | `mig/20260805100300:58-99` wrapping body in `mig/20260712100000_referral_review_hardening.sql:570-855` | stamp path `:919`, cron `app/api/cron/referral-bonus-drain/route.ts:29` |
| Loyalty invite (+2 stamps): `claim_loyalty_invite`                | `mig/20260722100500:15-252`                                                                            | join action `:396`                                                      |
| Offer campaign bonus stamps: `claim_offer_campaign`               | `mig/20260804120000:270-566`                                                                           | join action `:474`                                                      |
| `admin_adjust_membership_stamps`                                  | `mig/20260606142000_initial_schema_rls.sql:1972-2075`                                                  | `app/admin/actions.ts:59`                                               |

Not live: `issue_stamp_with_staff_pin` and `redeem_reward_with_staff_pin` were dropped (`mig/20260613100000:41-42`, `mig/20260613130000:1-2`); `staff_users` and the staff policies were removed by `mig/20260707092000_staff_subsystem_excision.sql:108-114` (test `tests/db/staff-excision.test.mjs:43,63,110`). `redeem_offer_pass` does **not** issue stamps (`mig/20260803100300:338-525`).

**Verification is presence, not staff.** Two proofs, both in the DB:

1. **Venue QR proof (NBS08).** `private.issue_qr_visit_stamp` `mig/20260907100100:835-868` requires the scanned `qr_id` to be an active `qr_codes` row with `destination_type='join'` for the card. The QR is static per venue; the migration header admits it is weak proof (`mig/20260911120000:5-6`).
2. **Location.** Graduated geofence in `private.issue_visit_stamp` `:373-496`:
   - Visit number = lifetime count of this membership's `earned` rows with `metadata->>'source'='self_service_qr'` + 1 (`:373-380`). Referral/invite/offer stamps are not visits.
   - Checked only when `merchant_locations.require_geofence` (default true since `mig/20260805100100:102`) **and** visit number ≥ `geofence_first_verified_visit(soft_geofence_trigger_stamp_number)` = `greatest(coalesce(cfg,3),1)` (`mig/20260805100100:63-72`). So visits 1–2 are exempt by default. Per venue: `soft_geofence_trigger_stamp_number` (1..99, default 3, `mig/20260707093000:18-32`), `require_geofence`, `geofence_radius_meters` (default 150, `mig/20260613100000:14`).
   - Effective radius = radius + `least(accuracy,100)` + 10 m (`:437-439`). Accuracy > 100 m → `poor_accuracy` (unverified, allowed). Out of range → **NBS10** (`:455-469`).
   - Unverified stamps are allowed while lifetime unverified count < `geofence_unverified_grace_limit()` = **2** (`mig/20260910100000:8-15`; was 3), else **NBS11** (`:480-495`). Hardcoded.
   - After NBS10/11 the server calls `record_stamp_location_refusal` in a new transaction (`lib/customer/stamp.ts:327-350`; RPC `mig/20260902123000:49-151`) which upserts one `fraud_flags` row per membership/signal/15 min.

**Venue code** (the fallback when location fails or is unavailable):

- Derivation `private.venue_code_for` `mig/20260907100000_venue_code_stamp_schema.sql:71-120`: HMAC-SHA256(per-merchant secret seed, `merchant_id:day`), first 48 bits mod 1,000,000, six digits.
- Day boundary `private.venue_code_day` `:54-63`: `((now() at time zone 'Europe/London') - interval '5 hours')::date` → **rolls at 05:00 London**. The stamp-day limit uses midnight (Q2), so the two boundaries disagree by design (tested `tests/db/visit-stamp-private-primitives.test.mjs:379`).
- `issue_venue_code_stamp` accepts today's code or the code valid 10 minutes ago (`mig/20260911120000:150-154`). Wrong code → lockout after 5 failures in 15 min (`:157-190`), plus rate buckets 10/device 20/merchant 100/network 30 per 15 min (`mig/20260908100000:145-204`). Since `20260911120000` no prior location refusal is required.
- The code bypasses only the location block. The receipt row must be created in the same transaction (`transaction_id = pg_current_xact_id()`, `mig/20260907100100:235-250`). Daily limit, full-card refusal, billing and QR proof still apply.

**Client-only logic:** `decideCaptureSubmission` (`lib/customer/stamp-location-capture.ts:152-169`) and `stampLocationIssue` (`lib/customer/stamp-location-recovery.ts:8-37`) gate _submission_ for UX; both are re-enforced in the DB. The 6-digit format check exists in both `app/card/[membershipId]/actions.ts:137-141` and the RPC. Nothing load-bearing is client-only.

**Tests:** geofence `tests/db/loyalty-integrity-hardening.test.mjs:170,205,241,271,318,350,389`, `tests/db/customer-stamp-edges.test.mjs:151,238`, `tests/db/soft-geofence-knob.test.mjs`; venue code `tests/db/venue-code-derivation.test.mjs`, `tests/db/venue-code-stamp.test.mjs:129-469`, `tests/db/visit-stamp-private-primitives.test.mjs`. **Not tested:** the 10-minute previous-code window; `purge_stale_venue_code_lockouts`; the device/merchant/network buckets; the 15-minute refusal dedupe.

## 2. Earn limits and what a "day" is (V)

**Rule:** one `earned` stamp per membership per location per UK business day.

- Check in `private.issue_visit_stamp` `mig/20260907100100:316-326` → `NBS01 'Stamp already issued for this UK business day'`.
- Backstop unique index `stamp_events_one_earned_per_business_day_idx (membership_id, location_id, earned_business_date) where event_type='earned' and earned_business_date is not null` (`mig/20260606190000:120-122`); `unique_violation` re-raised as NBS01 (`:532-536`).
- Full-card refusal NBS02 (`:306-314`) counts earned rows in the active cycle against `stamps_required`.

**Day:** `public.uk_business_date(p) = (p at time zone 'Europe/London')::date` (`mig/20260606190000:1-8`; read back from production, identical). Midnight Europe/London. `merchant_locations.timezone` was dropped (`mig/20260707091000:315`), so nothing per venue. The daily rule is deliberately not cycle-scoped: a card completed and redeemed mid-day cannot earn again that day (`mig/20260615130000:16-17`).

**Bypasses:** referral bonus, loyalty-invite and offer-campaign stamps insert with `earned_business_date = null`, so the unique index and NBS01 do not apply to them. Referral bonuses have their own cap of 2 per referrer per London day (`mig/20260712100000:587,672-698`, hold reason `daily_bonus_limit`).

**Rate limits (not earn limits):** 10 attempts / 15 min per membership in several buckets; velocity fraud flag at ≥3 stamps in 15 min (`:682-711`).

**Refusal codes** (`private.visit_stamp_refusal_code` `mig/20260907100100:43-147` and the primitive; mapped in `lib/customer/experience/block-reasons.ts:32-46`):

| Code          | Meaning                                                                                          | Where                                                      |
| ------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| NBS01         | already stamped today at this location                                                           | `:316-326`, `:532-536`                                     |
| NBS02         | card full, reward unredeemed                                                                     | `:306-314`                                                 |
| NBS03         | completing stamp but < 3 active pool items / zero weight                                         | `:328-343`, `:597-600`                                     |
| NBS04/05/06   | merchant not trial/active; billing row missing; billing cancelled/suspended                      | `:252-270`                                                 |
| NBS07         | no active card                                                                                   | `:292-295`                                                 |
| NBS08         | invalid venue QR proof                                                                           | `:835-868`                                                 |
| NBS10 / NBS11 | out of range / unverified grace spent                                                            | `:455-469`, `:491-494`                                     |
| NBC01 / NBC02 | venue-code lockout / not 6 digits                                                                | `mig/20260908100000:182-185`, `mig/20260911120000:118-121` |
| trigger       | `enforce_stamp_billing_entitlement` BEFORE INSERT on `stamp_events` when `event_type='earned'`   | `mig/20260713190000:1-34`                                  |
| NBS14         | legacy "code without recent refusal": no longer raised but still mapped in `block-reasons.ts:44` | —                                                          |

**Tests:** `tests/db/customer-card-stamp.test.mjs:44`, `tests/db/visit-stamp-private-primitives.test.mjs:290,384`, `tests/db/card-stamp-display-dates.test.mjs:14`, referral cap `tests/db/referral-settlement.test.mjs:255`. **Not tested:** the midnight-London boundary itself or a BST/GMT transition; per-location vs per-membership scope.

## 3. What happens when a card fills (V)

Inside `private.issue_visit_stamp`, one transaction: membership row locked `FOR UPDATE` (`mig/20260907100100:212-223`); stamp inserted (`:498-531`); `current_stamp_count`, `total_stamps_earned`, `last_visit_at` updated (`:544-550`); if `new_stamp_count >= stamps_required` a pool item is chosen and a `reward_events` row inserted with `status='unlocked'`, `redeemable_from = next_uk_business_date(now())`, `cycle_number = active_cycle_number`, `metadata.selection_mode` (`:602-625`). Any raise rolls the whole thing back.

**Selection** (`:554-589`): cycle 1 → first active item by `display_order` (`mig/20260616101500_first_cycle_default_reward.sql`: "the default advertised reward, not a surprise"); later cycles → weighted random over active items. The customer never chooses. Name and terms are **snapshotted** onto the reward row (`reward_name`, `reward_terms` NOT NULL, `mig/20260606190000:59-60,105-107`).

**The card is locked, not reopened.** No new cycle is opened at completion. `active_cycle_number` advances only in:

- `private.redeem_self_service_reward_transition` `mig/20260905142000_owner_verified_reward_collection.sql:216-224`: `current_stamp_count = greatest(current_stamp_count - stamps_required, 0)`, `total_rewards_redeemed + 1`, `active_cycle_number + 1` (stamp-cycle rewards only).
- `expire_due_reward_events` `mig/20260805100200_reward_expiry_releases_the_cycle.sql:185-194`: same arithmetic with `total_rewards_expired + 1` (added 2026-08-05; before that an expired reward locked the card forever).
  Until then every stamp attempt, QR or venue code, returns NBS02. Invariant: `active_cycle_number = total_rewards_redeemed + total_rewards_expired + 1` (test `tests/db/membership-counter-ledger-reconciliation.test.mjs:94,167`).

**Healing.** `mint_cycle_reward_if_missing` (`mig/20260805100100:122-282`) is _not_ called from the stamp path (comment `mig/20260907100100:307-311`). It runs only from `release_completed_cycles_without_reward` (`mig/20260902132000_fair_reward_cycle_healing.sql:21-151`: tenant round-robin, `for update skip locked`, NBS15 failure ledger with 15-min cooldown), which `expire_due_reward_events` calls first (`mig/20260805100200:156`), on the 15-minute notifications cron (`lib/notifications/notification-producers.ts:29-32` → `app/api/cron/notifications/route.ts:21-28`, `vercel.json`).

**Idempotency / retry.**

- Stamp: unique index + row lock. A retried request after a successful commit gets **NBS01**, rendered as "already stamped today", not as success. Exception: the join RPC treats already-issued as `first_stamp_issued=true` (`mig/20260713100000:141-153`).
- Reward: **no unique constraint** on one `stamp_cycle` reward per (membership, cycle); only the birthday index exists (`mig/20260704090000:39`). Safety rests on the `FOR UPDATE` in the stamp primitive and in `mint_cycle_reward_if_missing`. `reconcile_loyalty_card_threshold_rewards` (`mig/20260630127000:52-67`) mints with a bare `not exists` and no membership lock (I: not reproduced).
- `admin_adjust_membership_stamps` writes `manual_adjustment` rows without `cycle_number`; those are invisible to the NBS02 count (acknowledged in `mig/20260805100200:25-26`) and never mint.

**Tests:** `tests/db/customer-stamp-edges.test.mjs:84` (full card refuses), `:117` (asserts that lowering `stamps_required` mid-cycle bricks the card until the sweep — current behaviour, not a guard), `:201` (NBS03); `tests/db/loyalty-integrity-hardening.test.mjs:474-786` (expiry releases, heal, tenant fairness); `tests/db/customer-lifecycle.test.mjs`. **Not tested:** two concurrent stamps on one membership; retry-after-commit semantics; `admin_adjust_membership_stamps` vs the gate.

## 4. Redemption delay and eligibility (V)

```sql
-- mig/20260606190000_mystery_visit_rewards.sql:10-25 (identical in production)
v_date := (p_at at time zone 'Europe/London')::date + 1;
while extract(isodow from v_date) in (6, 7) loop v_date := v_date + 1; end loop;
```

Next London date, skipping Saturday and Sunday. **No bank-holiday table or list.** The comment in `lib/customer/experience/copy.ts:84-85` ("skips weekends and bank holidays") is wrong about bank holidays.

**Stored vs computed.** `redeemable_from` is a `date` written at insert. There is no `ready` status; `status` stays `unlocked`. Readiness is computed on every read by comparing to today's London date: DB `private.reward_scan_eligibility_reason` `mig/20260905140000:32-34`, the transition `mig/20260905142000:105-108`, `get_reward_scan_context` `mig/20260902126000:233-239`; server `lib/customer/reward-qr-eligibility.ts:51`, `lib/customer/uk-date.ts:12-14`, `lib/notifications/events.ts:462-463`. The client only formats the stored date.

**Flow and where eligibility is re-checked.**

1. Customer opens `/reward/[id]` → `lib/customer/experience/load-reward.ts:27,42` decides waiting/ready/blocked (server).
2. QR image route `app/reward/[rewardId]/qr.png/route.ts:21-49` re-checks and calls `create_reward_scan_token` (`mig/20260905140000:94-140`): locks customer + reward, runs eligibility, reuses a live token with > 5 min left, else inserts `expires_at = least(now()+10 min, reward.expires_at)`. Insert triggers re-run eligibility, the expired-reward guard, verified-email guard, and `retire_previous_reward_scan_tokens` (advisory lock, `mig/20260902126000:31-51`).
3. Owner scans `/r/[token]` → `/app/rewards/scan/[scanToken]`; page calls `get_owner_reward_scan_context` (`mig/20260905140000:174-227`), which re-runs eligibility and returns `verification_required` if DOB is unverified.
4. Collect: `collect_current_reward_scan_token` → `collect_reward_scan_token` (`mig/20260905142000:346-481`): locks customer → reward → token, checks superseded/expired/consumed/redeemed, calls `redeem_self_service_reward`, consumes the token, enqueues `reward_collected_cycle_started`. ID-check variant `verify_and_collect_reward_scan_token` (`mig/20260905141000:164-242`) writes a private receipt in the same transaction.
5. Transition `private.redeem_self_service_reward_transition` (`mig/20260905142000:5-285`) re-checks status, `redeemable_from`, card active, threshold (stamp-cycle only), profile, 18+, merchant status/billing; geofence only flags. DB triggers add not-expired, billing, verified email, verified adult DOB.

So the weekday hold is enforced server-side at mint, at display and at collect; not only when the QR is shown.

`redeem_self_service_reward` (`mig/20260905142000:290-335`) is granted to `authenticated` but is not called by any app code; `app/reward/[rewardId]/status/route.ts:16-19` states the merchant scan is the only path (I: whether a customer JWT could call it directly was not tested).

**Tests:** hold enforced `tests/db/customer-lifecycle.test.mjs:160-190`, `tests/db/reward-redemption-edges.test.mjs:232`, `tests/db/merchant-id-verification.test.mjs:260`; unit `tests/unit/uk-date.test.mjs`, `tests/unit/reward-qr-eligibility.test.mjs:40`. **Not tested:** the Sat/Sun skip in `next_uk_business_date` itself.

## 5. Expiry (V)

- `resolve_reward_event_expires_at` (`mig/20260622140000:374-400`): `coalesce(reward_pool_items.reward_expires_after_days, loyalty_cards.reward_expires_after_days)`; null → never; else `created_at + days`. Trigger `reward_events_set_expiry_snapshot` BEFORE INSERT (`:402-427`) fills it once. Changing the setting later does not touch existing rewards (`mig/20260805100200:44-49`).
- Setting: `loyalty_cards.reward_expires_after_days` 1..3660, default 30 (`mig/20260805100200:78-84`); `save_loyalty_card(... p_reward_expires_after_days default 30)` (`mig/20260805100500:30-39`, NBS12 outside range); UI picklist [14, 30, 60, 90, 180] (`lib/merchant/reward-expiry-fields.ts:19-26`). The pool-item override column exists but has no writer in the app.
- Other sources set their own: birthday → first instant of the next London month (`mig/20260704092000:35-38`); merchant-direct → `now() + p_expires_in_days` (1..365, default 30, `mig/20260704095000:17-93`).
- Sweep `expire_due_reward_events` every 15 min (see §3) flips `unlocked` → `expired`, releases the cycle, enqueues `reward_expired`. Triggers `prevent_expired_reward_redemption` (`mig/20260622140000:431-446`) and `prevent_expired_reward_scan_token` (`:459-478`) block redemption/token minting between due time and sweep.
- Display: server-side `isRewardExpired` (`lib/customer/rewards.ts:113-115`), label "Expires {date}" in London time (`lib/customer/issued-reward-display.ts:10-15,59-62`). No client-side countdown or separate calculation.
- **Closures, bank holidays, opening hours: nothing.** No columns, tables or logic (grep of migrations/lib/app for `opening_hours|trading|closure|bank_holiday|holiday` finds only copy). `lib/customer/home-dashboard.ts:29` and `copy.ts:85` overstate this.
- `mig/20260808000000_old_crown_student_staff_three_year_window.sql` is a venue-specific hardcode, but for an **offer campaign** (window extended to 2029-08-07), not loyalty rewards.

**Tests:** `tests/db/loyalty-integrity-hardening.test.mjs:475,546,829,854`, `tests/db/issued-rewards-redemption.test.mjs:267`, `tests/unit/reward-expiry-fields.test.mjs`. **Not tested:** `prevent_expired_reward_redemption` directly; non-retroactivity of a setting change.

## 6. Concurrency (V)

Two scans of one reward cannot both succeed:

```sql
-- mig/20260905142000_owner_verified_reward_collection.sql:198-211
update public.reward_events set status = 'redeemed', redeemed_at = now(), ...
where reward_events.id = reward_record.id and reward_events.status = 'unlocked';
if not found then raise exception 'Reward already redeemed'; end if;
```

Before that, rows are locked customer → reward → token with `FOR UPDATE` (`:369-382`; ID-check path `mig/20260905141000:190-192`); token consume is `where consumed_at is null and superseded_at is null` (`:422-432`); one live token per reward is a partial unique index (`mig/20260902126000:27-29`) guarded by `pg_advisory_xact_lock` (`:38-40`). The loser cannot double-advance the cycle because the transition returns early on `status='redeemed'` (`:95-99`).

Two stamps on one member: the primitive opens with `FOR UPDATE` on the membership (`mig/20260907100100:212-223`), then the unique index catches duplicates (NBS01). Staff cannot stamp at all.

**Tests:** a real two-connection race only in `tests/db/merchant-id-verification.test.mjs:403`; `tests/db/reward-scan-single-use.test.mjs` and `reward-redemption-edges.test.mjs:78` are sequential. **Not tested:** concurrent plain `collect_current_reward_scan_token`; concurrent visit stamps.

## 7. Issued rewards vs merchant edits, settings, billing (V unless noted)

**Pool edits.** `upsert_reward_pool_item` (`mig/20260710110000:426-618`), `set_reward_pool_item_active` (`mig/20260721100000:6-104`), `delete_reward_pool_item` (`mig/20260710110000:625-728`: archived, not deleted, when any reward references it). None touch `reward_events`; the customer keeps the snapshotted name/terms and can still redeem. Redemption never reads `reward_pool_items`. Minimum-pool guards: `assert_reward_pool_launch_ready` (≥3 active while a join QR is live, `:7-62`), trigger on `qr_codes` (`:731-775`), and NBS03 in the stamp path — so a merchant who drops below 3 items strands members at "one stamp away" rather than cancelling anything.

**Programme settings.** `save_loyalty_card` (`mig/20260805100500:30-262`) calls `reconcile_loyalty_card_threshold_rewards` (`mig/20260630127000:1-163`): when `stamps_required` is **lowered**, every membership with `current_stamp_count >= new` and no reward in its cycle gets an unlocked reward minted immediately; needs ≥3 pool items or the save fails; the insert trigger means it also fails during a billing lapse (I). When **raised**, nothing happens; members keep stamps. Note the redemption transition subtracts the _current_ `stamps_required` while the gate counts earned rows, so a threshold change between unlock and redemption can desynchronise the counter (I). Server-only bound: 3..6 stamps and the expiry picklist (`app/app/card/actions.ts:172-178`, `lib/merchant/customer-readback.ts:41-45`); DB accepts 1..99 and 1..3660.

**Birthday toggle** (`save_loyalty_card_birthday_reward`, `mig/20260704090000:150-262`): disabling has no effect on already-issued birthday rewards.

**Policy version:** none on cards, cycles or rewards. `customer_loyalty_terms_acceptances` (`mig/20260713110000`, snapshot triggers `mig/20260715120000`, `mig/20260719170000`) stores a join-time terms snapshot per policy version but is never read by any earn/redeem path; it cites `loyalty_cards.reward_terms`, not the pool item the member will actually receive.

**Billing lapse.** `loyalty_billing_entitled(requires_billing, status)` = `not requires_billing or status in ('active','trialing')` (`mig/20260713180000:1-11`). Earning: inline checks NBS04/05/06 (`mig/20260907100100:262-281`; these ignore `past_due`) plus trigger `enforce_stamp_billing_entitlement` (`mig/20260713190000:1-33`; catches `past_due`). **Redemption of already-issued rewards, including birthday and direct, is blocked** by `enforce_reward_billing_entitlement_redeem` (`mig/20260713190000:36-68`) and token minting refuses (`mig/20260905140000:34-36`). **No grace period** in the DB; `lib/stripe/billing.ts:38-47` maps Stripe states straight through. **Expiry keeps running during a lapse**, so a member's reward can expire while the venue cannot honour it. The nine production merchants have `requires_billing=false` and no `billing_customers` row (`owner_complimentary_access`), so none of this is currently exercised.

**Suspension.** `merchants.status` outside `trial/active` → `merchant_inactive` blocks earn and redeem. No RPC or app path sets `suspended`/`paused`; only raw SQL past the `merchants_protect_business_state` trigger (`mig/20260711091000:25-68`).

**QR pause** (`verify_and_pause_qr`, `mig/20260909200100:67-96`; resume `mig/20260909200200:197-201` re-checks billing and pool): stops **all** stamping (QR and venue code both need an active join QR, NBS08). Redemption is unaffected.

**`admin_cancel_reward`** (`mig/20260606142000:2098-2183`) sets `status='cancelled'` and nothing else (verified at `:2137-2142`). For a `stamp_cycle` reward: NBS02 keeps firing (earned rows still equal `stamps_required`), `expire_due_reward_events` only selects `unlocked`, and the heal's `not exists` matches the cancelled row regardless of status (verified `mig/20260902132000:70-75`). **The card is stranded until someone hand-edits rows.** Production has exactly one cancelled reward (a `merchant_direct` one, so no card is affected today). No behavioural test exists for this RPC.

## 8. Source vs policy (V)

`reward_events.source ∈ {stamp_cycle, birthday_month, merchant_direct}` (`mig/20260704090000:25-26`). Finer provenance lives in `metadata.source` (`self_service_qr`, `referral_bonus`, `loyalty_card_threshold_reconciliation`, `cycle_completed_without_reward`). Policy is not a separate object; each producer hardcodes it:

| Source                                                         | Producer                                                                                                                         | `redeemable_from`    | `expires_at`                       | On redeem                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------- | ------------------------------- |
| stamp_cycle (visit / referral-completed / reconciled / healed) | four separate copies of the picker                                                                                               | next UK business day | card setting (30 d)                | cycle advances, stamps deducted |
| birthday_month                                                 | `issue_birthday_rewards` `mig/20260704092000:18-165`, cron 07:00 UTC daily                                                       | same day             | first instant of next London month | only `total_rewards_redeemed`   |
| merchant_direct (member or invite)                             | `internal_issue_merchant_direct_reward` `mig/20260704095000:17-93`; `attach_matched_reward_invites` `mig/20260801140000:154-330` | same day             | `now() + days` (1..365)            | only `total_rewards_redeemed`   |

Referral bonuses are **stamps**, not rewards (`award_referrer_bonus_stamp` `mig/20260712100000:931-971`). Offer passes are a separate object graph (`offer_campaigns`, `offer_discount_entitlements`, `offer_redemptions`, `mig/20260803*`). No policy version anywhere; changing "how long a direct reward lasts" means editing the RPC bounds and `lib/merchant/send-reward-fields.ts`.

**Goodwill.** `issue_merchant_direct_reward` (`mig/20260704095000:96-192`): owner only, 1 per membership per London day and 100 per merchant per day (`:171-179`), reason stored only in `metadata.reason`, and the server passes the merchant's _personal message_ as the reason (`app/app/customers/send-reward/actions.ts:348`). Audit `direct_reward_issued`. `admin_adjust_membership_stamps` and `admin_cancel_reward` require a ≥4-char reason and write `audit_logs`; neither has a behavioural test.

## 9. Notifications and consent (V for cited lines; copy quoted from templates)

**Channels.** The customer ledger (`notification_events` / `notification_deliveries`, `mig/20260622140000:58-122`) is delivered by **web push only** (`lib/notifications/push-sender.ts`), on the 15-minute cron via `lib/notifications/delivery-worker.ts`. Twilio is OTP-only. Merchant emails go through Resend. There is no welcome email, no in-app inbox, and the profile's SMS/WhatsApp/email marketing toggles record consent for channels that have no sender.

**Categories** are duplicated by hand in SQL (`notification_event_category`, `mig/20260710190000:18-63`) and TypeScript (`lib/notifications/catalog.ts:58-80`): transactional (one_stamp_away, reward_unlocked_waiting, reward_ready, profile_required_to_collect, reward_collected_cycle_started, referral__), reminder (next_stamp_available, reward_expiring_soon, reward_expired), marketing (dormant_progress, venue_announcement, **birthday_reward_issued, merchant_reward_received**), operational (push__). Delivery gating (`delivery-worker.ts:390-411`): transactional → `transactional_enabled` (default true); reminder → `reminder_enabled` (default true); marketing → `marketing_enabled` (default false) **and** latest `consent_records` row for (customer, merchant, channel='push') = `opted_in`. Quiet hours defer reminder+marketing; cap 6 non-operational pushes per 24 h; needs an enabled `push_subscriptions` row.

| Event                          | Enqueued by                                                                                                  | Copy (title / body)                                                                                                                       | Gate                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| reward_ready                   | server after stamp `lib/notifications/events.ts:152-195`; daily producer `notification-producers.ts:126-164` | "Reward ready" / "{reward} is ready to collect at {venue}."                                                                               | transactional                                      |
| reward_unlocked_waiting        | `events.ts:169-174`                                                                                          | "Reward unlocked" / "{reward} is waiting for the next eligible collection day."                                                           | transactional                                      |
| profile_required_to_collect    | `events.ts:172-173`                                                                                          | "Finish your details" / "Complete your profile before collecting {reward}."                                                               | transactional                                      |
| one_stamp_away                 | `events.ts:198-213`                                                                                          | "One stamp away" / "{venue} has a reward nearly ready."                                                                                   | transactional                                      |
| next_stamp_available           | producer `:166-205`, every member with > 0 stamps, no stamped-today filter                                   | "Next stamp available" / "{venue} can stamp your card again today."                                                                       | reminder                                           |
| reward_expiring_soon           | producer `:81-124` (≤ 72 h)                                                                                  | "Reward expiring soon" / "{reward} is close to its expiry time."                                                                          | reminder                                           |
| reward_expired                 | DB `expire_due_reward_events` `mig/20260805100200:211-227`                                                   | "Reward expired" / reward name                                                                                                            | reminder                                           |
| reward_collected_cycle_started | DB collect `mig/20260905142000:445-476`                                                                      | "Reward collected" / "A new {venue} stamp cycle has started."                                                                             | transactional                                      |
| birthday_reward_issued         | DB `mig/20260704092000:133-150`                                                                              | "Birthday treat" / "{reward} at {venue}"                                                                                                  | **marketing**                                      |
| merchant_reward_received       | DB `mig/20260704095000:76-85`                                                                                | "A reward for you" / "{reward} at {venue}"                                                                                                | **marketing**                                      |
| referral_*                     | DB triggers `mig/20260710190000:115-123` etc.                                                                | payload contains only `url`; browser shows the fallback "Nabaperks" / "Your Nabaperks account has an update." (`public/sw.js:24,225-231`) | transactional                                      |
| venue_announcement             | `lib/notifications/venue-announcements.ts:88-158`                                                            | merchant text, 2 per venue per day                                                                                                        | marketing                                          |
| dormant_progress               | producer `:207-248` (≥ 21 days idle)                                                                         | "Stamp card waiting" / "{venue} still has progress on your card."                                                                         | marketing                                          |
| reward invite email            | `app/app/customers/send-reward/actions.ts:243-249`                                                           | "A reward is waiting for you at {venue}"                                                                                                  | no recipient consent; suppression + 3/address/30 d |
| loyalty invite email           | `lib/loyalty-invites/delivery-worker.ts:153-180`                                                             | "Two welcome stamps are waiting at {venue}"                                                                                               | merchant attestation only                          |
| weekly merchant digest         | `lib/notifications/merchant-digest.ts:79-166`                                                                | "Your week at {venue}"                                                                                                                    | no opt-out flag                                    |
| QR paused/resumed              | `mig/20260909200100:59-62` → `lib/notifications/qr-status-worker.ts`                                         | "Customer scans {paused                                                                                                                   | resumed} — {venue}"                                | none (service) |

Findings: birthday and direct rewards are classed as marketing, so a member with marketing off (the default) is never told; referral pushes are body-less; the two category maps have no parity test; `next_stamp_available` nudges every member daily under the default-on reminder flag.

**Consent** is stored separately from verification: `customers.phone_verified_at` / `email_verified_at` (`mig/20260613210000`, `mig/20260615120000`) vs append-only `consent_records (merchant_id, customer_id, channel, consent_status, source, policy_version)` (`mig/20260606142000:210-219`). Scope is per venue in storage but global in the UI: join writes one row for that venue (channel `email` if the member has an email else `sms`, never `push`, `mig/20260802120000:365-384`); the profile toggle writes one row per _existing_ membership (`record_customer_marketing_consent` `mig/20260624140000:45-100`), so venues joined later get no row. Admin opt-out cannot revoke `push` (`mig/20260606142000:2389`). Invite unsubscribes live in separate suppression tables and do not write consent rows. Join form (`components/customer/join-forms.tsx:161-263`): loyalty terms required (server `app/m/[merchantSlug]/join/actions.ts:571-573`, DB `mig/20260802120000:175-177`); "Offers and perks" optional, `useState(false)`, not pre-ticked. Terms version `CUSTOMER_LEGAL_VERSION = "2026-07-19"` doubles as the marketing `policy_version`.

## 10. DOB and age gate (V)

- Collected in the profile "About you" form, the redemption profile gate, and a dashboard prompt (`components/customer/home-birthday-prompt.tsx:64-74`); **not at join**. Stored as `customers.date_of_birth date` in **plaintext** (`mig/20260615120000:12-15`; email and phone are hashed/encrypted, DOB is not). Verification provenance columns `mig/20260902136000:5-28`, `mig/20260905141000:22-30`; trigger nulls provenance on any customer-originated change and expires live scan tokens (`mig/20260902136000:132-163`).
- **Threshold 18, every reward, no alcohol flag** on `reward_pool_items` or `reward_events`. Enforced: profile save (`lib/customer/profile-fields.ts:39-59`); token mint on self-asserted DOB (`private.reward_scan_eligibility_reason` `mig/20260905140000:42-53`); transition (`mig/20260905142000:121-134`); **redemption requires a verified adult DOB** via trigger `reward_events_require_verified_dob` → `customer_has_verified_adult_date_of_birth` (`mig/20260902136000:170-192,225-258`); birthday issue skips unverified (`:231-243`). Verification: admin RPC (`mig/20260902136000:272-348`) or owner photo-ID check inside `verify_and_collect_reward_scan_token` (`mig/20260905141000:164-246`, receipt in `private.merchant_id_verification_receipts`, docs `docs/operations/reward-id-verification.md`). Offer campaigns have their own `requires_id_check` flag, unrelated to DOB.
- Birthday reward (`issue_birthday_rewards`, `mig/20260704092000:18-155`, cron `0 7 * * *`): whole London calendar month, once per (merchant, customer, year), 18+, verified DOB, a visit in the last 12 months, card `birthday_reward_enabled` per venue.

Consequence: a coffee-only card would still require photo ID to collect. In production 66 members have owner-verified DOBs (all via `merchant_owner`) and every one of the 95 redeemed cycle rewards belongs to a verified member.

---

## 11. Enforcement matrix and configurability

| Rule                                                | DB                       | Server            | Client-only     | Per venue                                      |
| --------------------------------------------------- | ------------------------ | ----------------- | --------------- | ---------------------------------------------- |
| 1 stamp / member / location / London day            | ✔ (check + unique index) | —                 | —               | no                                             |
| Full-card lock (NBS02)                              | ✔                        | —                 | —               | no                                             |
| Location proof / venue code                         | ✔                        | pre-checks        | UX gating only  | radius, first verified visit, require_geofence |
| ≥ 3 active pool items                               | ✔                        | error copy        | —               | items yes, minimum no                          |
| First-cycle default item, later weighted random     | ✔                        | —                 | —               | weights yes                                    |
| Next-business-day hold, Sat/Sun skip                | ✔                        | mirrors           | formats only    | no                                             |
| Expiry days                                         | ✔                        | picklist 14–180   | —               | yes (1..3660 in DB)                            |
| stamps_required range                               | ✔ 1..99                  | 3..6              | —               | yes                                            |
| 18+ and verified DOB to collect                     | ✔                        | ✔                 | `max` attr only | no                                             |
| Verified email to collect                           | ✔                        | ✔                 | —               | no                                             |
| Billing entitlement (earn + redeem)                 | ✔                        | ✔                 | —               | requires_billing flag                          |
| Marketing push gating                               | consent rows ✔           | delivery worker ✔ | —               | consent per venue                              |
| Direct reward caps (1/member/day, 100/merchant/day) | ✔                        | —                 | —               | no                                             |
| Referral bonus cap 2/referrer/day                   | ✔                        | —                 | —               | no                                             |

No load-bearing rule is client-only. Two rules are **server-only** (not in DB): `stamps_required` 3..6 and the expiry picklist.

## 12. Rules the tests do not cover

- Concurrent visit stamps on one membership; concurrent `collect_current_reward_scan_token`; reward-per-cycle uniqueness under concurrency.
- `next_uk_business_date` weekend skip; the midnight-London stamp boundary and BST/GMT transitions; the 10-minute previous-venue-code window.
- `admin_cancel_reward` and `admin_adjust_membership_stamps` behaviour (grant checks only).
- `prevent_expired_reward_redemption` trigger directly; non-retroactivity of expiry changes; threshold raise; `reconcile_loyalty_card_threshold_rewards` (regex-only contract test).
- Pool item archive/rename vs an issued reward's snapshot; `selection_mode` / first-cycle default.
- Issued (birthday/direct) rewards during a billing lapse; `merchants.status='suspended'` end to end; QR pause vs redemption.
- Referral push copy (the body-less payload); stamp-path enqueues of `one_stamp_away`, `reward_unlocked_waiting`, `profile_required_to_collect`; DB/TS category-map parity.

## 13. Open questions for you

1. `admin_cancel_reward` on a cycle reward appears to strand the card permanently. Is that known, and has it ever been used on a cycle reward in production? (Today's single cancelled reward is a direct one.)
2. The venue code rolls at 05:00 London while the stamp day rolls at 00:00. Intentional, or should both move to a venue-configured trading-day boundary?
3. Is the 18+ / photo-ID requirement on _every_ reward (including food and non-alcoholic items) a deliberate policy, or a stopgap until an alcohol flag exists?
4. Birthday and direct rewards are gated as _marketing_; with 9 members opted in, almost nobody is told they received one. Is that the intended classification?
5. `redeem_self_service_reward` is unused by the app but callable by an `authenticated` JWT. Is it meant to be revoked?
6. The join-time legal snapshot cites `loyalty_cards.reward_terms` (the legacy "Surprise reward" copy), not the pool item terms the member actually receives. Does legal care?
7. Lowering `stamps_required` during a billing lapse fails the whole card save. Acceptable?
