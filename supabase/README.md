# Supabase Foundation

This directory contains the MVP database foundation for Nabaperks.

## Migration Order

Apply every file in `migrations/` in filename order.

The initial migration creates the MVP tables, helper predicates, indexes,
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
The fixture IDs are stable so
`tests/tenant_isolation.sql` can replay tenant-isolation checks.

## Verification

Run static migration checks:

```bash
pnpm db:verify
```

With a local Supabase database, apply migrations and seed data, then run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/tenant_isolation.sql
```

If `psql` is not installed, use the repo runner instead. The runner uses
`SUPABASE_DB_URL` when set, or `SUPABASE_DB_PASSWORD` with
`supabase/.temp/pooler-url` when the project is linked locally:

```bash
SUPABASE_DB_URL=postgresql://... pnpm db:setup
```

For an existing database where the initial migration is already applied, run:

```bash
SUPABASE_DB_URL=postgresql://... pnpm db:seed
SUPABASE_DB_URL=postgresql://... pnpm db:test:rls
```

The SQL test switches authenticated JWT subjects to confirm two merchant owners
and two customers cannot read each other's rows. It also checks admin audit-log
write/readback and unauthenticated direct table denial.

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
