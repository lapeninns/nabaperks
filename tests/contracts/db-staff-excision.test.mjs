import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

// contract-db-staff-excision — pins the excision contract:
//   1. the orphan lib module is gone from the repo,
//   2. the migration rewrites all NINE staff-referencing policies (the audit
//      undercounted at two — the _scoped predicates carried staff arms too),
//      drops the three staff functions by exact signature, and drops the
//      table, and
//   3. the actor_type history vocabulary ('staff') survives on
//      audit_logs/product_events.
// The behavioral proof (owner/admin parity, tenant isolation) lives in
// tests/db/staff-excision.test.mjs.

const migration = readFileSync(
  "supabase/migrations/20260707092000_staff_subsystem_excision.sql",
  "utf8"
)
const seed = readFileSync("supabase/seed.sql", "utf8")

test("the orphan staff lib module is gone", () => {
  assert.equal(
    existsSync("lib/merchant/staff-members.ts"),
    false,
    "lib/merchant/staff-members.ts had zero importers and must be deleted"
  )
})

test("the migration excises the full staff perimeter", () => {
  for (const policy of [
    "audit_logs_select_scoped",
    "customer_memberships_select_scoped",
    "loyalty_cards_select_scoped",
    "merchant_locations_select_scoped",
    "merchants_select_owned_or_admin",
    "qr_codes_select_owner_admin",
    "reward_events_select_scoped",
    "reward_pool_items_select_owner_admin",
    "stamp_events_select_scoped",
  ]) {
    assert.match(
      migration,
      new RegExp(`create policy ${policy} `),
      `${policy} must be recreated without the staff arm`
    )
  }
  assert.doesNotMatch(
    migration,
    /select public\.is_staff_for_merchant/,
    "no recreated policy may call the staff helper"
  )
  assert.match(migration, /drop function if exists public\.add_staff_member\(text, text\)/)
  assert.match(
    migration,
    /drop function if exists public\.set_staff_member_active\(uuid, boolean\)/
  )
  assert.match(
    migration,
    /drop function if exists public\.is_staff_for_merchant\(uuid, uuid\)/
  )
  assert.match(migration, /drop table if exists public\.staff_users/)
})

test("the seed no longer creates staff rows; history vocabulary survives", () => {
  assert.doesNotMatch(seed, /staff_users/, "the seed staff insert is gone")
  assert.doesNotMatch(
    migration.replace(/^--.*$/gm, ""),
    /actor_type/,
    "the migration must not touch the history-bearing actor_type enums"
  )
})
