import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-db-deletion-semantics — pins the deletion-semantics migration contract:
//   1. customers.auth_user_id must be ON DELETE RESTRICT (an auth-user delete
//      can no longer cascade the loyalty ledger away — the 2026-07-04 incident
//      mechanism), and
//   2. consent_records.customer_id must be nullable ON DELETE SET NULL so
//      PECR/UK-GDPR consent evidence outlives the customer row.
// The behavioral proof lives in tests/db/deletion-semantics.test.mjs; this pin
// keeps the migration text honest without a live database.

const migration = readFileSync(
  "supabase/migrations/20260707090000_deletion_semantics_fk_rules.sql",
  "utf8"
)

test("customers.auth_user_id is re-created ON DELETE RESTRICT", () => {
  assert.match(
    migration,
    /customers_auth_user_id_fkey/,
    "the migration must target the named auth-user constraint"
  )
  assert.match(
    migration,
    /references auth\.users\s*\(id\)\s*on delete restrict/i,
    "the auth-user link must be ON DELETE RESTRICT"
  )
  assert.doesNotMatch(
    migration,
    /auth\.users\s*\(id\)\s*on delete cascade/i,
    "no auth-user cascade may be re-introduced"
  )
})

test("consent_records.customer_id becomes nullable ON DELETE SET NULL", () => {
  assert.match(
    migration,
    /consent_records_customer_id_fkey/,
    "the migration must target the named consent constraint"
  )
  assert.match(
    migration,
    /references public\.customers\s*\(id\)\s*on delete set null/i,
    "consent evidence must survive customer deletion via SET NULL"
  )
  assert.match(
    migration,
    /alter column customer_id drop not null/i,
    "customer_id must become nullable for SET NULL to be legal"
  )
})
