# Customer Edge Case Audit

> **Type:** read-only code-and-test audit of the customer loyalty journey (QR → join → stamp → card → reward).
> **Date:** 2026-06-16 · **Branch:** `main` · **Scope:** customer surfaces only.
> **No production code, tests, or migrations were modified to produce this artifact.** Recommendations are deferred to a separate implementation slice.

---

## 1. Executive summary

The customer journey is built on a clean four-layer pipeline (RPC → loaders → pure `derive` → UI). The derivation layer is well-modelled and well-tested; the **edges live at the seams** — where a loader decides what facts to pass, where an RPC error string is (or is not) mapped to calm copy, and where the home dashboard re-derives status independently of the card route.

| Metric                                           | Count                                                 |
| ------------------------------------------------ | ----------------------------------------------------- |
| Journey segments audited                         | 7 (QR, join, stamp, card, reward, OTP-redirect, home) |
| Scenarios catalogued                             | 51                                                    |
| Gaps found                                       | 14                                                    |
| — P0 (confusion / wrong action / alarming error) | **2**                                                 |
| — P1 (correct block but poor UX / untested path) | **4**                                                 |
| — P2 (ops / data-edge / drift / hygiene)         | **8**                                                 |
| Stamp/redeem RPC exceptions inventoried          | 24 (12 stamp, 12 redeem)                              |
| Customer test baseline                           | 115 passed / 1 failed (pre-existing, non-customer)    |

**The two findings that matter most:**

1. **P0 — Unmapped stamp RPC errors throw the customer to a "Card unavailable" full-page error boundary.** The production block-reason mapper [`blockedReason()`](lib/customer/stamp.ts:200) does **not** recognise `Rate limit exceeded` or `At least 3 active reward pool items are required…`. Both cause [`issueSelfServiceStamp`](lib/customer/stamp.ts:46) to `throw`, and [`selfStampAction`](app/card/[membershipId]/actions.ts:35) has no try/catch — so a transient rate-limit, or a merchant with fewer than 3 active rewards, shows the customer an **alarming and wrong** "This card could not be loaded safely" page on what is actually a healthy card (and on the rate-limit case, the card is perfectly fine).

2. **P1 — Two divergent block-reason mappers; the well-tested one is dead in production.** [`block-reasons.ts`](lib/customer/experience/block-reasons.ts) (`toStampBlockReason` + `blockReasonCopy`) carries the "single source of truth" docstring and all the unit tests, but it is imported **only by tests**. Production copy comes from the untested duplicate [`blockedReason()`](lib/customer/stamp.ts:200). This duplication is the root cause of finding #1 and a standing drift hazard.

Everything else is either correct-but-rough (home tile hides waiting rewards; cancelled-billing offers a doomed stamp CTA) or ops/data-edge hardening.

---

## 2. Architecture & decision rules

### 2.1 The four-layer pipeline

```
Postgres RPCs ──▶ Loaders (load-*.ts) ──▶ deriveCustomerExperience ──▶ UI panels + Home
issue_self_service_stamp   facts only        pure, no DB              copy + CTAs
redeem_self_service_reward                    priorities.ts
```

**Source-of-truth rule for this audit:** the RPC is authoritative. A loader/derive/UI decision is a _gap_ when it is **more permissive** than the RPC (offers an action the RPC will reject) or **silently stricter** in a way the customer can't recover from. When they merely differ in wording, that is drift (P2).

### 2.2 Route priority tables ([`priorities.ts`](lib/customer/experience/priorities.ts))

| Route         | Priority order (first wins)                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `card` / `qr` | `unavailable` → `card_collecting`                                                                  |
| `stamp`       | `unavailable` → **`reward_ready`** → **`reward_waiting`** → `card_stamped_today` → `stamp_confirm` |
| `reward`      | `unavailable` → `redeemed_proof` → `reward_ready` → `reward_waiting`                               |
| `join`        | `unavailable` → `join_returning` → `join_terms` → `join_otp` → `join_phone` → `join_welcome`       |

**Key invariant:** on the stamp route, a reward (ready or waiting) **always outranks** a stamp confirm. A full card never offers another stamp through the UI — it routes to the reward. (The RPC enforces the same with `A reward is already ready to redeem`.)

### 2.3 Two independent billing dimensions

There are **two distinct status columns**, both `text` CHECK constraints (not Postgres enums), defined in [`20260606142000_initial_schema_rls.sql`](supabase/migrations/20260606142000_initial_schema_rls.sql):

- `merchants.status` ∈ {`trial`, `active`, `paused`, `cancelled`, `suspended`} (default `trial`)
- `billing_customers.status` ∈ {`trialing`, `active`, `past_due`, `cancelled`, `suspended`} (default `trialing`)

The name overlap (`cancelled`/`suspended` appear in both) is a trap — they are different columns with different downstream handling. See §4 for the full matrix.

---

## 3. Scenario catalog

51 scenarios across the seven segments. `Derived kind` is the `CustomerExperience["kind"]` the customer resolves to. `RPC if action` is what the relevant RPC would do if the customer acted. **Gap** column references the IDs in §5.

### 3.1 QR resolve — `/q/[qrId]` ([page.tsx](app/q/[qrId]/page.tsx))

| ID  | Preconditions                              | Derived outcome                                    | Customer sees                           | RPC if action | Test ref                                                                   | Gap     |
| --- | ------------------------------------------ | -------------------------------------------------- | --------------------------------------- | ------------- | -------------------------------------------------------------------------- | ------- |
| Q1  | Active QR, no membership                   | redirect → `/m/{slug}/join?qr=`                    | Join welcome                            | n/a           | `customer.test` "records QR scan analytics at the public resolver"         | —       |
| Q2  | Active QR, existing membership             | redirect → `/card/{id}/stamp?qr=`                  | Stamp confirm                           | n/a           | (resolver redirect implicit)                                               | —       |
| Q3  | Inactive / unknown QR                      | `UnavailableQr` panel                              | "This loyalty card is unavailable"      | n/a           | `customer.test` QR coupling test                                           | —       |
| Q4  | QR on suspended merchant/billing           | `resolveQrForJoin` → unavailable → `UnavailableQr` | "unavailable"                           | n/a           | `customer.test` "QR join context as unavailable when billing is suspended" | —       |
| Q5  | QR resolve rate-limited (`RateLimitError`) | `UnavailableQr` (same as dead QR)                  | "Card unavailable / ask the venue team" | n/a           | none                                                                       | **G10** |

### 3.2 Join — `/m/[slug]/join` ([deriveJoin](lib/customer/experience/derive.ts:283))

| ID  | Preconditions                    | Derived kind                                                                 | Customer sees                                        | RPC if action                                                                                          | Test ref                                              | Gap     |
| --- | -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------- |
| J1  | `qrId`, no session, `step≠phone` | `join_welcome`                                                               | "Keep your card on your phone" + "Get today's stamp" | n/a                                                                                                    | `customer-experience.test` "welcomes a fresh QR scan" | —       |
| J2  | `step=phone`                     | `join_phone`                                                                 | Phone field, "Text me the code"                      | `requestCustomerIdentityAction`                                                                        | "advances to the phone form when step=phone"          | —       |
| J3  | Direct join, no `qrId`           | `join_phone` (welcome skipped)                                               | Phone form                                           | —                                                                                                      | "skips welcome for a direct join with no QR"          | —       |
| J4  | `pendingOtp`                     | `join_otp`                                                                   | OTP field, "Save my card"                            | `verifyCustomerOtpAction`                                                                              | "shows the OTP step while a verification is pending"  | —       |
| J5  | `hasSession` (verified)          | `join_terms`                                                                 | Terms + "Get my first stamp"                         | `joinRewardsAction` → join-with-first-stamp                                                            | "asks a verified customer to accept terms"            | —       |
| J6  | Existing membership at merchant  | `join_returning`                                                             | "You're already joined" + "Open your stamp card"     | n/a                                                                                                    | "sends a returning member to their card"              | —       |
| J7  | Join context unavailable         | `unavailable`                                                                | "This loyalty card is unavailable."                  | n/a                                                                                                    | "shows unavailable when the card cannot be joined"    | —       |
| J8  | **Billing `cancelled`** at join  | likely `join_*` (proceeds) → first stamp swallowed by join exception handler | Joins, lands on 0-stamp card silently                | RPC inside join raises, **caught** by `begin…exception` in `join_customer_membership_with_first_stamp` | none (only `suspended` tested)                        | **G11** |
| J9  | Marketing checkbox unchecked     | `join_terms` → join succeeds, no consent row                                 | Card created                                         | `joinRewardsAction`                                                                                    | `customer.test` "separate marketing consent"          | —       |

### 3.3 Stamp — `/card/[id]/stamp?qr=` ([loadStamp](lib/customer/experience/load-stamp.ts) + [deriveStamp](lib/customer/experience/derive.ts:172))

| ID  | Preconditions                                                          | Derived kind                                              | Customer sees                                                                | RPC if action                                                                                        | Test ref                                                                                                 | Gap         |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| S1  | Valid QR, not stamped, not full, no reward                             | `stamp_confirm`                                           | "Add today's stamp"                                                          | issues stamp + increments                                                                            | `customer-experience.test` "confirms a stamp when the QR is valid"; `self-service-stamping` MS-06        | —           |
| S2  | Already stamped this UK day                                            | `card_stamped_today`                                      | "You're stamped for today"                                                   | `Stamp already issued for this UK business day` → calm                                               | "prefers the calm already-stamped panel"; `self-service-stamping` "maps duplicate business-day stamping" | —           |
| S3  | **Full card + redeemable reward**                                      | `reward_ready`                                            | Reward QR / profile gate                                                     | n/a (no stamp)                                                                                       | "prefers a ready reward over a valid stamp QR"                                                           | —           |
| S4  | Full card + reward in overnight hold                                   | `reward_waiting`                                          | "Give it a day to breathe"                                                   | n/a                                                                                                  | "waits on an unlocked-but-not-redeemable reward"                                                         | —           |
| S5  | No QR in URL (`qrMissing`)                                             | `unavailable`                                             | "Open this screen from the printed venue QR…"                                | n/a                                                                                                  | `self-service-stamping` "blocks direct card-page stamp attempts"                                         | —           |
| S6  | Invalid / wrong-merchant QR (`qrContext` null)                         | `unavailable`                                             | "Scan the venue code again to add your stamp."                               | n/a                                                                                                  | "asks the customer to re-scan an invalid QR"                                                             | —           |
| S7  | Unauthenticated                                                        | `unavailable` + `recovery.loginHref`                      | "Verify your identity…" + "Open my cards"                                    | n/a                                                                                                  | "routes an access problem to unavailable with recovery"                                                  | —           |
| S8  | Wrong customer (membership owned by another)                           | `unavailable` "belongs to another customer"               | recovery panel                                                               | n/a (blocked at `getCustomerCardState`)                                                              | **partial** (derive only)                                                                                | **G(test)** |
| S9  | Membership not found                                                   | `unavailable` "could not be found"                        | recovery panel                                                               | n/a                                                                                                  | partial                                                                                                  | **G(test)** |
| S10 | Merchant not active / card not active / billing **`suspended`**        | `unavailable` (via `unavailableReason`)                   | "not currently active" / "unavailable at the moment"                         | RPC also blocks                                                                                      | partial                                                                                                  | —           |
| S11 | **Billing `cancelled`**                                                | **`stamp_confirm`** (loader never checks `stampsBlocked`) | "Add today's stamp" (doomed CTA)                                             | `This merchant loyalty programme is unavailable` → calm inline "Stamp not added"                     | none                                                                                                     | **G3**      |
| S12 | **Rate limit exceeded** (>10 stamps / 15 min / membership) on submit   | `stamp_confirm`, then submit                              | **Full-page "Card unavailable" error boundary**                              | `Rate limit exceeded` → **unmapped → throws**                                                        | none                                                                                                     | **G1 / G4** |
| S13 | **Reward pool < 3 active items on FINAL stamp**                        | `stamp_confirm`, then submit                              | **Full-page "Card unavailable" error boundary**; reward never unlocks        | `At least 3 active reward pool items…` → **unmapped → throws**                                       | **partial** (migration-text grep only)                                                                   | **G2 / G4** |
| S14 | Geo denied / out of range, `require_geofence=true`                     | `stamp_confirm` → issued                                  | Stamp added + "Location could not be confirmed, so the venue may review it." | issues + writes `fraud_flags` (never blocks)                                                         | partial (mocked returns)                                                                                 | **G(test)** |
| S15 | **count ≥ required but no `unlocked` reward row** (data inconsistency) | `stamp_confirm` (loader sees no unlocked reward)          | "Add today's stamp", then block                                              | `A reward is already ready to redeem` → calm copy pointing at a reward that doesn't exist → dead end | none                                                                                                     | **G6**      |
| S16 | Form bypass: submit with no/forged QR                                  | n/a (action guard)                                        | "Scan the venue code to add your stamp."                                     | guarded before RPC                                                                                   | `self-service-stamping` "requires a fresh venue QR context"                                              | —           |

### 3.4 Card — `/card/[id]` ([loadCard](lib/customer/experience/load-card.ts) + [deriveCard](lib/customer/experience/derive.ts:133))

| ID  | Preconditions                                               | Derived kind                                    | Customer sees                                                               | Test ref                                                      | Gap                                |
| --- | ----------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| C1  | Collecting, no reward                                       | `card_collecting` reward=`none`                 | Grid + sealed reward + "Scan the venue code to add your stamp."             | `customer-experience.test` "collecting card with no reward"   | —                                  |
| C2  | Collecting + reward in overnight hold                       | `card_collecting` reward=`waiting`              | "Give it a day to breathe" band, no QR                                      | "marks a reward waiting when unlocked but not yet redeemable" | —                                  |
| C3  | Full + redeemable reward                                    | `card_collecting` reward=`ready`                | "Open reward QR" → `/reward/{id}`                                           | "marks a reward ready when redeemable"                        | —                                  |
| C4  | `?stamp=issued`                                             | celebration + "Stamp added." / "Stamp secured." | Slam animation                                                              | "sets the slam index only on the just-stamped visit"          | —                                  |
| C5  | `?welcome=1` (just joined)                                  | "Welcome to {merchant}."                        | Headline flip                                                               | "flags a freshly joined card for the welcome celebration"     | —                                  |
| C6  | `?reward=redeemed`                                          | "Reward redeemed. New stamp cycle started."     | success banner                                                              | `reward-redemption-cycles` cycle read models                  | —                                  |
| C7  | `?geo=flagged`                                              | appended "Location could not be confirmed…"     | calm note                                                                   | partial                                                       | —                                  |
| C8  | **Billing `cancelled`**                                     | `card_collecting` `stampsBlocked=true`          | "Stamps unavailable / This merchant is not accepting new stamps right now." | none                                                          | **G3** (card side handled, weakly) |
| C9  | Merchant not active / card not active / billing `suspended` | `unavailable`                                   | calm reason                                                                 | partial                                                       | —                                  |
| C10 | Unauth / unauthorized / not_found                           | `unavailable` (+recovery if unauth)             | recovery panel                                                              | "routes an access problem to unavailable with recovery"       | —                                  |
| C11 | count ≥ required, no unlocked reward (inconsistency)        | `card_collecting` reward=`none`                 | Full grid **+ sealed reward + "scan to add stamp"** (contradictory)         | none                                                          | **G6**                             |

### 3.5 Reward — `/reward/[id]` ([loadReward](lib/customer/experience/load-reward.ts) + [deriveReward](lib/customer/experience/derive.ts:234))

> The customer reward route is **passive** — it never calls `redeem_self_service_reward`. Redemption is merchant-side (counter scans the QR → [`reward-collection.ts`](lib/merchant/reward-collection.ts)). So redeem RPC exceptions surface on the **merchant's** screen; the customer's worst case is a reward that stays "ready" while the merchant sees the error. The customer-side profile gate and overnight-hold are pre-emptive backstops that stop the customer from ever showing a QR the redeem RPC would reject (except the cancelled-billing case, G7).

| ID  | Preconditions                                               | Derived kind                                                        | Customer sees                                                              | Redeem RPC (merchant scan)                                  | Test ref                                                         | Gap            |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | -------------- |
| R1  | status `redeemed` (or `?redeemed=1`)                        | `redeemed_proof`                                                    | "Reward collected."                                                        | idempotent no-op success                                    | "shows the redeemed proof after redemption"                      | —              |
| R2  | unlocked + redeemable + profile complete                    | `reward_ready`                                                      | "Ready for merchant scan" + QR                                             | succeeds                                                    | "shows ready reward with the redeem form context"                | —              |
| R3  | unlocked + redeemable + profile **incomplete**              | `reward_ready` + `CustomerProfileGateForm`                          | "Add your details before collection" (Name + DOB, optional verified email) | `Complete your profile before redeeming` (backstop)         | `reward-profile-gate` (full) + SQL `profile_completion_gate.sql` | —              |
| R4  | unlocked + not yet redeemable (overnight hold)              | `reward_waiting`                                                    | "from opening time tomorrow"                                               | `…not redeemable until the next UK business day` (backstop) | "waits on an unlocked reward that is not redeemable yet"         | **G12** (copy) |
| R5  | unauth / unauthorized / not_found                           | `unavailable`                                                       | recovery / "belongs to another customer" / "could not be found"            | n/a                                                         | unauth partial; wrong-customer covered on merchant scan path     | **G(test)**    |
| R6  | merchant not active / card not active / billing `suspended` | `unavailable` (redeemable forced false)                             | calm reason                                                                | RPC also blocks                                             | partial                                                          | —              |
| R7  | **Billing `cancelled`**                                     | `reward_ready` (reward.ts `unavailableMessage` ignores `cancelled`) | Shows ready QR                                                             | merchant scan → `…unavailable` → fails at counter           | none                                                             | **G7**         |
| R8  | status `cancelled` / `expired`                              | `unavailable` "This reward is no longer available."                 | calm                                                                       | `Reward is not redeemable` (backstop)                       | partial                                                          | —              |

### 3.6 OTP returning-redirect — [`destinationForReturningQrVisit`](lib/customer/returning-qr-redirect.ts)

| ID  | Preconditions                                         | Outcome                                                                    | Test ref                                                              | Gap               |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| O1  | No membership at merchant                             | `null` (join continues)                                                    | "returns null when the customer has no membership"                    | —                 |
| O2  | `issueStamp=false`                                    | → stamp-confirm path                                                       | "routes a returning QR visit to stamp confirm without auto-issuing"   | —                 |
| O3  | `qrContext` null                                      | → card path                                                                | partial                                                               | —                 |
| O4  | **Unlocked + redeemable reward**                      | → `/reward/{id}`                                                           | **none** (code present, untested)                                     | **G13**           |
| O5  | **Unlocked + waiting reward**                         | → card path                                                                | **none** (code present, untested)                                     | **G13**           |
| O6  | Issue succeeds (incl. geo flag)                       | → `/card?stamp=issued[&geo=flagged]`                                       | "issues today's stamp after OTP…"; "passes OTP-captured coordinates…" | —                 |
| O7  | Issue blocked "already stamped"                       | → stamp path                                                               | "routes an already-stamped customer to the stamped-today screen"      | —                 |
| O8  | **Issue throws (rate-limit / pool<3 on final stamp)** | **uncaught throw** — no try/catch around `issueSelfServiceStamp` (line 72) | none                                                                  | **G1 / G2 / G13** |

### 3.7 Home — `/home` ([getCustomerHomeDashboard](lib/customer/home.ts), [homeCardStatusCopy](lib/customer/home-dashboard.ts:30))

| ID  | Preconditions                             | Tile status text                                                                                 | Tile link                                         | Test ref                                                       | Gap         |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| H1  | Redeemable reward (`primaryRewardId` set) | "Reward ready - show QR at the counter"                                                          | `/reward/{id}`                                    | "sorts redeemable cards above…"; "status copy for redeemable…" | —           |
| H2  | **Waiting reward + stamped today**        | **"Stamp secured for today"** (waiting reward invisible except "Reward soon" badge)              | `/card/{id}`                                      | none                                                           | **G5**      |
| H3  | **Waiting reward, not stamped**           | **"{n} of {m} stamps…"** (waiting reward invisible)                                              | `/card/{id}`                                      | none                                                           | **G5**      |
| H4  | Stamped today, no reward                  | "Stamp secured for today"                                                                        | `/card/{id}`                                      | "status copy for … stamped …"                                  | —           |
| H5  | Collecting                                | "{n} of {m} stamps - {r} more to unlock"                                                         | `/card/{id}`                                      | "status copy for … collecting …"                               | —           |
| H6  | Unavailable (merchant/card/`suspended`)   | `unavailableReason`                                                                              | `/card/{id}`                                      | "status copy for … unavailable cards"                          | —           |
| H7  | **Billing `cancelled`**                   | Normal status (home uses `unavailableMessage` → `available=true`); **no block indicator at all** | `/card/{id}`                                      | none                                                           | **G3 / G7** |
| H8  | No memberships                            | Empty dashboard                                                                                  | n/a                                               | (empty path)                                                   | —           |
| H9  | Membership count lags stamp events        | reconciled from stamp events                                                                     | "reconciles home card progress from stamp events" | —                                                              |

---

## 4. Billing & programme health matrix

What each customer surface does for each status value, vs. what the RPC does. **✅ consistent · ⚠️ handled but rough · ❌ diverges from RPC**.

### `merchants.status`

| Value       | Card route  | Stamp route | Join        | Reward      | Home tile   | RPC (stamp/redeem) | Verdict |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ------------------ | ------- |
| `trial`     | allow       | allow       | allow       | allow       | allow       | allow              | ✅      |
| `active`    | allow       | allow       | allow       | allow       | allow       | allow              | ✅      |
| `paused`    | unavailable | unavailable | unavailable | unavailable | unavailable | block "not active" | ✅      |
| `cancelled` | unavailable | unavailable | unavailable | unavailable | unavailable | block "not active" | ✅      |
| `suspended` | unavailable | unavailable | unavailable | unavailable | unavailable | block "not active" | ✅      |

### `billing_customers.status`

| Value           | Card route                     | Stamp route                   | Join              | Reward                 | Home tile        | RPC (stamp/redeem)      | Verdict                                                 |
| --------------- | ------------------------------ | ----------------------------- | ----------------- | ---------------------- | ---------------- | ----------------------- | ------------------------------------------------------- |
| `trialing`      | allow                          | allow                         | allow             | allow                  | allow            | allow                   | ✅                                                      |
| `active`        | allow                          | allow                         | allow             | allow                  | allow            | allow                   | ✅                                                      |
| `past_due`      | allow                          | allow                         | allow             | allow                  | allow            | **allow** (not blocked) | ✅ intentional — customer flow unaffected by `past_due` |
| `suspended`     | unavailable                    | unavailable                   | unavailable       | unavailable            | unavailable      | block "unavailable"     | ✅                                                      |
| **`cancelled`** | ⚠️ `stampsBlocked` notice only | **❌ offers `stamp_confirm`** | ❌ proceeds (G11) | ❌ shows ready QR (G7) | ❌ normal status | **block "unavailable"** | **❌ diverges (G3/G7/G11)**                             |

**The single structural billing gap is `billing_customers.status = 'cancelled'`.** The RPC blocks it, but [`unavailableMessage`](lib/customer/card.ts:170) only treats `suspended` as unavailable. The card route papers over this with a `stampsBlocked` notice ([load-card.ts:115](lib/customer/experience/load-card.ts:115)); every other surface (stamp, join, reward, home) is silently more permissive than the RPC. `past_due` being allowed everywhere is intentional and correct.

---

## 5. Gap register

| ID      | Title                                                                                     | Layer(s)        | Severity | Evidence                                                                                                                                                                                                     | Recommendation (deferred)                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1**  | Rate-limit stamp error throws to "Card unavailable" error boundary                        | mapper / action | **P0**   | [`blockedReason`](lib/customer/stamp.ts:200) has no `Rate limit exceeded` branch → returns null → [throw](lib/customer/stamp.ts:46); [`selfStampAction`](app/card/[membershipId]/actions.ts:35) no try/catch | Map `Rate limit exceeded` → calm "You're going a little fast — try again in a few minutes." Keep it an inline blocked result, not a throw.                                 |
| **G2**  | Reward pool < 3 on final stamp throws to error boundary; reward never unlocks             | mapper / RPC    | **P0**   | RPC `At least 3 active reward pool items are required before unlocking a reward` (final-stamp branch, [20260616103000](supabase/migrations/20260616103000_minimum_three_rewards.sql)) unmapped → throw       | Map to calm "Almost there — the venue is finalising rewards. Ask the team." AND surface a merchant-side health warning when active rewards < 3.                            |
| **G3**  | Cancelled billing offers a doomed stamp CTA; inconsistent across routes                   | loaders         | **P1**   | [load-stamp.ts](lib/customer/experience/load-stamp.ts) never reads `billingStatus`/`stampsBlocked`; card route does ([load-card.ts:115](lib/customer/experience/load-card.ts:115))                           | Make `unavailableMessage` (or the loaders) treat `cancelled` the same as `suspended`, or have the stamp loader honour `stampsBlocked` and derive `unavailable`.            |
| **G4**  | Duplicate, drifting block-reason mappers; tested one is dead in production                | mapper          | **P1**   | [`block-reasons.ts`](lib/customer/experience/block-reasons.ts) imported only by tests; production uses [`blockedReason`](lib/customer/stamp.ts:200)                                                          | Delete `blockedReason`; route production through `toStampBlockReason` + `blockReasonCopy`. Add the missing reasons (`rate_limited`, `pool_unavailable`) once consolidated. |
| **G5**  | Home tile hides a waiting reward behind "Stamp secured" / stamps copy                     | home            | **P1**   | [`homeCardStatusCopy`](lib/customer/home-dashboard.ts:30) has no waiting branch; [`primaryRewardId`](lib/customer/home-rewards.ts:36) set only for redeemable                                                | Add a waiting branch: "Reward almost ready - back tomorrow." Consider sorting waiting-reward cards above plain collectors.                                                 |
| **G6**  | count ≥ required but no `unlocked` reward row → contradictory card + dead-end stamp block | loader / derive | **P2**   | [load-card.ts:97](lib/customer/experience/load-card.ts:97) reward=null at full count; stamp route → RPC "reward already ready" with no reward                                                                | Detect `current ≥ total && reward == null`; derive a recoverable `unavailable` ("We're sorting your reward — check back shortly") instead of inviting a stamp.             |
| **G7**  | Cancelled billing shows a ready reward QR; merchant scan then fails                       | reward loader   | **P2**   | [reward.ts](lib/customer/reward.ts:173) private `unavailableMessage` ignores `cancelled`                                                                                                                     | Fold into the G3 fix (single `unavailableMessage` that includes `cancelled`).                                                                                              |
| **G8**  | Dead `StampBlockReason` types (`invalid_qr`, `expired_qr`, `wrong_merchant`)              | types           | **P2**   | Defined in [types.ts:26](lib/customer/experience/types.ts:26) with copy in [block-reasons.ts:50](lib/customer/experience/block-reasons.ts:50); never produced by the mapper (QR problems use `unavailable`)  | Remove the three unused variants and their copy, or wire them up if QR-specific block copy is wanted.                                                                      |
| **G9**  | `unavailableMessage` duplicated in `card.ts` and `reward.ts`                              | hygiene         | **P2**   | [card.ts:170](lib/customer/card.ts:170) (exported) vs [reward.ts:173](lib/customer/reward.ts:173) (private copy)                                                                                             | Import the one in `card.ts` from `reward.ts`; delete the duplicate.                                                                                                        |
| **G10** | Rate-limited QR scan looks identical to a dead QR                                         | QR page         | **P2**   | [page.tsx:29](app/q/[qrId]/page.tsx:29) maps `RateLimitError` to the same `UnavailableQr`                                                                                                                    | Distinct calm copy for rate-limit ("Too many scans just now — try again shortly") to aid support triage.                                                                   |
| **G11** | Cancelled billing during join; first stamp silently swallowed → 0-stamp card              | join RPC        | **P2**   | `join_customer_membership_with_first_stamp` ([20260614120000](supabase/migrations/20260614120000_join_with_first_stamp.sql)) wraps stamp issue in `begin…exception when others`                              | Surface `first_stamp_issued=false` to the customer ("You're in — collect your first stamp at the counter") rather than implying a stamp landed.                            |
| **G12** | "from opening time tomorrow" overstates timing across weekends/holidays                   | copy            | **P2**   | `redeemable_from = next_uk_business_date` skips Sat/Sun; waiting copy says "tomorrow"                                                                                                                        | Render the real `redeemable_from` date or say "the next opening day" instead of "tomorrow".                                                                                |
| **G13** | OTP auto-stamp path: reward branches untested; `issueSelfServiceStamp` can throw uncaught | redirect        | **P1**   | [returning-qr-redirect.ts:61-72](lib/customer/returning-qr-redirect.ts:61) — reward-ready/waiting branches have no test; line 72 throw uncaught                                                              | Add tests for O4/O5/O8; wrap the issue call so a throw degrades to the stamp path rather than erroring the OTP action.                                                     |
| **G14** | Doc drift: `docs/CUSTOMER_FLOW.md` (wallet) vs implemented `/home` dashboard              | docs            | **P2**   | Out of scope to reconcile here (per plan)                                                                                                                                                                    | Track in a docs slice; confirm whether "wallet" naming still matches `/home`.                                                                                              |

**Test-only coverage gaps** (no production defect, but unverified paths) are tagged `G(test)` in §3 and consolidated in §6: wrong-customer / not-found on the customer stamp & reward routes, real geo-decision tests, and same-UK-day re-stamp after redemption.

---

## 6. Test coverage matrix

### 6.1 Test file → layer

| Test file                                                                                | Layer it exercises                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [customer-experience.test.ts](tests/micro-specs/customer-experience.test.ts)             | Pure `derive` + priorities + view-model + block-reason **typed** mapping |
| [returning-qr-redirect.test.ts](tests/micro-specs/returning-qr-redirect.test.ts)         | OTP redirect orchestrator (mocked deps)                                  |
| [self-service-stamping.test.ts](tests/micro-specs/self-service-stamping.test.ts)         | Stamp RPC (mocked) + action contract + migration-text greps              |
| [customer.test.ts](tests/micro-specs/customer.test.ts)                                   | Join/card/reward/QR/rate-limit integration (mocked) + rendered copy      |
| [customer-home.test.ts](tests/micro-specs/customer-home.test.ts)                         | Home sort / summary / status copy + dashboard integration                |
| [customer-stamp-loader.test.ts](tests/micro-specs/customer-stamp-loader.test.ts)         | Stamp loader location-gate                                               |
| [reward-redemption-cycles.test.ts](tests/micro-specs/reward-redemption-cycles.test.ts)   | Cycle read-models + migration-text greps                                 |
| [merchant-scanned-reward.test.ts](tests/micro-specs/merchant-scanned-reward.test.ts)     | Merchant-side redeem RPC + ownership                                     |
| [reward-profile-gate.test.ts](tests/micro-specs/reward-profile-gate.test.ts)             | Profile-completion rule + gate + profile save action                     |
| [customer-facing-gap-fixes.test.ts](tests/micro-specs/customer-facing-gap-fixes.test.ts) | No-self-redeem, neutral login, funnel events (mostly greps)              |
| [profile_completion_gate.sql](supabase/tests/profile_completion_gate.sql)                | SQL invariant — redeem profile gate (4 branches)                         |
| [reward_redemption_cycles.sql](supabase/tests/reward_redemption_cycles.sql)              | SQL invariant — cycle reset, default-reward pin, idempotent redeem       |

### 6.2 Edge-case heatmap (scenario → tier)

`✅ covered · 🟡 partial · ❌ missing`

| Edge case                                                      | SQL invariant  | Unit `derive`    | Loader/RPC integ.                         | Verdict |
| -------------------------------------------------------------- | -------------- | ---------------- | ----------------------------------------- | ------- |
| Full card + QR → reward, not stamp (S3)                        | —              | ✅               | ✅ (RPC `reward_ready_first`)             | ✅      |
| Daily duplicate stamp (S2)                                     | —              | ✅               | ✅                                        | ✅      |
| Profile-incomplete gate at reward-ready (R3)                   | ✅             | ✅               | ✅                                        | ✅      |
| Reward overnight hold / waiting (S4/R4/C2)                     | —              | ✅               | 🟡                                        | ✅      |
| Cycle reset after redemption (C6)                              | ✅             | —                | ✅                                        | ✅      |
| **Rate-limit → calm copy (S12)**                               | —              | ❌               | ❌                                        | **❌**  |
| **Pool < 3 on final stamp (S13)**                              | ❌ (grep only) | ❌               | ❌                                        | **❌**  |
| **Billing on stamp route (S11)**                               | —              | ❌               | ❌                                        | **❌**  |
| **Billing on redeem**                                          | —              | —                | ❌                                        | **❌**  |
| Billing on join (J7/J8)                                        | —              | —                | 🟡 (`suspended` only)                     | 🟡      |
| Billing on card view (C8/C9)                                   | —              | —                | 🟡 (`active` only)                        | 🟡      |
| Geo soft-flag — stamp (S14)                                    | ❌             | —                | 🟡 (mocked returns)                       | 🟡      |
| **Geo soft-flag — redeem**                                     | ❌             | —                | ❌                                        | **❌**  |
| **Data inconsistency: full count, no reward (S15/C11)**        | —              | ❌               | ❌                                        | **❌**  |
| **OTP redirect: reward-ready/waiting branch (O4/O5)**          | —              | —                | ❌                                        | **❌**  |
| Same-UK-day re-stamp after redemption                          | 🟡             | —                | 🟡                                        | 🟡      |
| Wrong-customer / not-found on stamp & reward routes (S8/S9/R5) | —              | 🟡 (unauth only) | 🟡 (wrong-_merchant_ only, merchant path) | 🟡      |

**Honest read:** the derive layer and the profile/cycle invariants are genuinely well covered. The **edges are not**: rate-limit, pool-minimum-at-runtime, billing on stamp/redeem, geo-on-redeem, the data-inconsistency state, and the OTP reward branch have **no** test exercising them. Several are exactly the P0/P1 gaps above — they are untested _because_ the behaviour is wrong (a thrown error has no calm assertion to write).

---

## 7. EARS traceability

All four customer specs are `active`, owner `factory-droid`, last reviewed 2026-06-15. Statuses below: **✅ satisfied · 🟡 partial (gap noted) · ❌ unmet**.

### 03-customer/01 — QR Resolver & Join (`MS-CUSTOMER-QR-RESOLVER-JOIN`)

| Req | Statement (abbrev.)                                             | Scenario | Status |
| --- | --------------------------------------------------------------- | -------- | ------ |
| 001 | Active QR → server-side lookup                                  | Q1/Q2    | ✅     |
| 002 | Inactive/unknown QR → unavailable                               | Q3       | ✅     |
| 003 | Active QR → record `qr_scanned`                                 | Q1       | ✅     |
| 004 | Unauth at join → phone verify (IP-country default, GB fallback) | J2       | ✅     |
| 005 | Accept terms + verify → create/reuse profile + membership       | J5       | ✅     |
| 006 | No opt-in → no marketing consent                                | J9       | ✅     |
| 007 | Opt-in → consent with source + policy version                   | J9       | ✅     |
| 008 | Returning member → existing card, no duplicate                  | J6 / Q2  | ✅     |

### 03-customer/02 — Digital Stamp Card (`MS-CUSTOMER-DIGITAL-STAMP-CARD`)

| Req | Statement (abbrev.)                                        | Scenario | Status                                     |
| --- | ---------------------------------------------------------- | -------- | ------------------------------------------ |
| 001 | Pre-unlock → count, target, sealed teaser                  | C1       | ✅                                         |
| 002 | Unlocked → reward from `reward_events`, not mutable card   | R2       | ✅                                         |
| 003 | Not authorized → deny access                               | S8/C10   | 🟡 (untested on customer routes — G(test)) |
| 004 | Plain card page → "scan the venue code"                    | S5       | ✅                                         |
| 005 | Valid QR context → self-service add-stamp                  | S1       | ✅                                         |
| 006 | GPS review → request location, **never block**             | S14      | ✅ (logic) / 🟡 (test)                     |
| 007 | Enough stamps but `redeemable_from` future → come-back msg | C2/R4    | ✅                                         |
| 008 | Reward ready → show as ready                               | C3/R2    | ✅                                         |
| 009 | Redeemed → not redeemable again                            | R1       | ✅                                         |

### 04-staff-rewards/01 — Self-Service Stamp Issuing (`MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING`)

| Req | Statement (abbrev.)                                    | Scenario | Status                                                                  |
| --- | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------- |
| 001 | Existing member scans → stamp-confirm w/ QR context    | Q2/S1    | ✅                                                                      |
| 002 | All checks pass → `stamp_events` + increment           | S1       | ✅                                                                      |
| 003 | In range → issue, no geo flag                          | S14      | ✅ / 🟡 test                                                            |
| 004 | Out of radius → issue + fraud flag                     | S14      | 🟡 (no real-geo test)                                                   |
| 005 | Denied/unavailable → issue + fraud flag                | S14      | 🟡                                                                      |
| 006 | Already stamped this UK day → reject w/ safe copy      | S2       | ✅                                                                      |
| 007 | Completes target → select 1 active pool item by weight | C3       | ✅ (note: now needs ≥3 active — G2)                                     |
| 008 | Billing cancelled/suspended → block per billing rules  | S11      | 🟡 **`suspended` ✅ via loader; `cancelled` ❌ leaks past loader → G3** |
| 009 | Stamp issued → `stamp_issued` product event + audit    | S1       | ✅                                                                      |

### 04-staff-rewards/02 — Reward Unlock & Redemption (`MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION`)

| Req | Statement (abbrev.)                                           | Scenario | Status                          |
| --- | ------------------------------------------------------------- | -------- | ------------------------------- |
| 001 | Reach required count → exactly one reward event               | C3       | ✅                              |
| 002 | Open before `redeemable_from` → reward + come-back, no redeem | R4       | ✅                              |
| 003 | Open redeemable → name, terms, redeem action                  | R2       | ✅                              |
| 004 | Pool edited after assignment → persisted reward unchanged     | R2       | ✅ (`reward-redemption-cycles`) |
| 005 | Redeem + checks pass → mark redeemed once                     | R2       | ✅                              |
| 006 | Re-attempt → reject/replay safely                             | R1       | ✅ (idempotent)                 |
| 007 | Redemption success → update totals, start next cycle          | C6       | ✅                              |
| 008 | Success/security failure → audit/product events               | R2       | ✅                              |

**EARS-level findings:**

- **Req 04-01-008 (billing block) is only partially met** — `cancelled` billing is not blocked before the customer is invited to stamp (G3). This is the one EARS requirement with a concrete behavioural gap.
- **No EARS requirement exists for**: the profile-completion gate (tested but untraceable to a SHALL), rate-limiting, the reward-pool **minimum** (only "select one" is specified — the _minimum-3 block_ has no SHALL), and geo-soft-flag on **redeem**. These are traceability holes worth a spec touch-up alongside any fix.

---

## 8. Remediation backlog (implementation deferred)

### P0 — fix first (customer sees a wrong/alarming state)

1. **Map `Rate limit exceeded` to calm, inline copy** (G1) — and stop it from throwing.
2. **Map the reward-pool-minimum error to calm copy** (G2) — plus a merchant health nudge when active rewards < 3, so the customer's final stamp never dead-ends on a misconfiguration.
   - Both are unblocked by **consolidating the mappers** (G4) — do that first so there is one place to add them.

### P1 — fix next (correct block, poor UX / untested)

3. **Single `unavailableMessage` that treats `cancelled` like `suspended`** (G3 + G7 + G9) — removes the doomed stamp CTA and the merchant-scan-fails-on-ready-QR case in one change.
4. **Retire `blockedReason`; route production through the tested typed mapper** (G4).
5. **Add a waiting-reward branch to `homeCardStatusCopy`** and reconsider home sort (G5).
6. **OTP redirect: test O4/O5, guard the issue call against throws** (G13).

### P1 — tests to add alongside the fixes

- Rate-limit → calm copy (S12); pool-<3 runtime block at final stamp (S13).
- Billing `cancelled` on stamp/join/reward/home (S11/J8/R7/H7); billing on redeem.
- Real geo decision (in-range / out-of-range / denied) for stamp **and** redeem (S14).
- Data-inconsistency: full count + no reward row (S15/C11).
- Wrong-customer / not-found on customer stamp & reward routes (S8/S9/R5).

### P2 — polish & ops guards

- Remove dead `StampBlockReason` variants (G8).
- Distinct rate-limit copy on the QR page (G10).
- Surface `first_stamp_issued=false` after join (G11).
- Replace "tomorrow" with the real reopening date in waiting copy (G12).
- Reconcile `docs/CUSTOMER_FLOW.md` wallet-vs-home naming in a docs slice (G14).

---

## Appendix A — RPC exception index

### A.1 `issue_self_service_stamp` (final def: [20260616103000_minimum_three_rewards.sql](supabase/migrations/20260616103000_minimum_three_rewards.sql))

Signature: `(p_membership_id, p_customer_id, p_latitude default null, p_longitude default null)`. Evaluated top-to-bottom.

| #   | Exact message                                                                | Trigger                                                                                      | Category       | Customer mapping                                   |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- |
| 1   | `Verified customer required`                                                 | `p_customer_id` null                                                                         | auth           | n/a (set server-side)                              |
| 2   | `Rate limit exceeded`                                                        | >10 stamps / 15 min / membership (`selfstamp:<id>`,10,900000)                                | rate-limit     | **unmapped → throw (G1)**                          |
| 3   | `Membership not found`                                                       | no membership row                                                                            | ownership      | unmapped → throw (gated upstream)                  |
| 4   | `Membership ownership required`                                              | `customer_id` mismatch, or non-service request without matching `auth.uid()`                 | auth/ownership | unmapped → throw (gated upstream)                  |
| 5   | `This merchant loyalty programme is not active`                              | `merchants.status ∉ {trial,active}`                                                          | billing        | ✅ "unavailable right now" (matches `not active`)  |
| 6   | `This merchant loyalty programme is unavailable`                             | `billing_customers.status ∈ {cancelled,suspended}`                                           | billing        | ✅ "unavailable right now" (matches `unavailable`) |
| 7   | `This loyalty card is not active`                                            | no active loyalty card                                                                       | card           | ✅ (matches `not active`)                          |
| 8   | `A reward is already ready to redeem`                                        | `current_stamp_count ≥ stamps_required`                                                      | full-card      | ✅ "redeem it before collecting more stamps"       |
| 9   | `Stamp already issued for this UK business day`                              | prior `earned` event with today's UK business date (and race fallback on `unique_violation`) | daily          | ✅ "already stamped today"                         |
| 10  | `At least 3 active reward pool items are required before unlocking a reward` | on final stamp (`current+1 ≥ required`), active pool items < 3 **or** Σweight ≤ 0            | pool           | **unmapped → throw (G2)**                          |

**Soft (never raise):** geo runs only if `require_geofence=true` (default false). Missing coords → `fraud_flags` `self_service_geofence_unknown` (low); out of range → `self_service_geofence_out_of_range` (medium); both set `geo_flagged=true` and continue. Post-commit `high_stamp_velocity` flag if ≥20 merchant stamps in 15 min. First-cycle reward = first active pool item by `display_order`; later cycles weighted-random.

### A.2 `redeem_self_service_reward` (final def: [20260615130000_reward_redemption_cycles.sql](supabase/migrations/20260615130000_reward_redemption_cycles.sql))

Signature: `(p_reward_event_id, p_customer_id, p_latitude default null, p_longitude default null)`. **Merchant-side only — customer never calls this directly.** Customer-visible outcome of each = reward stays in its current state while the merchant sees the error.

| #   | Exact message                                             | Trigger                                                | Category       | Customer pre-empt                                |
| --- | --------------------------------------------------------- | ------------------------------------------------------ | -------------- | ------------------------------------------------ |
| 1   | `Verified customer required`                              | `p_customer_id` null                                   | auth           | n/a                                              |
| 2   | `Reward not found`                                        | no reward row                                          | ownership      | n/a                                              |
| 3   | `Reward ownership required`                               | owner mismatch / auth mismatch                         | auth/ownership | merchant-scan ownership test                     |
| 4   | `Reward is not redeemable`                                | status ∉ {unlocked, redeemed} (i.e. cancelled/expired) | status         | R8 → `unavailable`                               |
| 5   | `Reward is not redeemable until the next UK business day` | `redeemable_from > uk_business_date(now())`            | overnight hold | R4 → `reward_waiting` (no QR shown)              |
| 6   | `This loyalty card is not active`                         | card inactive                                          | card           | R6 → `unavailable`                               |
| 7   | `Reward is not ready to redeem`                           | `current_stamp_count < stamps_required`                | full-card      | derive guards redeemable                         |
| 8   | `Complete your profile before redeeming`                  | name blank, or DOB null, or email present & unverified | profile        | R3 → gate form shown first                       |
| 9   | `This merchant loyalty programme is not active`           | `merchants.status ∉ {trial,active}`                    | billing        | R6 → `unavailable`                               |
| 10  | `This merchant loyalty programme is unavailable`          | `billing ∈ {cancelled,suspended}`                      | billing        | **`suspended` pre-empted; `cancelled` NOT (G7)** |
| 11  | `Reward already redeemed`                                 | conditional UPDATE hit 0 rows (race)                   | race           | R1 idempotent                                    |

**Soft:** `status = 'redeemed'` checked **before** all gates → idempotent success no-op (no re-decrement, no cycle advance). Geo identical to stamp (soft, `reward_redeem` context). On success: status→redeemed, `redeemed_at=now()`, decrement count by `stamps_required` (floored 0), `total_rewards_redeemed++`, `active_cycle_number++`.

### A.3 Billing values quick-reference

- `merchants.status`: allow `{trial, active}`; block everything else (both RPCs).
- `billing_customers.status`: block `{cancelled, suspended}`; allow `{trialing, active, past_due, null}` (both RPCs). `past_due` intentionally not blocked.
- Reward-pool minimum: **3** active `reward_pool_items` (merchant+location+card), enforced only on the card-completing stamp.

---

## Appendix B — Test baseline

```
Command: pnpm vitest run \
  tests/micro-specs/customer-experience.test.ts \
  tests/micro-specs/returning-qr-redirect.test.ts \
  tests/micro-specs/self-service-stamping.test.ts \
  tests/micro-specs/customer.test.ts \
  tests/micro-specs/customer-home.test.ts \
  tests/micro-specs/customer-stamp-loader.test.ts \
  tests/micro-specs/reward-redemption-cycles.test.ts \
  tests/micro-specs/merchant-scanned-reward.test.ts \
  tests/micro-specs/reward-profile-gate.test.ts \
  tests/micro-specs/customer-facing-gap-fixes.test.ts

Date:   2026-06-16
Result: Test Files  1 failed | 9 passed (10)
        Tests       1 failed | 115 passed (116)
        Duration    ~1.9s
```

**The one failure is pre-existing and out of customer scope.** `self-service-stamping.test.ts:199` expects `saveVenueLocationAction` → `{saved:true}`, but the canonical-address migration ([20260616110000_venue_canonical_address.sql](supabase/migrations/20260616110000_venue_canonical_address.sql)) now requires `addressLine1` / `addressCity` / `addressPostcode`, which the fixture omits (returns address validation errors instead). This is a **merchant venue-settings** assertion, not a customer-journey one; the file was already modified in the working tree at session start. No audit action changed it.

---

## Appendix C — Manual QA notes

Not executed (no preview run in this read-only pass). Recommended spot-checks via [`app/dev/customer-flow/preview/`](app/dev/customer-flow/preview/) for a follow-up:

- `card-3-of-3` with `reward-ready` vs `reward-waiting` — confirm "Open reward QR" vs "Give it a day to breathe" (C3/C2).
- Home tile for a **waiting reward while stamped today** — visually confirm G5 (status reads "Stamp secured for today", only a small "Reward soon" badge hints at the reward).
- Stamp route on a **cancelled-billing** card — confirm the "Add today's stamp" CTA appears (G3) and the block lands as the inline "Stamp not added" banner.

Any discrepancy found in manual QA should be appended to §5 as a new gap row.
