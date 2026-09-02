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

test("cross-customer push transfer requires both existing browser keys", () => {
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
  assert.match(migration, /order by subscriptions\.updated_at desc/)
  assert.match(migration, /raise insufficient_privilege/)
  assert.match(
    migration,
    /revoke all on function public\.register_push_subscription\([\s\S]*from public, anon, authenticated/
  )

  const proofCheck = migration.indexOf("if existing_owner.id is not null")
  const transfer = migration.indexOf("failure_reason = 'ownership_transferred'")
  assert.ok(proofCheck >= 0 && proofCheck < transfer)
})
