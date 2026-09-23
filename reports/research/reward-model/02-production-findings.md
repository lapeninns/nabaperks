# 02 — Production findings: how members actually behave

Queried 2026-09-19 between 17:39 and 18:30 Europe/London against the linked Supabase project (`nabaperks`, eu-west-2) via `supabase db query --linked`, every statement wrapped in `set local transaction_read_only = on` (proof in `queries.sql` Q001). Aggregates only. Any cell that would describe fewer than 5 members is written `<5`. Venues are named by ID prefix plus business name. All dates and hours are Europe/London (the server runs in UTC; every `date` column in the schema is London-derived, and Q054 found 0 rows where `earned_business_date` disagrees with the London date).

**Access note.** Only read-write credentials exist (the `postgres` role via the pooler, plus the service-role key); no read-only role is defined in the migrations. You told me to use the Supabase CLI, so I proceeded with the CLI's linked-project session and enforced read-only at the transaction level on every call, with a wrapper that refuses anything but a single `SELECT`/`WITH` statement. Numbers moved slightly while I worked (two redemptions landed mid-session), so totals may differ by ±2 between tables.

---

## 0. Read this first: the data is 15 days old

Every customer table begins on **2026-09-04**. There are 1,109 stamps, 568 memberships and 187 cycle rewards, all created between 4 and 19 September. Merchant-side events go back to 14 July, so the customer tables were evidently reset before public launch (inferred; the repo has a `db:clean:customers` script). Consequences:

- "Active in the last 30/90 days" equals "everyone". I report 7-day and 14-day activity instead.
- **No reward has expired yet.** The earliest cycle-reward expiry is 2026-10-05 (30-day setting). Expiry rate by segment cannot be measured; I give the best available proxy (§7).
- "Monthly" visit rhythm cannot exist in a 15-day window; the longest observed gap between two visits is 11 days.
- Post-reward behaviour uses 7-day windows, not 30.
- Every per-venue number below carries small-sample risk; Corner House (22 members, 26 stamps) is too small for any conclusion.

## 1. Tables used, and data quality

**Tables:** `merchants`, `merchant_locations`, `loyalty_cards`, `reward_pool_items`, `customers` (counts only, never row-level), `customer_memberships`, `stamp_events`, `reward_events`, `reward_scan_tokens`, `venue_code_stamp_receipts`, `referrals`, `product_events`, `notification_events`, `notification_deliveries`, `notification_preferences`, `push_subscriptions`, `consent_records`, `fraud_flags`, `audit_logs`, `billing_customers`. Live column lists and check constraints are in `queries.sql` Q005/Q006.

**Definitions.** A _visit stamp_ is a `stamp_events` row with `event_type='earned'` and `metadata->>'source' <> 'referral_bonus'` (33 referral bonus stamps and 1 operator-goodwill stamp carry no business date and are not visits). A _cycle reward_ is `reward_events.source='stamp_cycle'`. "Locked" means a membership whose current cycle holds an unredeemed cycle reward.

**Test data.** None of the nine merchants is a test venue: all are Lapen pubs created 2026-07-14, all `active`, `requires_billing=false`, no `billing_customers` rows (`owner_complimentary_access` audit entries), one location each, one active 3-stamp card with 30-day expiry and birthday reward enabled, three active pool items, one active QR. There are no seed-UUID merchants and no `.test` emails. 7 customers have test-looking emails or names (`test`, `demo`, `example`, plus-addressing); they are 1.2% of members and are left in the aggregates. 1 internal admin exists. 2 customers have been erased, 9 customers never completed a membership, 3 customers hold memberships at two pubs, 1 device hash is shared by 3 customers (all other 695 devices map to one customer).

**Timezone.** Server `TimeZone=UTC`; `earned_business_date`, `redeemable_from`, `code_day`, `business_date` are all London dates (Q054: 0 mismatches vs London, 2 vs UTC).

**Analytics.** PostHog is not reachable: only an ingest project key exists, no personal API key, and mirroring is optional (`ANALYTICS_EXTERNAL_PROCESSING_MODE`, value not inspected). `product_events` is the declared source of truth and was used for the funnel.

## 2. Venue profile

| Venue                  | Members | Joined last 7 d | Active last 7 d | Active last 14 d | Join → first stamp | First → second visit day | 3+ visit days | 4+ visit days |
| ---------------------- | ------- | --------------- | --------------- | ---------------- | ------------------ | ------------------------ | ------------- | ------------- |
| f6b2… Bell             | 124     | 28              | 78              | 120              | 98%                | **51%** (62)             | 40            | 22            |
| ed05… Barley Mow       | 95      | 19              | 33              | 93               | 98%                | 30% (28)                 | 12            | <5            |
| cccd… Old Crown        | 69      | 20              | 29              | 56               | 91%                | 33% (21)                 | 12            | 6             |
| 5677… Queen Elizabeth  | 62      | 30              | 41              | 59               | 97%                | 33% (20)                 | 13            | 7             |
| 7cbf… Railway          | 54      | 22              | 33              | 52               | 100%               | 30% (16)                 | 13            | 6             |
| 8792… Prince of Wales  | 52      | 21              | 35              | 52               | 100%               | 38% (20)                 | 13            | <5            |
| 8709… White Horse      | 50      | 14              | 22              | 47               | 100%               | 36% (18)                 | 7             | 0             |
| e4cc… Old School House | 40      | 7               | 18              | 39               | 98%                | **59%** (23)             | 15            | <5            |
| 71fa… Corner House     | 22      | 7               | 7               | 18               | 91%                | <5                       | <5            | <5            |
| **All**                | **568** | 168             | 296             | 536              | 97%                | **37%** (210)            | 126           | 50            |

Join → first stamp is ~97% _by construction_: the join RPC issues stamp 1 in the same request. The real conversion is first → second visit day. Among the 400 members who joined more than 7 days ago, **45.5%** have come back at least once. Confidence: Bell and Barley Mow are solid; Corner House is not interpretable; the rest are directional (n = 40–70).

## 3. When members stamp

Stamps per observed weekday (raw count ÷ number of that weekday in the window, Q025 ÷ Q028), visit stamps only:

| Venue            | Mon | Tue | Wed | Thu | Fri    | Sat | Sun    | Quiet (own data)      | Busy (own data)                                 |
| ---------------- | --- | --- | --- | --- | ------ | --- | ------ | --------------------- | ----------------------------------------------- |
| Bell             | 13  | 19  | 18  | 17  | **42** | 20  | 17     | Mon                   | Fri                                             |
| Barley Mow       | 7   | 25* | 9   | 14  | 15     | 8   | 2      | Sun, Mon, Sat         | Thu, Fri (*Tue 8 Sep was launch day: 41 stamps) |
| Old Crown        | 6   | 5   | 9   | 4   | **12** | 8   | 10     | Thu, Tue, Mon         | Fri, Sun                                        |
| Queen Elizabeth  | 4   | 8   | 5   | 11  | **15** | 9   | 4      | Mon, Sun, Wed         | Fri, Thu                                        |
| Railway          | 3   | 6   | 3   | 6   | 7      | 7   | **14** | Wed, Mon              | Sun                                             |
| Prince of Wales  | 2   | 5   | 7   | 10  | **12** | 4   | 5      | Mon, Sat              | Fri, Thu                                        |
| White Horse      | 4   | 3   | 2   | 3   | **11** | 4   | 3      | Wed, Tue, Thu         | Fri                                             |
| Old School House | 5   | 6   | 5   | 8   | 8      | 2   | **9**  | Sat                   | Sun, Thu, Fri                                   |
| Corner House     | —   | —   | —   | —   | —      | —   | —      | too small (26 stamps) |                                                 |

Two things stand out. The assumption "Mon–Thu is quiet" holds for Bell, Queen Elizabeth, Prince of Wales and White Horse, but **not** for Railway (Sunday is its peak, Wednesday its trough) or Old School House (Saturday is its trough). And "quiet" is relative: Bell's quietest day still sees more stamps than most venues' busiest.

**Hour of day (all venues, 1,075 visit stamps):** 14:00 100 · 15:00 138 · 16:00 134 · 17:00 172 · 18:00 165 · 19:00 151 · 20:00 77 · 21:00 42; before noon 13 stamps in total, after 22:00 12. Per-venue peaks: Bell 15–18, Barley Mow 19, Old Crown 14–16, Queen Elizabeth 17–19, Railway 15 and 17, Prince of Wales 17, White Horse 19–20, Old School House 18. **Mon–Thu 12:00–14:59 is thin everywhere**: 0–18 stamps per venue over two weeks (Q020), i.e. under one member a day at every venue except Bell.

## 4. Visit rhythm

Gap between a member's consecutive visit days (523 gaps, Q029): 1 day 255 · 2 days 104 · 3 days 47 · 4 days 27 · 5 days 26 · 6 days 21 · 7 days 26 · 8–11 days 17. **97% of return visits happen within a week; half happen the next day.**

Segments (visit days ≥ 2; "weekly+" = average gap ≤ 7 days; Q030/Q031):

| Cohort                | Members with visits | One-time only | Weekly+   | Fortnightly | Monthly |
| --------------------- | ------------------- | ------------- | --------- | ----------- | ------- |
| Joined 7+ days ago    | 387                 | 205 (53%)     | 170 (44%) | 12 (3%)     | 0       |
| Joined in last 7 days | 166                 | 138           | 28        | 0           | 0       |

Per venue (joined-any-time): Bell 122 → 60 one-time / 59 weekly+ / <5 fortnightly; Barley Mow 93 → 65 / 24 / <5; Old Crown 63 → 42 / 20 / <5; Queen Elizabeth 60 → 40 / 20 / 0; Railway 54 → 38 / 16 / 0; Prince of Wales 52 → 32 / 19 / <5; White Horse 50 → 32 / 18 / 0; Old School House 39 → 16 / 20 / <5; Corner House 20 → 18 / <5 / 0. The population is bimodal: people either come back within days or not at all. A "monthly diner" segment does not exist yet in this data; it may appear once the window is longer.

## 5. Card funnel

Every cycle starts at stamp 1 (join stamp). With `stamps_required = 3`, completion needs two return visits.

| Venue            | Cycles started | Reached 2     | Completed (3) | Median days 1st→3rd stamp | Median days stale at 2 |
| ---------------- | -------------- | ------------- | ------------- | ------------------------- | ---------------------- |
| Bell             | 158            | 90            | 63            | 3.0                       | 2.9                    |
| Barley Mow       | 100            | 42            | 23            | 3.0                       | 7.0                    |
| Old Crown        | 77             | 31            | 24            | 2.0                       | 8.0                    |
| Queen Elizabeth  | 70             | 31            | 22            | 3.9                       | 0.9                    |
| Railway          | 60             | 24            | 16            | 3.0                       | 4.7                    |
| Prince of Wales  | 55             | 23            | 13            | 6.0                       | 2.0                    |
| White Horse      | 50             | 19            | 8             | 3.9                       | 6.0                    |
| Old School House | 42             | 26            | 17            | 5.1                       | 2.9                    |
| Corner House     | 21             | <5            | <5            | —                         | —                      |
| **All**          | **633**        | **290 (46%)** | **187 (30%)** | 3.0                       | —                      |

The drop-off point is **1 → 2** (54% of cycles never get a second stamp). Of cycles that reach 2, 64% go on to complete. Completed cards complete fast: median 3 days. 80 members have already started a second cycle (53 on cycle 2, 20 on cycle 3, 6 on cycle 4, 1 on cycle 5). Right now **92 members are sitting on a full, locked card** (Bell 25, Barley Mow 14, Queen Elizabeth 10, Prince of Wales 10, Old Crown 9, Railway 9, Old School House 9, White Horse 6, Corner House 0).

## 6. Rewards

| Venue            | Cycle rewards issued | Redeemed     | Open   | Median days issue → redeem | Birthday issued | Direct issued                |
| ---------------- | -------------------- | ------------ | ------ | -------------------------- | --------------- | ---------------------------- |
| Bell             | 63                   | 38           | 25     | 1.25                       | <5              | <5                           |
| Barley Mow       | 23                   | 9            | 14     | 1.02                       | 0               | <5                           |
| Old Crown        | 24                   | 15           | 9      | 2.07                       | <5              | 0                            |
| Queen Elizabeth  | 22                   | 12           | 10     | 1.48                       | 0               | 0                            |
| Railway          | 16                   | 7            | 9      | 4.12                       | <5              | 6 (<5 members)               |
| Prince of Wales  | 13                   | <5           | 10     | 6.21                       | 0               | 0                            |
| White Horse      | 8                    | <5           | 6      | 4.43                       | 0               | 0                            |
| Old School House | 17                   | 8            | 9      | 2.54                       | <5              | 0                            |
| Corner House     | <5                   | <5           | 0      | —                          | <5              | 0                            |
| **All**          | **187**              | **96 (51%)** | **91** | 1.9                        | 9 (1 redeemed)  | 10 (5 redeemed, 1 cancelled) |

**Expired: 0. Cancelled: 1 (a direct reward).** Earliest expiries: cycle 2026-10-05, birthday 2026-09-30 (end of month rule), direct 2026-09-22.

**The weekday hold decides redemption more than anything else** (Q023, cycle rewards):

| Issued on | Issued | Ready delay | Redeemed             | Redeemed on first ready day | Median days to redeem |
| --------- | ------ | ----------- | -------------------- | --------------------------- | --------------------- |
| Mon–Thu   | 92     | 1 day       | **70%**              | 41                          | 1.0                   |
| Fri       | 39     | **3 days**  | **10%** (<5 members) | <5                          | 6.0                   |
| Sat–Sun   | 56     | 1.6 days    | 50%                  | 11                          | 3.0                   |

Of the 96 redemptions, 53 happened on the ready day itself, 14 the day after, and the rest within a week (Q037). Redemptions by weekday: Mon 17 · Tue 11 · Wed 17 · Thu 21 · Fri 24 · Sat 10 · **Sun 0**; by hour they sit 13:00–20:00 with the peak at 15:00–19:00 (Q038). No Sunday redemption has ever happened, although Sunday carries 12% of stamps: a Saturday completion is not collectable until Monday, and a Friday completion waits until Monday as well.

**Who collects.** 67 rewards were collected via the owner ID-check path (`merchant_scan`, each writing a `customer_date_of_birth_verified` audit) and 33 via a plain scan by an already-verified member (`self_service` in metadata, still owner-scanned; inferred from the code path, Q049). Fastest owner collection was 2.9 minutes after issue (a same-day-redeemable direct/birthday reward); no redemption precedes `redeemable_from` (Q048).

**Open rewards by member segment (Q019)** — the closest available proxy for the expiry question:

| Member segment (by visit rhythm)              | Cycle rewards | Redeemed | Open | Open > 7 days |
| --------------------------------------------- | ------------- | -------- | ---- | ------------- |
| Near-daily visitors (avg gap ≤ 3 d)           | 95            | 73 (77%) | 22   | 0             |
| Weekly (gap 3–7 d)                            | 5             | 5        | 0    | 0             |
| Completed in exactly 3 visits, never returned | 87            | 17 (20%) | 70   | **23**        |

Every reward that has sat open for more than 7 days belongs to someone who has not been back since completing the card. Your hypothesis that infrequent members expire more is very likely right, but it will be **"members who stopped coming"**, not "monthly diners" who come and find the reward gone; and whether 30 vs 56 days would change that is unknowable until October.

## 7. Lock cost

The lock is invisible in the ledger by design: a stamp attempt on a full card is refused (NBS02) and nothing is written, and `qr_scanned` events carry no membership id (Q040/Q021). What can be measured:

- **Lower bound.** 9 members opened their card on a later day while locked and before redeeming (10 member-days, Q021b). That is the only direct evidence of "came back, earned nothing".
- **Model estimate (Q026).** Redeemed rewards were locked for 243 member-days in total (median 1.9 days, 90th percentile 6.0). Multiplying each member's pre-completion visit rate by their locked days gives ≈166 visit-equivalents during which no stamp could be earned, i.e. ≈55 extra stamps on 3-stamp cards. Treat this as an upper bound: the pre-completion rate is inflated by the join burst. The same model applied to still-open rewards (350 locked days) gives ≈239, but 70 of the 91 open rewards belong to members who have not returned at all, so that figure is mostly fiction.
- **Redemption visits already earn.** 70 of 96 redemptions (73%) were followed by a new stamp within 3 hours (Q025): the collection visit is, today, usually also stamp 1 of the next card.
- **Never returned after completing:** 88 of 187 completed cycles (47%) have an open reward and no stamp or card view since completion; 23 of those are older than 7 days.

## 8. Post-reward behaviour

For the 33 cycle rewards redeemed 7+ days ago: average visit stamps in the 7 days before completion 2.18, in the 7 days after redemption **3.79**; 30 of 33 members visited again (Q042). This is the earliest, keenest cohort (selection bias), and a 3-stamp card cannot show more than 3 stamps in a 7-day pre-window, so read it as "regulars stay regular after a reward", not as uplift.

## 9. Reward mix

All nine venues run the same pool: **Regulars' pint** (display order 1, weight 1), **Free starter** (weight 1), **Buy one drink, get one free** (weight 18; an admin swapped this in for "Dessert on the house" on 2026-09-11, `reward_pool_drink_bogo_swap`).

| Item                                | Issued    | Redeemed | Type    |
| ----------------------------------- | --------- | -------- | ------- |
| Regulars' pint                      | 144 (77%) | 74       | alcohol |
| Buy one drink, get one free         | 29 (16%)  | 14       | alcohol |
| Free starter                        | 13 (7%)   | 10       | food    |
| Dessert on the house (now inactive) | <5        | <5       | food    |

The mechanics explain the mix: cycle 1 always issues the first item (the pint); from cycle 2 the weighted draw gives the BOGO drink 90% of the time. All 9 birthday rewards are "Birthday shot on us"; 7 of 10 direct rewards are "Regulars' pint". **≈93% of everything issued is alcohol**, which is also why the 18+ / photo-ID gate bites on every collection.

## 10. Goodwill and overrides

- Direct ("send a reward") rewards: 10, from 3 venues (Railway 6 to <5 members, Barley Mow <5, Bell <5); 5 redeemed, 1 cancelled. **No reason recorded on any of them** (the metadata key exists but is empty; the server passes the merchant's personal message, which nobody wrote).
- Goodwill stamps: 1 `operator_goodwill` stamp with a reason; 1 admin `stamp_adjusted`. No manual reward cancellations of cycle rewards.
- Referral programme: 49 attributions, 33 bonus stamps awarded, 1 held for `card_full`, and that single held referral has generated **584 `referral_bonus_held` product events** (retried every 15 minutes; log noise, not member behaviour).

## 11. Anomalies

- Same member, same day, two visit stamps: 1 member-day at Corner House (max 2). The extra stamp is the goodwill stamp, which carries no business date and so bypasses the daily index. Otherwise the daily rule holds everywhere.
- Out-of-hours: 3 stamps between 00:00 and 04:00 and 10 before noon across all venues; without opening hours I cannot call them anomalies. Two stamps fall on a different UTC date than their London date (late evening BST), which is handled correctly.
- Redemptions seconds after issue: none; the fastest is 2.9 minutes on a same-day-redeemable reward. No redemption before `redeemable_from`, no member redeeming twice in a day; 4 members hold two open rewards (a cycle reward plus a birthday/direct one).
- Staff outliers: there are no staff accounts; every collection is the owner's scan.
- Location: 17 refusals (11 `location_required`, 6 out of range); 37 stamps accepted unverified under grace (33 flagged `self_service_geofence_unknown`); 24 venue-code stamps (Bell 12 from 10 devices, Railway 5, others <5), 22 of them by direct code entry. 116 fraud flags, all `low`, 115 open.
- Launch bursts: Barley Mow 8 Sep (40 joins, 41 stamps), Bell 11 Sep (34 joins, 48 stamps), Old Crown 4 Sep (20 joins). These inflate that weekday in §3.

## 12. Join flow funnel (from `product_events`, since 2026-09-04)

| Step                       | Count                        | Note                                                                                                                                      |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Venue QR scanned           | 2,086                        | includes returning members (the `/q` route renders a member's card in place); 46 scans hit a paused QR (7–9 Sep)                          |
| Join page: welcome         | 877                          |                                                                                                                                           |
| Join page: phone           | 748 (+256 via referral link) | 85% of welcome                                                                                                                            |
| OTP requested              | 742                          |                                                                                                                                           |
| OTP verified               | 711                          | **96%** of requests                                                                                                                       |
| Join page: terms           | 545 (+48 referral)           | the 166 verified-but-no-terms are mostly existing members re-verifying (phone-OTP continuity), not drop-off (inferred)                    |
| Terms accepted             | 571                          | ≈100% of those who see it                                                                                                                 |
| Member created             | 574                          |                                                                                                                                           |
| First stamp issued at join | 522                          | **91%**; the ~50 without are referral-link joins that carry no QR proof and stamp on their first in-venue scan (inferred), plus 2 pending |
| Card viewed later          | 745                          |                                                                                                                                           |

Per venue (scans / welcome views / OTP requested / joined / first stamp): Bell 617 / 763 / 189 / 124 / 120 · Barley Mow 277 / 499 / 113 / 95 / 82 · Old Crown 274 / 410 / 90 / 73 / 57 · Queen Elizabeth 219 / 326 / 79 / 62 / 55 · Railway 189 / 293 / 65 / 54 / 48 · Prince of Wales 165 / 290 / 67 / 52 / 51 · White Horse 113 / 333 / 60 / 50 / 48 · Old School House 173 / 210 / 48 / 40 / 39 · Corner House 59 / 112 / 25 / 24 / 22. The leak is **welcome → phone (≈15%)** and phone → OTP page (≈9%); OTP itself barely leaks. Old Crown converts fewest OTP requests into first stamps (57 of 90).

## 13. Notifications, consent, DOB in practice

- **Reach is near zero.** 2,354 notification events, 54 pushes delivered; 2,283 deliveries skipped for `no_subscription`, 18 not eligible, 15 hit the frequency cap. There are **6 push subscriptions** among 568 members. 501 of 513 `reward_ready` events were cancelled undelivered. Members find their rewards by opening the card.
- **Consent:** 412 members (72%) ticked "Offers and perks" at join (recorded as channel `sms`, opted in, source `customer_join`); later profile actions: email 35 in / 2 out, WhatsApp 27 / 2, push 10 / 3, SMS 2 / 16. `notification_preferences.marketing_enabled` is true for 9 of 246 rows. No SMS/WhatsApp/email marketing has ever been sent (no sender exists).
- **DOB:** 173 members (30%) have a DOB, 66 verified, all by an owner's in-person photo-ID check at collection. Of the 92 open cycle rewards, **69 belong to members with no DOB (38) or an unverified one (31)**, so three quarters of open rewards need an ID check at the bar before they can be collected.
- **Birthday rewards:** 9 issued (08:00 London), 1 redeemed, expiring 11–21 days after issue because they end at month end.

## 14. Confidence notes

- Bell (124 members, 311 stamps) and Barley Mow (95, 165): per-venue patterns are usable.
- Old Crown, Queen Elizabeth, Railway, Prince of Wales, White Horse, Old School House (40–69 members, 75–132 stamps): weekday and hour shapes are directional only; each weekday was observed only twice.
- Corner House: no conclusions.
- Anything involving expiry, 30-day windows, monthly rhythm or seasonality: not measurable yet.
- Launch-day bursts (Barley Mow Tue 8 Sep, Bell Thu 11 Sep, Old Crown Fri 4 Sep) inflate those weekdays.

## 15. Open questions for you

1. Were the customer tables reset on or just before 4 September, and by what path? (The SQL runner refuses non-local writes, so it was not `db:clean:customers`.) I want to be sure no live members were lost and that "15 days" is the true history.
2. Are the 66 owner DOB verifications all genuine photo-ID checks, or did owners tap through? 67 of 100 collections went through the ID path.
3. Were Barley Mow (8 Sep) and Bell (11 Sep) launch events, and are those members staff/friends? Bell's 51% return rate may be partly that.
4. Is the 72% "Offers and perks" opt-in at join real consent or an artefact of the "Yes to all" checkbox?
5. Do you want me to re-run this pack after 5 October (first cycle expiries) and again after 4 November (60 days), so the expiry and rhythm questions get real answers? The queries are saved and parameter-free.
