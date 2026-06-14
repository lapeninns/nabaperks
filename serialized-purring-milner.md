# Plan: Static-QR self-service stamping with optional geofence (soft) + 1/day + anomaly logging

## Context

Today a stamp requires the **counter handshake**: customer mints a short-lived code/QR,
staff pair a station, start a PIN session, look up the code, and approve
(`approve_stamp_token`). Redemption is the same (`redeem_reward_token`). The product owner
is removing staff entirely.

**New model:** the customer scans the **static printed venue QR** to stamp, capped at
**1 stamp per UK business day** (already enforced by the unique index
`stamp_events_one_earned_per_business_day_idx`). A merchant can optionally enable a **GPS
geofence**; when on, the device's location is checked against the venue. Per decisions, the
geofence is a **soft anomaly signal, never a hard block**:

- in range → stamp, no flag
- out of range → stamp **+ `fraud_flag`**
- location denied/unavailable → stamp **+ `fraud_flag`** (benefit of the doubt)

The only hard gate is the 1/day cap. Venue coordinates are obtained by **geocoding the
merchant's address** (keyless provider, geocoding happens at config time, not per stamp).

The static QR is the permanent `/q/[qrId]` URL; the **server** decides where it routes
(new visitor → join, existing member → stamp-confirm) — i.e. the "permanent URL + backend
routing" idea, realised through the existing resolver.

Outcome: Scan venue QR → (join, or) stamp-confirm → tap → stamp (1×/day; optional GPS
captured + classified) → reward unlocks → tap to redeem. No station, staff, codes, or polling.

## Confirmed decisions
- Geofence = **soft** (flag, never block). 1/day = only hard gate.
- Coordinates via **geocoding the address** (default: OpenStreetMap **Nominatim** — keyless,
  fine for rare config-time lookups, needs a descriptive User-Agent; swappable for Google/
  Mapbox if a key is added later).
- Staff/station/token machinery is **dropped cleanly** (carried over from prior decision —
  there are no staff in this model either).

## Changes by layer

### 1. Database — new migration `supabase/migrations/20260613100000_self_service_stamping.sql`
Idempotent only (`create or replace`, `drop ... if exists`, `alter ... if exists/if not exists`).

**Extend `merchant_locations`** (`...initial_schema_rls.sql:43-53`):
- `latitude numeric`, `longitude numeric`, `geofence_radius_meters integer default 150`,
  `require_geofence boolean not null default false`, `geocoded_at timestamptz`.
  (`address` column already exists.)

**Add RPCs (SECURITY DEFINER, scoped to `auth.uid()`):**
- `issue_self_service_stamp(p_membership_id uuid, p_latitude numeric default null, p_longitude numeric default null)`
  `returns (stamp_event_id uuid, new_stamp_count int, reward_unlocked boolean, geo_flagged boolean)`
  - Verify caller owns the membership (join `customers.auth_user_id = auth.uid()`, like
    `join_customer_membership`); merchant + card active; derive `location_id` from the card.
  - `enforce_rate_limit('selfstamp:' || p_membership_id, 10, 900000)` (anti-hammer).
  - **Geofence (soft):** if the location's `require_geofence` is true, compute haversine
    distance from (p_latitude,p_longitude) to the location's coords. Classify
    `in_range` / `out_of_range` / `unknown` (null coords). For out_of_range/unknown, insert a
    `fraud_flags` row (reason, distance, coords) and set `geo_flagged=true`. **Never block.**
  - Daily cap: rely on the existing unique index; **catch `unique_violation`** → graceful
    "already stamped today" instead of a 500.
  - Insert `stamp_events` (`event_type='earned'`, `stamps_delta=1`, `earned_business_date`,
    geo result in `metadata`), bump membership counters + `last_visit_at`.
  - Reuse the reward-unlock block ported from `approve_stamp_token`
    (`20260613090000_counter_handshake.sql:1290–1392`): weighted `reward_pool_items` pick →
    `reward_events` (`status='unlocked'`, `redeemable_from = next_uk_business_date(now())`).
- `redeem_self_service_reward(p_reward_event_id uuid, p_latitude numeric default null, p_longitude numeric default null)`
  `returns (reward_event_id uuid, reward_name text, membership_id uuid, new_stamp_count int)`
  - Verify ownership; status `unlocked` and `redeemable_from <= today`; same soft-geofence
    flagging; set `status='redeemed'`, decrement stamps, bump `total_rewards_redeemed`.
    Idempotent on an already-redeemed reward.

**Drop cleanly:** tables `verification_tokens`, `stations`, `staff_sessions`,
`station_pin_attempts`; columns `stamp_events.{station_id, staff_session_id,
verification_token_id, approved_by_staff_id}` and `reward_events.{redeemed_by_station_id,
redeemed_verification_token_id, redeemed_by_staff_id}` (keep `reverses_stamp_event_id`);
RPCs `pair_station`, `start_staff_session`, `end_staff_session`, `get_station_state`,
`lookup_verification_code`, `approve_stamp_token`, `redeem_reward_token`,
`undo_recent_stamp`, `create_verification_token`, `get_verification_token_status`.
Keep `staff_users` (merchant still lists staff elsewhere). Confirm `fraud_flags`
(`...:190-201`) columns fit; extend metadata if needed.

### 2. Geocoding (config-time, server-side)
- `lib/merchant/geocode.ts`: `geocodeAddress(address) -> {lat, lng} | null` via Nominatim
  (`https://nominatim.openstreetmap.org/search?format=json&q=...`, descriptive User-Agent).
  Called from the location-save action; on failure surface an error and let the merchant
  retry/adjust. Default radius generous (150 m) since soft-flagging tolerates geocode drift.

### 3. Customer lib + server actions
- Rewrite `lib/customer/stamp-code.ts` → `lib/customer/stamp.ts`: drop `createStampCode`/
  `createRedeemCode`/`getTokenStatus`; add `issueSelfServiceStamp(membershipId, coords?)`
  and `redeemSelfServiceReward(rewardId, coords?)` (call the new RPCs; keep blocked-reason
  mapping like "already stamped today").
- `app/card/[membershipId]/actions.ts` → `selfStampAction` (accepts optional coords from the
  client, requires a valid stamp-QR context); revalidate + `?stamp=issued`.
- `app/reward/[rewardId]/actions.ts` → `selfRedeemAction`.

### 4. Routes & components
- **QR resolver** `app/q/[qrId]/page.tsx` + `lib/customer/join.ts`: route an existing member
  to the **stamp-confirm** flow (carry `qrId`) instead of straight to `/card/[id]`. New
  visitors still go to join. (Single venue QR doubles as join + stamp.)
- **Stamp-confirm** = repurpose `app/card/[membershipId]/stamp/page.tsx`: no code/QR; shows a
  "Add today's stamp" button. A small client component reads `navigator.geolocation` **only
  when the location requires geofence**, then submits `selfStampAction` with coords (or none
  if denied/unavailable → soft-flagged server-side). The plain card page (no qr context)
  shows "Scan the venue code to add your stamp."
- `app/reward/[rewardId]/page.tsx` (~L156): replace `RedemptionCode`/`StampCodePanel` with a
  `selfRedeemAction` button (optional geolocation if required).
- **Delete:** `app/api/tokens/[tokenId]/`, entire `app/staff/`, `lib/staff/station.ts`,
  `components/staff/station-console.tsx`, `components/staff/station-pairing-form.tsx`,
  `components/customer/stamp-code-panel.tsx`. Remove `STATION_COOKIE` + any `/staff`
  redirects/nav/middleware (grep `staff`, `STATION_COOKIE`, `/api/tokens`, `verification`).

### 5. Merchant config UI (geofence + address)
- Add a venue section to `/app/launch` (alongside Card & rewards / QR & print) or
  `/app/settings`, mirroring the `useActionState` form → action → `supabase.update` pattern
  (`app/app/settings/actions.ts:40-100`, `roi-settings-form.tsx`).
  - Fields: address (text), "require GPS to stamp" toggle, geofence radius (m).
  - New action `saveVenueLocationAction`: validate, `geocodeAddress(address)`, persist
    `address, latitude, longitude, geofence_radius_meters, require_geofence, geocoded_at` to
    `merchant_locations`; show geocode success/failure; `revalidatePath`.

### 6. Specs (rewrite in place; keep paths/numbers)
- `nabaperks-micro-specs-final.md`: rewrite **MS-07** → "self-service stamping via static
  venue QR + optional soft geofence + 1/day + anomaly logging"; update goal, blast radius
  (drop staff-station; add geofence/geocode), constraints (1/day hard cap; geofence soft;
  presence not strictly verified), EARS. Update **MS-04** + build order.
- `micro-specs/04-staff-rewards/01-staff-pin-stamp-issuing.md`: rewrite acceptance criteria
  to self-service + soft geofence flags; add changelog (v1 staff → v2 self-service+geofence).
- `micro-specs/03-customer/02-digital-stamp-card.md`: scan-QR-to-stamp, optional location
  prompt, no codes/staff.
- `micro-specs/02-merchant/*`: document venue address + geofence config + geocoding.
- `micro-specs/GLOBAL_CONTEXT.md`: honor-system/geofence fraud baseline (1/day cap, geofence
  as soft signal via `fraud_flags`, geocoding at config time, anomaly logging fields).

### 7. Tests (Vitest, mocked Supabase + mocked `fetch`)
- Replace `tests/micro-specs/counter-handshake.test.ts` →
  `tests/micro-specs/self-service-stamping.test.ts`: `issueSelfServiceStamp` calls
  `issue_self_service_stamp` (membership + coords); "already stamped today" → blocked;
  reward-unlock flag; **geofence soft behavior** (in-range no flag; out-of-range/unknown set
  `geo_flagged` / write fraud flag; always issues); `redeemSelfServiceReward` calls
  `redeem_self_service_reward`; `geocodeAddress` parses Nominatim (mock fetch) and the save
  action persists coords.
- `tests/micro-specs/customer.test.ts`: update copy/UI (the "staff confirm it on their
  station" line ~L424-430; scan-to-stamp + action button; no `StampCodePanel`/code UI).
- `tests/micro-specs/no-legacy-naming.test.ts`: extend forbidden list ("counter handshake",
  "staff station", "station pairing", "verification token", "approve_stamp"); ensure rewritten
  specs/code contain none.
- `tests/micro-specs/foundation.test.ts`: update MVP spec tracking (MS-04) + deleted-file scan
  for removed staff/station/token files.

## Verification
- `npm test` (`vitest run`) → green (incl. geofence-soft + geocode + naming tests).
- Typecheck / `next build` → no dangling imports after deletions.
- `npm run db:migrate` (idempotent; re-applies non-initial migrations) → new columns/RPCs
  present, dropped objects gone.
- Manual / preview:
  - Merchant: set venue address in `/app/launch` → geocodes → enable "require GPS" + radius.
  - Customer: scan venue QR (member) → stamp-confirm → within range → stamps, no flag;
    simulate outside range → stamps **+ fraud_flag**; deny location → stamps **+ flag**;
    second stamp same day → "already stamped today"; reach threshold → reward unlocks →
    `/reward/[id]` → redeem → count resets. Screenshot the stamp + a flagged event.

## Out of scope / notes
- Geofence is **soft** by design; flipping out-of-range to a hard block later is a one-line
  RPC change (documented in the spec).
- Anomaly detection stays basic (`fraud_flags`: reason, distance, coords, IP/UA, timestamp) —
  no full risk engine, no auto-revocation.
- Static QR remains shareable; combined with 1/day + soft geofence + logging this is the
  accepted trade-off (presence not strictly enforced).
- `undo` dropped (no staff). Redemption is a customer tap (optional soft geofence), reached
  from the reward page (no QR required).
