import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// MS-db-dead-field-cleanup — pins the cleanup-migration contract:
//   1. get_reward_scan_context is recreated (drop + create, since RETURNS
//      shapes cannot be replaced) BEFORE the column drops, without the
//      never-assigned min_spend_pence column, and with its service-role-only
//      execute grant restored (drop+create would otherwise fall back to
//      PUBLIC execute);
//   2. all seven dead columns, seven duplicate indexes, and the dead
//      record_qr_download RPC are dropped with idempotent guards; and
//   3. the seed no longer feeds the dropped merchants ROI columns.
// The live-DB proof is tests/db/dead-field-cleanup.test.mjs.

const migration = readFileSync(
  "supabase/migrations/20260707091000_dead_field_cleanup.sql",
  "utf8"
)
const seed = readFileSync("supabase/seed.sql", "utf8")

test("the scan-context function is recreated without min_spend_pence and re-granted", () => {
  assert.match(
    migration,
    /drop function if exists public\.get_reward_scan_context/i,
    "shape change requires drop + create"
  )
  const createAt = migration.search(
    /create (or replace )?function public\.get_reward_scan_context/i
  )
  assert.ok(createAt >= 0, "the function is recreated in the same migration")
  const returnsLine = migration
    .slice(createAt)
    .match(/returns table\([^)]*\)/i)?.[0]
  assert.ok(returnsLine, "the recreated function declares a RETURNS TABLE shape")
  assert.doesNotMatch(
    returnsLine,
    /min_spend_pence/,
    "the recreated RETURNS shape must not carry min_spend_pence"
  )
  assert.match(
    migration,
    /revoke all on function public\.get_reward_scan_context/i,
    "PUBLIC execute must be revoked after recreation"
  )
  assert.match(
    migration,
    /grant execute on function public\.get_reward_scan_context[\s\S]{0,80}to service_role/i,
    "service_role keeps execute after recreation"
  )
})

test("every drop is guarded and complete", () => {
  for (const column of [
    "min_spend_pence",
    "average_order_value_pence",
    "estimated_gross_margin_bps",
    "reward_cost_pence",
    "timezone",
  ]) {
    assert.match(
      migration,
      new RegExp(`drop column if exists ${column}`, "i"),
      `${column} must be dropped with an idempotent guard`
    )
  }
  for (const index of [
    "billing_customers_merchant_id_idx",
    "customers_auth_user_id_idx",
    "customer_memberships_merchant_id_idx",
    "loyalty_cards_merchant_location_idx",
    "merchant_locations_merchant_id_idx",
    "reward_events_membership_id_idx",
    "stamp_events_membership_id_idx",
  ]) {
    assert.match(
      migration,
      new RegExp(`drop index if exists public\\.${index}`, "i"),
      `${index} must be dropped with an idempotent guard`
    )
  }
  assert.match(
    migration,
    /drop function if exists public\.record_qr_download\(uuid, uuid, text\)/i,
    "the dead RPC must be dropped by exact signature"
  )
})

test("the seed no longer feeds the dropped ROI columns", () => {
  assert.doesNotMatch(seed, /average_order_value_pence/, "seed must not reference the ROI trio")
  assert.doesNotMatch(seed, /estimated_gross_margin_bps/, "seed must not reference the ROI trio")
  assert.doesNotMatch(seed, /reward_cost_pence/, "seed must not reference the ROI trio")
})
