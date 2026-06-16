# Customer Edge Case Audit

Date: 2026-06-16
Scope: customer QR -> join -> stamp -> card -> reward, across RPC, loaders, derive, UI, and home.
Mode: read-only audit. No production code, test, migration, or generated route docs were changed.

## 1. Executive Summary

### Verdict

The customer flow has the right main shape:

- QR entry routes returning members toward the stamp surface instead of an "already joined" dead end.
- Full-card reward states generally outrank stamp actions.
- Reward collection is merchant-scanned QR, not customer tap-to-redeem.
- Profile completion gates the reward QR before collection.
- Geolocation failures are soft review signals, not customer blockers.

The main risk is not the happy path. It is mismatch at the edges:

- RPC exceptions are stricter than loader/UI availability in several states.
- Stamp error mapping is duplicated and incomplete.
- Cancelled billing can still look available in customer loaders/home even though RPCs block stamp and redeem.
- Full-card-without-unlocked-reward data inconsistency can show the wrong action surface.
- Several high-priority outcomes are covered by unit tests but not by end-to-end or route-level tests.

### Counts

| Area                                                |   Count |
| --------------------------------------------------- | ------: |
| Scenario rows cataloged                             |      57 |
| High-priority plan scenarios covered with full rows | 14 / 14 |
| Gap register entries                                |      12 |
| P0 gaps                                             |       4 |
| P1 gaps                                             |       5 |
| P2 gaps                                             |       3 |
| Focused customer vitest files run                   |       5 |
| Focused customer tests passed                       | 77 / 78 |

### Coverage Snapshot

| Layer  | Audit conclusion                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| RPC    | Strongest source of truth for stamp/redeem invariants; several exceptions are not mapped cleanly by customer surfaces.   |
| Loader | Good route-state modeling for common card/stamp/reward states; billing and inconsistent full-card states drift from RPC. |
| Derive | Priorities are explicit and mostly correct; typed block reasons contain unused states.                                   |
| UI     | Merchant-scan reward UX is coherent; home/waiting-reward and cancelled-billing copy can mislead.                         |
| Home   | Good ready-reward entry point; weaker waiting-reward and billing-status representation.                                  |
| Tests  | Good unit/contract coverage; no complete route/E2E matrix across QR -> OTP -> stamp -> reward -> merchant scan.          |

### Focused Test Baseline

Command run:

```bash
pnpm vitest run tests/micro-specs/customer-experience.test.ts tests/micro-specs/returning-qr-redirect.test.ts tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/customer.test.ts tests/micro-specs/customer-home.test.ts
```

Result:

- 5 files run.
- 4 files passed.
- 77 tests passed.
- 1 test failed.

Failure:

- `tests/micro-specs/self-service-stamping.test.ts` -> `saves venue location settings with geocoded coordinates`
- Expected `{ saved: true }`.
- Received validation errors for missing `addressLine1`, `addressCity`, and `addressPostcode`.
- This failure is a venue settings/geocoding baseline issue, not a customer edge-case implementation change made by this audit.

`tests/micro-specs/customer.test.ts` also emitted React invalid-hook-call warnings during two tests, while still passing.

## 2. Architecture and Rule Map

### Source Of Truth Layers

| Layer                 | Key files                                                                                                        | Role                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC stamp             | `supabase/migrations/20260616103000_minimum_three_rewards.sql`                                                   | Enforces self-service stamp ownership, rate limit, daily uniqueness, billing blocks, reward unlock, minimum active reward pool, geo review flags.       |
| RPC reward            | `supabase/migrations/20260615130000_reward_redemption_cycles.sql`                                                | Enforces reward ownership, profile completion, redeemability date, card readiness, billing blocks, idempotent duplicate redemption, active-cycle reset. |
| Join wrapper          | `supabase/migrations/20260614120000_join_with_first_stamp.sql`                                                   | Creates/reuses membership and attempts first stamp, but swallows first-stamp exceptions into `first_stamp_issued=false`.                                |
| Customer stamp action | `lib/customer/stamp.ts`                                                                                          | Calls `issue_self_service_stamp`, maps some RPC messages into form-safe copy.                                                                           |
| Block reason mapper   | `lib/customer/experience/block-reasons.ts`                                                                       | Converts selected RPC/error strings to typed experience block reasons.                                                                                  |
| Card loader           | `lib/customer/experience/load-card.ts`                                                                           | Builds card state from membership, active-cycle stamps, latest unlocked reward, and billing/merchant availability.                                      |
| Stamp loader          | `lib/customer/experience/load-stamp.ts`                                                                          | Builds stamp surface from card state, latest reward, stamped-today, and QR validity.                                                                    |
| Reward loader         | `lib/customer/experience/load-reward.ts`                                                                         | Builds reward surface with profile gate and reward collection QR state.                                                                                 |
| Derive                | `lib/customer/experience/derive.ts`                                                                              | Applies deterministic priorities for card, stamp, reward, and join view models.                                                                         |
| Home                  | `lib/customer/home.ts`, `lib/customer/home-dashboard.ts`, `lib/customer/home-rewards.ts`                         | Summarizes active cards and ready rewards for the customer home surface.                                                                                |
| QR/join routes        | `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/join/page.tsx`, `app/m/[merchantSlug]/join/actions.ts`            | Route QR scans, returning member visits, phone/OTP, and join-with-first-stamp.                                                                          |
| Stamp/reward routes   | `app/card/[membershipId]/stamp/page.tsx`, `app/card/[membershipId]/actions.ts`, `app/reward/[rewardId]/page.tsx` | Render stamp confirmation/status and reward QR/profile gate.                                                                                            |

### Priority Rules Observed

| Surface | Priority                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------- |
| Stamp   | `unavailable` -> `reward_ready` -> `reward_waiting` -> `card_stamped_today` -> `stamp_confirm`    |
| Card    | `unavailable` -> `card_collecting`                                                                |
| Reward  | `unavailable` -> `redeemed_proof` -> `reward_ready` -> `reward_waiting`                           |
| Join    | `unavailable` -> `join_returning` -> `join_terms` -> `join_otp` -> `join_phone` -> `join_welcome` |

Reward-ready outranking stamp is correct. Reward-waiting outranking already-stamped is also intentional in `load-stamp.ts` and `derive.ts`, but it has weaker coverage in returning-member OTP paths and home copy.

### Billing Rule Map

The customer-facing code currently treats billing status differently by layer:

- RPC stamp/reward blocks `cancelled` and `suspended`.
- Join availability blocks `suspended`, but not `cancelled`.
- Card/reward loaders mark `suspended` unavailable, but not `cancelled`.
- Card loader sets `stampsBlocked` for `cancelled`, while still deriving `card_collecting`.
- `past_due`, `trialing`, and `active` are effectively allowed unless merchant/card status blocks separately.

This makes `cancelled` the highest-risk billing edge case.

## 3. Scenario Catalog

Legend:

- `OK`: behavior is coherent.
- `Partial`: behavior exists but coverage or copy is incomplete.
- `Gap`: behavior conflicts across layers or can mislead/fail.
- `Missing`: no direct coverage found.

| ID        | Scenario                                                        | RPC                                            | Loader/derive                                                       | UI/home outcome                                                                    | Tests found                                                      | Status  | Gap                       |
| --------- | --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | ------------------------- |
| QR-01     | New customer scans active join QR                               | N/A                                            | `resolveQrForJoin` returns available                                | `/q/:qrId` redirects to `/m/:slug/join?qr=...`                                     | `customer.test.ts`, `self-service-stamping.test.ts`              | OK      | None                      |
| QR-02     | Returning member scans active join QR while signed in           | N/A                                            | Existing membership resolved                                        | `/q/:qrId` redirects to `/card/:membershipId/stamp?qr=...`                         | `self-service-stamping.test.ts`, `returning-qr-redirect.test.ts` | OK      | None                      |
| QR-03     | Unknown QR id                                                   | N/A                                            | QR context unavailable                                              | Unavailable QR page                                                                | `customer.test.ts` partial                                       | OK      | None                      |
| QR-04     | Inactive QR id                                                  | N/A                                            | QR context unavailable                                              | Unavailable QR page                                                                | `customer.test.ts` partial                                       | OK      | None                      |
| QR-05     | QR scan route rate limit exceeded                               | Rate limit can throw                           | `/q` catches `RateLimitError`                                       | Generic unavailable QR page, no retry-specific copy                                | No direct focused test found                                     | Partial | G-12                      |
| QR-06     | Returning member uses join URL with QR                          | N/A                                            | Join page calls returning QR helper                                 | Redirects to stamp status/confirm route                                            | `returning-qr-redirect.test.ts`                                  | OK      | None                      |
| QR-07     | Returning member uses join URL without QR                       | N/A                                            | Existing membership can derive `join_returning`                     | Returning panel can render                                                         | Unit coverage only                                               | Partial | None                      |
| QR-08     | Stamp route opened without QR                                   | RPC not called                                 | `deriveStamp` returns unavailable                                   | Copy asks customer to open from printed venue QR                                   | `customer-experience.test.ts`                                    | OK      | None                      |
| QR-09     | Stamp route opened with invalid QR                              | RPC not called                                 | `deriveStamp` returns unavailable                                   | Copy asks customer to scan venue code again                                        | `customer-experience.test.ts`                                    | OK      | None                      |
| QR-10     | Stamp route opened with QR for different merchant               | RPC protected by QR context/action             | Loader/action reject mismatch                                       | Form copy asks customer to scan venue code again                                   | `self-service-stamping.test.ts` partial                          | OK      | None                      |
| JOIN-01   | Phone OTP requested from join                                   | N/A                                            | Join state moves to OTP                                             | OTP form shown                                                                     | `customer.test.ts` partial                                       | OK      | None                      |
| JOIN-02   | Phone request rate limited                                      | Rate limiter throws                            | Action catches `RateLimitError`                                     | Safe "Too many verification requests" copy                                         | `customer.test.ts` partial                                       | OK      | None                      |
| JOIN-03   | OTP verified for new member with QR                             | Join wrapper calls first stamp RPC             | On success, membership/card route returned                          | First stamp is intended to land immediately                                        | `customer.test.ts` partial                                       | Partial | None                      |
| JOIN-04   | OTP verified for returning member with QR and card not full     | Stamp RPC called by returning helper           | Redirects to card with `stamp=issued`, or stamp status if duplicate | Customer sees issued or stamped-today surface                                      | `returning-qr-redirect.test.ts`                                  | OK      | None                      |
| JOIN-05   | OTP verified for returning member with reward ready             | Reward RPC not called                          | Returning helper checks latest reward first                         | Redirects to `/reward/:rewardId`                                                   | No direct focused test found                                     | Partial | G-08                      |
| JOIN-06   | OTP verified for returning member with reward waiting           | Reward RPC not called                          | Returning helper returns card path                                  | Customer lands on card, not reward waiting status                                  | No direct focused test found                                     | Partial | G-08, G-06                |
| JOIN-07   | Join-with-first-stamp final stamp but reward pool below minimum | Stamp RPC throws inside join wrapper           | Wrapper swallows first stamp exception                              | Customer joins with zero stamp and no exact reason                                 | No direct focused test found                                     | Gap     | G-02                      |
| STAMP-01  | Normal self-service stamp                                       | RPC inserts stamp event                        | Loader/derive can show confirm then card celebration                | Redirects to `/card/:id?stamp=issued`                                              | `self-service-stamping.test.ts`, SQL static tests                | OK      | None                      |
| STAMP-02  | Full card, reward ready                                         | RPC would block further stamp                  | Stamp loader checks latest reward first                             | Stamp page redirects to `/reward/:rewardId`                                        | `customer-experience.test.ts`                                    | OK      | None                      |
| STAMP-03  | Full card, reward waiting until next UK business day            | RPC blocks additional stamp                    | Stamp loader returns `reward_waiting`                               | Stamp surface says come back tomorrow                                              | `customer-experience.test.ts`                                    | OK      | None                      |
| STAMP-04  | Full card stamp bypass by direct form submit                    | RPC blocks with "A reward is already ready..." | Action maps to reward-first copy                                    | Form returns safe block copy                                                       | `self-service-stamping.test.ts`                                  | OK      | None                      |
| STAMP-05  | Stamped today, no reward                                        | RPC blocks duplicate                           | Loader/derive returns `card_stamped_today`                          | Stamp status says today is already secured                                         | `customer-experience.test.ts`, `returning-qr-redirect.test.ts`   | OK      | None                      |
| STAMP-06  | Stamped today after redemption in new active cycle              | RPC uses active-cycle/day uniqueness           | Card/home use active-cycle stamp dates                              | Should allow new-cycle state after redemption reset                                | `reward-redemption-cycles.test.ts` partial                       | Partial | Need route-level coverage |
| STAMP-07  | Stamp RPC rate limit exceeded                                   | RPC throws `Rate limit exceeded`               | `issueSelfServiceStamp` has no mapping                              | Likely generic throw/500 instead of calm copy                                      | No direct focused test found                                     | Gap     | G-01                      |
| STAMP-08  | Stamp RPC unauthenticated/verified customer required            | RPC throws `Verified customer required`        | Mapper only covers "Authentication required"                        | May escape as generic stamp failure                                                | No direct focused test found                                     | Gap     | G-03                      |
| STAMP-09  | Stamp RPC membership ownership mismatch                         | RPC throws ownership errors                    | Form path usually prevents mismatch via context                     | Direct action/RPC error not mapped cleanly                                         | No direct focused test found                                     | Partial | G-03                      |
| STAMP-10  | Geo denied during stamp                                         | RPC records review flag and continues          | Form continues after browser denial                                 | Customer can stamp; copy says action continues and may be reviewed                 | `self-service-stamping.test.ts` partial                          | OK      | None                      |
| STAMP-11  | Geo out of range during stamp                                   | RPC records review flag and continues          | Loader exposes location requirement                                 | Stamp still succeeds with review signal                                            | SQL static coverage partial                                      | OK      | None                      |
| STAMP-12  | Profile incomplete during stamp                                 | Stamp RPC does not require profile             | N/A                                                                 | Stamp can proceed                                                                  | Indirect                                                         | OK      | None                      |
| CARD-01   | Card collecting, not full                                       | N/A                                            | Active-cycle count derived                                          | Card shows progress and scan prompt                                                | `customer-experience.test.ts`, `customer-home.test.ts`           | OK      | None                      |
| CARD-02   | Card full with reward ready                                     | Reward RPC can redeem when merchant scans      | Card embeds reward ready CTA                                        | Card CTA opens reward QR                                                           | `customer-experience.test.ts`, `customer-home.test.ts`           | OK      | None                      |
| CARD-03   | Card full with reward waiting                                   | Reward RPC blocks until next UK business day   | Card embeds reward waiting status                                   | Card says give it a day                                                            | `customer-experience.test.ts`                                    | OK      | None                      |
| CARD-04   | Card full but no unlocked reward exists                         | Stamp RPC blocks because count >= required     | Loader has no reward to show                                        | Card may still look collecting/no reward CTA                                       | No direct focused test found                                     | Gap     | G-09                      |
| CARD-05   | Membership not logged in                                        | RPC not called                                 | Loader returns access state                                         | Login/recovery unavailable card state                                              | `customer.test.ts` partial                                       | OK      | None                      |
| CARD-06   | Membership belongs to another customer                          | RPC protected                                  | Loader returns forbidden/access state                               | "This belongs to another customer" style unavailable copy                          | `customer.test.ts` partial                                       | OK      | None                      |
| CARD-07   | Membership not found                                            | RPC protected                                  | Loader returns not found/access state                               | Not found unavailable copy                                                         | `customer.test.ts` partial                                       | OK      | None                      |
| REWARD-01 | Reward ready and profile complete                               | Reward RPC can redeem via merchant scan        | Reward derive returns `reward_ready`                                | Customer sees QR for merchant scan                                                 | `merchant-scanned-reward.test.ts`, `reward-profile-gate.test.ts` | OK      | None                      |
| REWARD-02 | Reward ready but profile incomplete                             | Reward RPC blocks                              | Loader carries profile gate                                         | Customer sees profile form instead of QR                                           | `reward-profile-gate.test.ts`, SQL profile test                  | OK      | None                      |
| REWARD-03 | Reward waiting until next UK business day                       | Reward RPC blocks with wait message            | Reward derive returns `reward_waiting`                              | Customer sees come-back-tomorrow panel                                             | `customer-experience.test.ts`, SQL cycle test                    | OK      | None                      |
| REWARD-04 | Reward already redeemed                                         | RPC duplicate redemption is idempotent         | Reward loader can return redeemed proof                             | Customer sees proof/new-cycle confirmation                                         | `customer-experience.test.ts`, SQL cycle test                    | OK      | None                      |
| REWARD-05 | Reward direct route for wrong customer                          | RPC protected                                  | Loader returns access/unavailable                                   | Customer cannot view/use someone else's reward                                     | `customer.test.ts` partial                                       | OK      | None                      |
| REWARD-06 | Merchant scans reward QR                                        | RPC is called through merchant-owned scan flow | Customer page only displays QR                                      | Merchant-confirmed collection, no customer tap-to-redeem                           | `merchant-scanned-reward.test.ts`                                | OK      | None                      |
| REWARD-07 | Geo denied/out-of-range on reward redeem                        | RPC records review flag and continues          | Customer reward page does not request location                      | Merchant scan can still collect; review flag possible                              | SQL static coverage partial                                      | OK      | None                      |
| HOME-01   | Ready reward on home                                            | N/A                                            | `primaryRewardId` set only for redeemable rewards                   | Tile/banner link to `/reward/:id`                                                  | `customer-home.test.ts`                                          | OK      | None                      |
| HOME-02   | Waiting reward on home                                          | N/A                                            | Unlocked reward count exists, no primary reward                     | Tag can say "Reward soon"; status copy may still prioritize stamped-today/progress | Partial unit coverage                                            | Partial | G-06                      |
| HOME-03   | Stamped today on home                                           | N/A                                            | Active-cycle stamp date used                                        | Status says stamp secured for today                                                | `customer-home.test.ts`                                          | OK      | None                      |
| HOME-04   | Multiple cards and ready rewards                                | N/A                                            | Ready rewards sorted, primary selected                              | Home shows redeemable reward banner/list                                           | `customer-home.test.ts`                                          | OK      | None                      |
| BILL-01   | Billing `trialing`                                              | RPC allows unless merchant/card inactive       | Join/card/reward generally available                                | Customer can join/stamp/redeem                                                     | No full matrix test                                              | Partial | G-05                      |
| BILL-02   | Billing `active`                                                | RPC allows                                     | Join/card/reward available                                          | Normal behavior                                                                    | Broad tests                                                      | OK      | None                      |
| BILL-03   | Billing `past_due`                                              | RPC allows                                     | Join/card/reward available                                          | Normal behavior despite payment risk                                               | No full matrix test                                              | Partial | G-05                      |
| BILL-04   | Billing `cancelled` on join                                     | Stamp/reward RPC blocks later                  | Join resolver does not block cancelled                              | Customer can appear able to join                                                   | No direct focused test found                                     | Gap     | G-04                      |
| BILL-05   | Billing `cancelled` on card view                                | Stamp/reward RPC blocks                        | Card loader still derives collecting with `stampsBlocked`           | Card visible, stamps blocked copy only                                             | No direct focused test found                                     | Gap     | G-04                      |
| BILL-06   | Billing `cancelled` on reward view                              | Reward RPC blocks                              | Reward loader does not mark unavailable by billing                  | Reward QR may be shown before merchant scan fails                                  | No direct focused test found                                     | Gap     | G-04                      |
| BILL-07   | Billing `suspended`                                             | RPC blocks                                     | Join/card/reward loaders block                                      | Customer sees unavailable                                                          | `customer.test.ts` partial                                       | OK      | None                      |
| DATA-01   | Count >= required but no unlocked reward                        | Stamp RPC blocks as reward-ready               | Loader/home depend on latest reward row                             | UI can invite scan or omit reward CTA                                              | No direct focused test found                                     | Gap     | G-09                      |
| SPEC-01   | Customer reward collection mechanic                             | Current RPC/UI/tests are merchant-scanned QR   | Spec still contains self-redeem language                            | Implementation and spec drift                                                      | `merchant-scanned-reward.test.ts`                                | Gap     | G-10                      |
| SPEC-02   | Minimum active reward pool                                      | Latest RPC requires at least 3 active rewards  | Older spec language references at least 1 reward                    | Implementation and spec drift                                                      | SQL static coverage partial                                      | Gap     | G-11                      |

## 4. Billing Matrix

Assumptions:

- Merchant status is otherwise `active` or `trial`.
- Loyalty card status is otherwise active.
- Customer identity and ownership are valid.

| Billing status | Join QR                  | Card view                                            | Stamp RPC | Reward page                    | Merchant scan redeem RPC | Customer-visible risk                                                           |
| -------------- | ------------------------ | ---------------------------------------------------- | --------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| `trialing`     | Allowed                  | Available                                            | Allowed   | Available                      | Allowed                  | No explicit issue found. Needs matrix test.                                     |
| `active`       | Allowed                  | Available                                            | Allowed   | Available                      | Allowed                  | Expected happy path.                                                            |
| `past_due`     | Allowed                  | Available                                            | Allowed   | Available                      | Allowed                  | Policy may be intentional, but should be explicit.                              |
| `cancelled`    | Allowed by join resolver | Card can still derive collecting with stamps blocked | Blocked   | May still show reward-ready QR | Blocked                  | Highest-risk mismatch. Customer can see available surfaces before action fails. |
| `suspended`    | Blocked                  | Unavailable                                          | Blocked   | Unavailable                    | Blocked                  | Coherent across loaders/RPC.                                                    |

## 5. RPC Exception Inventory

### `issue_self_service_stamp`

| Exception/source                                                             | Current customer mapping                                              | Scenario row               | Result                                    |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ----------------------------------------- |
| `Verified customer required`                                                 | Not directly mapped by `blockedReason` or typed mapper                | STAMP-08                   | Gap                                       |
| `Rate limit exceeded`                                                        | Not mapped by `blockedReason`; route-level QR has generic unavailable | STAMP-07, QR-05            | Gap                                       |
| `Membership not found`                                                       | Loader usually prevents; action mapper not direct                     | STAMP-09, CARD-07          | Partial                                   |
| `Membership ownership required`                                              | Loader/action usually prevents; action mapper not direct              | STAMP-09, CARD-06          | Partial                                   |
| `This merchant loyalty programme is not active`                              | Mapped to unavailable                                                 | Billing rows               | OK                                        |
| `This merchant loyalty programme is unavailable`                             | Mapped to unavailable                                                 | Billing rows               | OK for RPC, loader mismatch for cancelled |
| `This loyalty card is not active`                                            | Mapped to unavailable                                                 | CARD rows                  | OK                                        |
| `A reward is already ready to redeem`                                        | Mapped to reward-first copy / typed `reward_ready_first`              | STAMP-02, STAMP-04         | OK                                        |
| `Stamp already issued for this UK business day`                              | Mapped to already-stamped copy / typed `already_stamped_today`        | STAMP-05                   | OK                                        |
| `At least 3 active reward pool items are required before unlocking a reward` | Not mapped; join wrapper swallows                                     | JOIN-07, STAMP-04, DATA-01 | Gap                                       |
| Unique violation for duplicate stamp                                         | Mapped to already-stamped copy                                        | STAMP-05                   | OK                                        |
| Geofence denied/missing/out of range                                         | Soft flag, action continues                                           | STAMP-10, STAMP-11         | OK                                        |

### `redeem_self_service_reward`

| Exception/source                                          | Current customer mapping                                                | Scenario row     | Result            |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- | ----------------- |
| `Verified customer required`                              | Loader/profile/merchant ownership should prevent direct customer action | REWARD-05        | Partial           |
| `Reward not found`                                        | Loader unavailable/not found                                            | REWARD-05        | OK                |
| `Reward ownership required`                               | Loader unavailable/forbidden                                            | REWARD-05        | OK                |
| Already `redeemed`                                        | Idempotent return before further checks                                 | REWARD-04        | OK                |
| `Reward is not redeemable`                                | Typed `unavailable`                                                     | REWARD-03        | OK                |
| `Reward is not redeemable until the next UK business day` | Typed `unavailable`; derive also has waiting state from loader data     | REWARD-03        | OK                |
| `This loyalty card is not active`                         | Unavailable                                                             | REWARD rows      | OK                |
| `Reward is not ready to redeem`                           | Not directly user-facing in customer self action                        | DATA-01          | Partial           |
| `Complete your profile before redeeming`                  | Typed `profile_incomplete`; reward page gates QR                        | REWARD-02        | OK                |
| `This merchant loyalty programme is not active`           | Unavailable                                                             | Billing rows     | OK                |
| `This merchant loyalty programme is unavailable`          | RPC blocks cancelled/suspended; loader only blocks suspended            | BILL-06, BILL-07 | Gap for cancelled |
| `Reward already redeemed` update race                     | Typed `unavailable`; redeemed proof can display after reload            | REWARD-04        | Partial           |
| Geofence denied/missing/out of range                      | Soft flag, action continues                                             | REWARD-07        | OK                |

## 6. Gap Register

| ID   | Severity | Owning layer           | Gap                                                                                                                            | Evidence                                                                                                            | Suggested remediation                                                                                           |
| ---- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| G-01 | P0       | RPC/action mapping     | Stamp RPC rate-limit errors are not mapped into calm customer copy.                                                            | `issue_self_service_stamp` calls `enforce_rate_limit`; `lib/customer/stamp.ts` does not map `Rate limit exceeded`.  | Add a shared customer-safe RPC error classifier and cover stamp form rate limit.                                |
| G-02 | P0       | RPC/action/join        | Minimum reward pool exception can surface as generic stamp failure, while join wrapper silently creates a no-stamp membership. | Latest stamp RPC requires at least 3 active reward pool items; join wrapper catches first-stamp failure.            | Map the exception to a customer-safe unavailable state and add merchant/operator remediation copy or preflight. |
| G-03 | P1       | Shared mapping         | Stamp error mapping is duplicated and incomplete.                                                                              | `blockedReason` in `lib/customer/stamp.ts` differs from `toStampBlockReason` in `block-reasons.ts`.                 | Consolidate around one typed classifier used by actions, loaders, and tests.                                    |
| G-04 | P0       | Billing policy/loaders | `cancelled` billing is blocked by RPC but can still look available in join/card/reward loaders.                                | Join/card/reward availability only treats `suspended` as unavailable, while RPC blocks `cancelled` and `suspended`. | Align customer availability with RPC for `cancelled`, or explicitly choose a softer read-only cancelled state.  |
| G-05 | P2       | Product policy/tests   | `past_due` and `trialing` behavior is implicit.                                                                                | RPC/loaders allow both; no explicit matrix test found.                                                              | Add policy comments and matrix tests so this remains intentional.                                               |
| G-06 | P1       | Home/card copy         | Waiting rewards are less clearly represented on home and returning OTP paths.                                                  | Home ready rewards link to reward page, but waiting rewards can show generic stamped/progress copy.                 | Add explicit waiting-reward state/copy on home and route tests for OTP waiting branch.                          |
| G-07 | P2       | Derive/types           | `invalid_qr`, `wrong_merchant`, and `expired_qr` block reasons exist but are not produced by the mapper.                       | `StampBlockReason` includes them; loader handles QR issues directly as unavailable.                                 | Remove dead typed reasons or wire them to QR/load error classification.                                         |
| G-08 | P1       | Route tests            | Returning-member OTP branches for reward-ready and reward-waiting are not directly covered.                                    | `returning-qr-redirect.test.ts` covers issue and duplicate stamp, not ready/waiting reward branches.                | Add tests for post-OTP full-card ready/waiting outcomes.                                                        |
| G-09 | P0       | Data invariant/loaders | Count >= required with no unlocked reward can show a scan/card state while RPC blocks stamps.                                  | RPC treats full count as reward-ready; loaders need a latest reward row to display reward-ready/waiting.            | Add loader invariant handling for full card without reward row, plus data repair/admin alert.                   |
| G-10 | P1       | Spec traceability      | Reward micro-spec language still references customer self-redeem while implementation is merchant-scanned QR.                  | UI/tests show merchant scan; spec drift remains.                                                                    | Reconcile spec/docs in a separate docs-only change.                                                             |
| G-11 | P2       | Spec traceability      | Reward pool minimum has drifted from older "at least one" language to latest RPC requiring 3 active rewards.                   | Latest SQL migration enforces 3 active reward pool items.                                                           | Update micro-spec and tests to state the 3-reward minimum explicitly.                                           |
| G-12 | P1       | QR route copy          | QR scan rate limit falls into generic unavailable QR copy.                                                                     | `/q/[qrId]/page.tsx` catches `RateLimitError` but renders `UnavailableQr` without retry-specific wording.           | Add a retry-later QR unavailable reason and route test.                                                         |

Severity rubric:

- P0: can show the wrong loyalty-affecting action, block a valid customer without safe copy, or fail after UI says the action is available.
- P1: confusing customer outcome, missing branch coverage, or drift likely to cause regressions.
- P2: cleanup, policy clarity, or stale type/spec issue with lower direct customer risk.

## 7. Test Matrix

| Test file                                            | Coverage observed                                                                                                     | Important gaps                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tests/micro-specs/customer-experience.test.ts`      | Derive priorities for card/stamp/reward/join, missing/invalid QR, safe copy basics.                                   | Does not cover all RPC exception strings or billing matrix.                                                       |
| `tests/micro-specs/returning-qr-redirect.test.ts`    | Returning QR no-membership, stamp path, post-OTP issued stamp, coordinates, already-stamped redirect.                 | Missing reward-ready and reward-waiting post-OTP branches.                                                        |
| `tests/micro-specs/self-service-stamping.test.ts`    | Stamp action RPC mocking, duplicate mapping, direct card route blocks, existing QR member route, SQL static contract. | Baseline currently has one unrelated venue settings failure; stamp rate limit and pool-min exception not covered. |
| `tests/micro-specs/customer.test.ts`                 | Public QR, join actions, suspended QR, safe copy, ownership, reward state.                                            | Emits invalid-hook warnings; no full billing matrix.                                                              |
| `tests/micro-specs/customer-home.test.ts`            | Home ready reward sort, summary counts, status copy, progress reconciliation.                                         | Waiting reward and cancelled billing home copy need explicit coverage.                                            |
| `tests/micro-specs/customer-stamp-loader.test.ts`    | Stamp loader location uses card merchant context.                                                                     | Narrow loader coverage only.                                                                                      |
| `tests/micro-specs/reward-redemption-cycles.test.ts` | Active cycle card/home/read models and SQL contract for reward cycles.                                                | Route-level customer journey after redemption remains partial.                                                    |
| `tests/micro-specs/merchant-scanned-reward.test.ts`  | No customer self-redeem, merchant scan route/action, ownership, masking, redirect after confirmation.                 | Does not cover cancelled billing mismatch on reward QR visibility.                                                |
| `tests/micro-specs/reward-profile-gate.test.ts`      | Profile gate, reward page QR suppression, profile save actions, profile-incomplete mapper.                            | Merchant scan failure path after stale/incomplete profile not route-covered.                                      |
| `supabase/tests/profile_completion_gate.sql`         | Real SQL profile completion gate.                                                                                     | Does not prove UI mapping.                                                                                        |
| `supabase/tests/reward_redemption_cycles.sql`        | Real SQL final stamp, unlock, redeem, active-cycle reset, duplicate redemption.                                       | Does not prove loader/card/home mismatch handling.                                                                |

### Coverage Heatmap

| Scenario group                 | RPC SQL | Unit derive | Loader/action | Route/UI | E2E     |
| ------------------------------ | ------- | ----------- | ------------- | -------- | ------- |
| QR new/returning               | N/A     | Partial     | Covered       | Covered  | Missing |
| OTP join/returning             | Partial | Partial     | Covered       | Partial  | Missing |
| Stamp happy path               | Partial | Covered     | Covered       | Partial  | Missing |
| Full card reward ready/waiting | Covered | Covered     | Partial       | Partial  | Missing |
| Daily duplicate stamp          | Covered | Covered     | Covered       | Partial  | Missing |
| Reward merchant scan           | Covered | Partial     | Covered       | Covered  | Missing |
| Profile gate                   | Covered | Covered     | Covered       | Covered  | Missing |
| Billing matrix                 | Partial | Missing     | Partial       | Missing  | Missing |
| Rate limits                    | Partial | Missing     | Partial       | Missing  | Missing |
| Geo soft-fail                  | Partial | Missing     | Partial       | Partial  | Missing |
| Data inconsistency repair      | Missing | Missing     | Missing       | Missing  | Missing |

## 8. EARS-Style Requirements To Lock The Edges

These are proposed requirements, not implemented changes.

| ID            | Requirement                                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EARS-CUST-001 | WHEN a customer scans a valid venue QR and already owns an active membership for that merchant, THE SYSTEM SHALL route them to the stamp or reward outcome for that QR without rendering an "already joined" dead end.                          |
| EARS-CUST-002 | WHEN a membership has an unlocked reward that is redeemable now, THE SYSTEM SHALL prioritize the reward QR over any stamp confirmation or already-stamped message.                                                                              |
| EARS-CUST-003 | WHEN a membership has an unlocked reward that is not yet redeemable, THE SYSTEM SHALL show a waiting-reward state and SHALL NOT invite the customer to collect another stamp.                                                                   |
| EARS-CUST-004 | WHEN a customer submits a stamp action after the card is full, THE SYSTEM SHALL return customer-safe reward-first copy instead of issuing another stamp or surfacing a raw RPC error.                                                           |
| EARS-CUST-005 | WHEN the stamp RPC rate limit is exceeded, THE SYSTEM SHALL show retry-later copy and SHALL NOT produce a generic server error.                                                                                                                 |
| EARS-CUST-006 | WHEN the active reward pool is below the minimum required to unlock a reward, THE SYSTEM SHALL block customer-facing stamp collection with safe unavailable copy and SHALL provide an operator-diagnosable reason.                              |
| EARS-CUST-007 | WHEN billing status is `cancelled` or `suspended`, THE SYSTEM SHALL make join, stamp, card, reward, and merchant-scan availability agree with the RPC policy.                                                                                   |
| EARS-CUST-008 | WHEN billing status is `trialing`, `active`, or `past_due`, THE SYSTEM SHALL make the intended join, stamp, card, reward, and merchant-scan policy explicit in tests.                                                                           |
| EARS-CUST-009 | WHEN a customer opens a card whose active-cycle stamp count is greater than or equal to the requirement but no unlocked reward exists, THE SYSTEM SHALL show a safe recovery/unavailable state and SHALL NOT invite another self-service stamp. |
| EARS-CUST-010 | WHEN browser geolocation is denied, unavailable, or outside the venue radius during stamp collection, THE SYSTEM SHALL continue the customer action and record a review signal without blocking by default.                                     |
| EARS-CUST-011 | WHEN a reward QR is ready but the customer profile is incomplete, THE SYSTEM SHALL require profile completion before displaying the collection QR.                                                                                              |
| EARS-CUST-012 | WHEN a merchant scans a customer reward QR, THE SYSTEM SHALL perform the reward collection server-side and SHALL NOT depend on a customer tap-to-redeem control.                                                                                |
| EARS-CUST-013 | WHEN an invalid, inactive, wrong-merchant, or missing QR is used for a stamp route, THE SYSTEM SHALL show a QR-specific recovery message instead of a generic card failure.                                                                     |
| EARS-CUST-014 | WHEN the customer home surface summarizes a waiting reward, THE SYSTEM SHALL distinguish waiting reward copy from ordinary stamped-today or progress copy.                                                                                      |

## 9. Remediation Backlog

### P0

| Rank | Work item                                                                                                              | Why                                                                          |
| ---: | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
|    1 | Create one shared customer RPC error classifier and use it from stamp action, block-reason mapping, and route loaders. | Fixes rate-limit, pool-minimum, verified-customer, and ownership copy drift. |
|    2 | Align `cancelled` billing availability across join, card, reward, stamp, and merchant scan.                            | Prevents customer-visible surfaces that later fail at RPC.                   |
|    3 | Add full-card-without-unlocked-reward loader handling.                                                                 | Avoids inviting stamps when RPC says reward should already exist.            |
|    4 | Add tests for `Rate limit exceeded` and pool-minimum exceptions in stamp/join paths.                                   | Locks the two riskiest raw-error/customer-confusion edges.                   |

### P1

| Rank | Work item                                                                    | Why                                                                    |
| ---: | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
|    5 | Add returning-member OTP tests for reward-ready and reward-waiting branches. | Prevents regression in the QR -> phone -> OTP -> outcome path.         |
|    6 | Add waiting-reward copy/state to home.                                       | Reduces customer confusion after final stamp before next business day. |
|    7 | Add QR route rate-limit-specific copy.                                       | Gives a clearer recovery path than generic unavailable QR.             |
|    8 | Reconcile reward collection micro-spec language with merchant-scanned QR.    | Keeps future agents from reintroducing customer self-redeem.           |
|    9 | Add billing matrix tests for all five statuses.                              | Makes trialing/active/past_due/cancelled/suspended policy explicit.    |

### P2

| Rank | Work item                                                                                   | Why                                                           |
| ---: | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
|   10 | Remove or wire unused `invalid_qr`, `wrong_merchant`, and `expired_qr` typed block reasons. | Reduces dead state and misleading coverage assumptions.       |
|   11 | Update reward-pool minimum spec language to 3 active rewards.                               | Matches latest SQL invariant.                                 |
|   12 | Investigate existing invalid-hook warnings in `customer.test.ts`.                           | Not blocking this audit, but test hygiene should be restored. |

## 10. Appendices

### Appendix A: Focused Test Run Details

Command:

```bash
pnpm vitest run tests/micro-specs/customer-experience.test.ts tests/micro-specs/returning-qr-redirect.test.ts tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/customer.test.ts tests/micro-specs/customer-home.test.ts
```

Output summary:

```text
Test Files  1 failed | 4 passed (5)
Tests       1 failed | 77 passed (78)
```

Failing test:

```text
tests/micro-specs/self-service-stamping.test.ts > saves venue location settings with geocoded coordinates
expected { saved: true }, received validation errors for addressLine1, addressCity, and addressPostcode
```

### Appendix B: Key File Inventory

| Area                      | Files inspected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC stamp/reward/join     | `supabase/migrations/20260616103000_minimum_three_rewards.sql`, `supabase/migrations/20260615130000_reward_redemption_cycles.sql`, `supabase/migrations/20260614120000_join_with_first_stamp.sql`                                                                                                                                                                                                                                                                                                                                                                                                         |
| Experience loaders/derive | `lib/customer/experience/load-card.ts`, `lib/customer/experience/load-stamp.ts`, `lib/customer/experience/load-reward.ts`, `lib/customer/experience/derive.ts`, `lib/customer/experience/priorities.ts`, `lib/customer/experience/block-reasons.ts`, `lib/customer/experience/types.ts`                                                                                                                                                                                                                                                                                                                   |
| Customer domain/actions   | `lib/customer/card.ts`, `lib/customer/reward.ts`, `lib/customer/stamp.ts`, `lib/customer/join.ts`, `lib/customer/returning-qr-redirect.ts`, `lib/customer/home.ts`, `lib/customer/home-dashboard.ts`, `lib/customer/home-rewards.ts`                                                                                                                                                                                                                                                                                                                                                                      |
| Routes                    | `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/join/page.tsx`, `app/m/[merchantSlug]/join/actions.ts`, `app/card/[membershipId]/stamp/page.tsx`, `app/card/[membershipId]/actions.ts`, `app/reward/[rewardId]/page.tsx`, `app/reward/[rewardId]/actions.ts`                                                                                                                                                                                                                                                                                                                                               |
| UI                        | `components/customer/customer-card-experience.tsx`, `components/customer/reward-panels.tsx`, `components/customer/home-card-tile.tsx`, `components/customer/home-redeem-banner.tsx`, `components/customer/join-wizard.tsx`, `components/customer/join-forms.tsx`, `components/customer/self-service-forms.tsx`                                                                                                                                                                                                                                                                                            |
| Tests                     | `tests/micro-specs/customer-experience.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-home.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `tests/micro-specs/customer-facing-gap-fixes.test.ts`, `supabase/tests/profile_completion_gate.sql`, `supabase/tests/reward_redemption_cycles.sql` |

### Appendix C: Read-Only Boundary

This audit intentionally did not:

- Modify production TypeScript/React code.
- Modify SQL migrations or SQL tests.
- Add or edit Vitest coverage.
- Reconcile route docs or customer-flow docs.
- Stage, commit, or push changes.

The only intended repository write from this audit is this new artifact:

```text
Goal/customer-edge-case-audit.md
```
