import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

test("Given a customer joins When migration source is inspected Then terms evidence is authoritative, atomic, and service-role-only", () => {
  const migration = readFileSync(
    "supabase/migrations/20260713110000_customer_loyalty_terms_evidence.sql",
    "utf8"
  )

  assert.match(migration, /create table if not exists public\.customer_loyalty_terms_acceptances/)
  assert.match(migration, /unique \(membership_id, policy_version\)/)
  assert.match(migration, /digest\(v_terms_snapshot, 'sha256'\)/)
  assert.match(migration, /'earning-rule'/)
  assert.match(migration, /'fraud-and-abuse'/)
  assert.match(migration, /v_stamps_required/)
  assert.match(
    migration,
    /on conflict on constraint customer_terms_membership_policy_unique do nothing/
  )
  assert.match(migration, /grant select, insert[\s\S]*to service_role/i)
  assert.doesNotMatch(migration, /grant [^;]*to authenticated/i)
})
