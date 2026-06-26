# Supabase

This directory contains the database migrations and local fixture data used by
the Nabaperks app.

## Migration Order

Apply every file in `migrations/` in filename order.

The initial migration creates the core tables, helper predicates, indexes,
triggers, grants, RLS enablement, forced RLS, and role-scoped policies. It is
intended to be applied to a Supabase project where `auth.users`,
`authenticated`, `anon`, and `service_role` already exist.

The revocation migration removes direct `anon` access inherited from Supabase
defaults so unauthenticated users cannot query public tables directly. Later
migrations add the static-QR self-service stamp RPCs, optional soft geofence
checks, and cleanup for retired approval surfaces.

## Local Fixtures

`seed.sql` creates two merchants, demo customers, staff member records, QR
records, billing records, product events, and an audit log.
`seed-activity-demo.sql` adds a richer Old Crown Girton activity timeline for
dashboard and `/app/activity` demos.
`seed-user-aman.sql` adds the local Aman customer fixture.
`seed-rewards-ready-today.sql` tops up every membership to a full card with an
unlocked reward redeemable from today's UK business date.
`seed-second-cycle-complete.sql` redeems that reward, advances the loyalty cycle,
and tops the next cycle up to three stamps with another redeemable reward.
The fixture IDs are stable so local demos and manual smoke checks can be reset
without changing route URLs or merchant/customer identifiers.

## Verification

With a local Supabase database, apply migrations and seed data using the repo
runner. The runner uses `SUPABASE_DB_URL` when set, or `SUPABASE_DB_PASSWORD`
with `supabase/.temp/pooler-url` when the project is linked locally:

```bash
SUPABASE_DB_URL=postgresql://... pnpm db:setup
```

For an existing database where the initial migration is already applied, run:

```bash
SUPABASE_DB_URL=postgresql://... pnpm db:seed
```

## Access Model

- Merchant owners can read and manage their merchant-owned records.
- Staff are scoped to their assigned merchant/location.
- Customers can read their own profile, memberships, card context, stamp events,
  reward events, consent records, and product-event rows tied to them.
- Internal admins are listed in `internal_admins` and can perform support
  actions.
- Business-critical mutation tables such as `audit_logs`, `product_events`,
  `stamp_events`, billing, and reward updates are not opened to normal client
  writes. Trusted server functions should use the service-role helper in
  `lib/supabase/server.ts` and keep service-role keys server-side only.
