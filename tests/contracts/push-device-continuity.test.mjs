import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902122000_require_push_device_continuity.sql",
    import.meta.url
  ),
  "utf8"
)
const reactivationMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902130000_require_proof_for_revoked_push_reactivation.sql",
    import.meta.url
  ),
  "utf8"
)

test("cross-customer push transfer requires both existing browser keys", () => {
  const registration = migration.slice(
    migration.indexOf(
      "create or replace function public.register_push_subscription_for_customer"
    )
  )
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(
    migration,
    /existing_owner\.p256dh is distinct from trim\(p_p256dh\)/
  )
  assert.match(
    migration,
    /existing_owner\.auth is distinct from trim\(p_auth\)/
  )
  assert.match(migration, /normalized_permission <> 'granted'/)
  assert.match(
    migration,
    /order by[\s\S]*subscriptions\.enabled and subscriptions\.revoked_at is null\) desc,[\s\S]*subscriptions\.continuity_version desc/
  )
  assert.match(migration, /push_subscription_continuity_version_seq/)
  assert.match(migration, /continuity_trusted boolean/)
  assert.match(
    migration,
    /not ranked\.has_active_owner[\s\S]*endpoint_recency_rank = 1[\s\S]*recency_tie_count > 1/
  )
  assert.match(
    migration,
    /not existing_owner\.continuity_trusted[\s\S]*operator reconciliation/
  )
  assert.match(
    migration,
    /continuity_version = nextval\([\s\S]*push_subscription_continuity_version_seq/
  )
  assert.match(
    migration,
    /revoke all on sequence public\.push_subscription_continuity_version_seq[\s\S]*from public, anon, authenticated/
  )
  assert.doesNotMatch(registration, /order by subscriptions\.updated_at desc/)
  assert.doesNotMatch(registration, /subscriptions\.revoked_at desc nulls last/)
  assert.match(migration, /raise insufficient_privilege/)
  assert.match(
    migration,
    /revoke all on function public\.register_push_subscription\([\s\S]*from public, anon, authenticated/
  )

  const proofCheck = migration.indexOf("if existing_owner.id is not null")
  const transfer = migration.indexOf("failure_reason = 'ownership_transferred'")
  assert.ok(proofCheck >= 0 && proofCheck < transfer)
})

test("revoked same-customer history also requires the existing browser keys", () => {
  assert.match(reactivationMigration, /or not existing_owner\.enabled/i)
  assert.match(
    reactivationMigration,
    /or existing_owner\.revoked_at is not null/i
  )
  assert.match(
    reactivationMigration,
    /existing_owner\.p256dh is distinct from trim\(p_p256dh\)[\s\S]*existing_owner\.auth is distinct from trim\(p_auth\)/i
  )
})
