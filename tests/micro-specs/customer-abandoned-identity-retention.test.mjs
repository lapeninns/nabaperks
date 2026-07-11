import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

test("Given verified identity abandonment When retention source is inspected Then only history-free customers are anonymized after seven days", () => {
  const migration = readFileSync(
    "supabase/migrations/20260713120000_abandoned_customer_identity_retention.sql",
    "utf8"
  )
  const route = readFileSync("app/api/cron/privacy-retention/route.ts", "utf8")

  assert.match(migration, /admin_purge_abandoned_customer_identities/)
  assert.match(migration, /not exists \([\s\S]*customer_memberships/)
  assert.match(migration, /not exists \([\s\S]*consent_records/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /referrer_customer_id/)
  assert.match(migration, /data_request_logged/)
  assert.match(migration, /update public\.customer_sessions[\s\S]*revoked_at = now\(\)/)
  assert.match(migration, /requires the service role/)
  assert.match(route, /ABANDONED_IDENTITY_RETENTION_DAYS = 7/)
  assert.match(route, /admin_purge_abandoned_customer_identities/)
})
