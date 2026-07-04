# Plan 018: Spike — multi-location support (schema exists, UI hard-picks one)

> **Executor instructions**: This is a DESIGN SPIKE, not a build. The deliverable
> is a written design doc + a go/no-go recommendation, plus an optional throwaway
> prototype on a scratch branch. Do NOT ship product changes from this plan. If a
> "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/merchant/location.ts lib/merchant/onboarding.ts supabase/migrations`

## Status

- **Priority**: P3
- **Effort**: L (spike: ~1–2 days to investigate + write up)
- **Risk**: LOW (spike produces a doc; no production change)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters (product)

Pub groups / small chains are a natural UK loyalty ICP, and the "one-stamp-per-UK-day"
mechanic is per-location-meaningful. The data model was **built** for
N-locations-per-merchant (`merchant_locations` has a `merchant_id` FK and an
`is_primary` flag), but every consumer collapses to a single location, and there
is no "add location" UI. Shipping a second location is mostly UI + relaxing the
single-pick queries — no schema migration — making it the single largest
capability the architecture makes disproportionately cheap. Whether it's the
right *next* bet vs. deepening the single-site product is a maintainer call; this
spike de-risks it.

## Current state (evidence)

- Schema built for N: `merchant_locations` with `merchant_id` FK + `is_primary`
  (see `lib/merchant/location.ts:22` `is_primary: boolean`, `:34-41` selects a
  single location `.order("is_primary", …).limit(1)`).
- Every consumer collapses to one:
  - `lib/merchant/onboarding.ts:76-84` orders by `is_primary` then
    `.limit(1, { referencedTable: "merchant_locations" })`, `:105`
    `merchant_locations?.[0] ?? null`.
  - `lib/merchant/loyalty-card.ts`, `lib/merchant/profile.ts`,
    `lib/merchant/qr-code.ts` each load a single location.
- No "add location" UI — `components/merchant/launch/` has one
  `venue-location-form.tsx`; onboarding creates exactly one row.
- Related: per-cycle soft geofence exists
  (`supabase/migrations/*_cycle_stamp_soft_geofence.sql`) and is location-scoped.

## Spike deliverable

Write `docs/product/spikes/multi-location.md` containing:
1. **Consumer inventory**: every read that assumes one location (grep
   `merchant_locations`, `is_primary`, `.limit(1`, `location_id` across
   `lib/merchant/*`, `app/app/*`), each tagged "stays merchant-scoped" vs
   "must become location-scoped" (dashboard, activity, QR, digest, stamping).
2. **The QR-per-location model**: today a merchant has one join QR; define whether
   each location gets its own QR (and how the public `/q/[qrId]` → location
   mapping works), since stamping + geofence are location-specific.
3. **Stamp/geofence semantics**: does "one stamp per UK day" apply per-membership
   (unchanged) or per-location? Confirm against the moat invariant so a second
   location can't be used to double-stamp.
4. **UX**: the location-switcher in the merchant console + the "add location"
   flow; what the customer sees (one card per location? per merchant?).
5. **Migration need**: confirm whether any schema change is actually required
   (the finding says likely none — verify FKs/uniqueness constraints allow N).
6. **Go/no-go**: a coarse effort estimate for the real build, the top 3 risks,
   and a recommendation (build / defer / partial).

Optionally, on a throwaway `spike/multi-location` branch, prototype relaxing
`onboarding.ts`'s `.limit(1)` to load all locations and rendering a read-only
list — purely to size the change. Do NOT merge it.

## Commands you will need

Read-only investigation: `grep`, `pnpm typecheck` (to confirm a prototype
compiles). No product change ships.

## Scope

**In scope**: `docs/product/spikes/multi-location.md` (create); an optional
throwaway `spike/*` branch that is never merged.

**Out of scope**: any change to `main`/production behavior, schema migrations,
the moat RPCs, and the customer stamping path.

## Done criteria

- [ ] `docs/product/spikes/multi-location.md` exists and answers all six points
- [ ] The consumer inventory is concrete (file:line list), not hand-wavy
- [ ] The stamp/geofence-double-use question is explicitly resolved against the moat
- [ ] A clear go/no-go recommendation with effort + top risks
- [ ] No production code changed on `main` (`git status` on `main` clean)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- A schema change turns out to be required after all (uniqueness/FK blocks N) —
  that materially changes the effort; surface it prominently.
- Multi-location would let a customer earn two stamps/day across locations without
  a clear rule — flag this as a moat risk needing a product decision before any build.

## Maintenance notes

- This spike feeds a future build plan; keep the consumer inventory current if
  merchant loaders change before it's picked up.
