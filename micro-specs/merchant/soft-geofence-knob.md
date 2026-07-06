---
spec_id: MS-merchant-soft-geofence-knob
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/merchant/**
  - supabase/migrations/20260707093000_soft_geofence_trigger_knob.sql
  - lib/merchant/venue-location-submission.ts
  - lib/merchant/location.ts
  - app/app/settings/**
  - app/app/launch/**
  - components/merchant/**
  - tests/db/soft-geofence-knob.test.mjs
  - tests/e2e/merchant-soft-geofence.spec.ts
  - tests/micro-specs/merchant-soft-geofence-knob.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707093000_soft_geofence_trigger_knob.sql
  - lib/merchant/venue-location-submission.ts
  - lib/merchant/location.ts
  - app/app/settings/**
  - app/app/launch/**
  - components/merchant/**
  - tests/db/soft-geofence-knob.test.mjs
  - tests/e2e/merchant-soft-geofence.spec.ts
  - tests/micro-specs/merchant-soft-geofence-knob.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/customer-stamp-edges.test.mjs
  - tests/e2e/governance-smoke.spec.ts
  - tests/e2e/a11y.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@governance|@soft-geofence"
  - pnpm test:a11y -- --project=chromium
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - pnpm test:db output proving the stamping flow records its soft-geofence signal on the configured cycle-stamp number and defaults to 3 when unset.
  - Playwright output for the merchant journey of setting the trigger value and seeing it persist.
  - Accessibility gate output covering the surface that hosts the new setting control.
approved_exceptions: []
---

# MS-merchant-soft-geofence-knob — Per-location soft-geofence trigger stamp setting

## 1. Exact Goal and User-Visible Outcomes

Merchants can choose which cycle-stamp number triggers the soft-geofence
location check for each venue. Today
`merchant_locations.soft_geofence_trigger_stamp_number` is a constant in
disguise — `CHECK (= 3)`, never written by any UI, read by the stamping RPC
through `coalesce(value, 3)` — so every venue checks location softly on stamp
3 of a cycle. When this ships (owner decision 2026-07-06: make the knob real
rather than drop it), a merchant can set the trigger to any stamp number from
1 to 99 on their venue settings surface; venues that never touch the setting
behave exactly as today (3). The stamping flow records its soft-geofence
signal on the configured stamp, and the change is per-location.

## 2. Blast Radius

May edit: `supabase/migrations/20260707093000_soft_geofence_trigger_knob.sql`
(new — widen the CHECK; touch the stamping RPC only if it turns out to clamp
or ignore the column), `lib/merchant/venue-location-submission.ts` and
`lib/merchant/location.ts` (persist + read the setting),
`app/app/settings/**` and `app/app/launch/**` (whichever of the two venue
surfaces already owns geofence settings hosts the control — follow the
existing pattern, do not invent a new page), `components/merchant/**` (only
if a shared form control is needed), the three new test files, and this
spec's folder.

Out of scope: hard-geofence behavior (`require_geofence`,
`geofence_radius_meters`, pin source — all unchanged); the customer stamping
UX; fraud-flag semantics beyond which stamp number fires the soft check;
`loyalty_cards.stamps_required`; RLS policies (the existing
owner-scoped update policy on merchant_locations already covers the write).

## 3. Strict Constraints and Assumptions

- DB CHECK becomes `between 1 and 99` (mirrors the stamps_required bounds);
  column stays NOT NULL with default 3.
- `issue_self_service_stamp` already reads the column via
  `coalesce(soft_geofence_trigger_stamp_number, 3)`; verify at implementation
  time that no other clamp exists. Expected outcome: the RPC needs no change
  and the migration is CHECK-only.
- Server-side validation in the submission path: integer, 1–99 inclusive;
  reject everything else with the existing form-error pattern.
- A trigger above the active card's stamps_required simply never fires within
  a cycle — allowed; the UI SHOULD hint (non-blocking) when the chosen value
  exceeds the active card's stamps_required.
- Wet Ink components and existing venue-settings form conventions
  (DESIGN.md); no new dependencies.
- Existing rows all hold 3; no backfill needed.

## 4. Decisions Already Made

- Make the knob real (owner decision 2026-07-06) — dropping the column was
  considered and rejected.
- Range 1–99 aligned with stamps_required; default stays 3.
- Per-location setting (not per-card, not per-merchant) — the column already
  lives on merchant_locations and location is the geofence-bearing entity.
- The soft-geofence semantics themselves (flag-only, non-blocking, distance
  buckets) are untouched — this spec only parameterizes WHICH stamp number
  fires the check.

## 5. Behavioral Requirements (EARS)

- WHERE a merchant has set a soft-geofence trigger stamp N for a location,
  THE self-service stamping flow SHALL record its soft-geofence signal on
  cycle stamp number N for that location.
- IF no explicit value has been set, THEN THE stamping flow SHALL behave
  exactly as today (trigger stamp 3).
- WHEN a merchant submits a trigger value that is not an integer between 1
  and 99, THE system SHALL reject it with a validation error and persist
  nothing.
- WHEN a merchant saves a valid trigger value, THE setting SHALL persist on
  that location and survive reload.
- THE database SHALL enforce the 1–99 bound via CHECK constraint regardless
  of app-side validation.
- THE hard-geofence behavior (require_geofence, radius, pin source) SHALL be
  unchanged.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Live DB: with trigger set to N, a stamped cycle records the soft-geofence
  signal at stamp N and not at 3; with the default, at 3 (extend the existing
  stamp-edges fixtures).
- Live DB: CHECK rejects 0, 100, and non-integers at the SQL layer.
- Browser (amended to the house harness pattern, same as the birthday-config
  proof): the control renders on the real venue form in the DB-free harness
  with the 3 default and accepts input (`@soft-geofence`). Persistence and
  the 1–99 rejection are proven in the live-DB tier (the CHECK) plus the
  server-side validator; the harness tier cannot exercise an authed save.
- Accessibility: the hosting surface passes the a11y gate with the new
  control present.

Task order: (1) migration widening the CHECK + failing DB test for
trigger-at-N; (2) verify the RPC honors the value (red test proves it);
(3) submission validation + persistence in lib; (4) the settings control on
the existing venue surface + e2e tagged `@soft-geofence`; (5) green;
(6) `pnpm governance:run-gates --spec MS-merchant-soft-geofence-knob
--record` and advance with `governance:advance`.
