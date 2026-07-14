import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db dead field cleanup — live-DB tier.
 *
 * The 2026-07-06 schema audit verified these fields dead (no app read/write,
 * no live DB-function dependency): min_spend_pence ×3 (the 20260624
 * remove_minimum_spend migration dropped the RPC params but not the columns),
 * the merchants ROI trio, merchant_locations.timezone, seven duplicate
 * indexes, and the never-called record_qr_download function. This suite pins
 * their absence AND that the load-bearing neighbours survived:
 * get_reward_scan_context keeps working (minus its never-assigned
 * min_spend_pence column) and the keep-list uniques stay.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const DROPPED_COLUMNS = [
  ["loyalty_cards", "min_spend_pence"],
  ["reward_pool_items", "min_spend_pence"],
  ["reward_events", "min_spend_pence"],
  ["merchants", "average_order_value_pence"],
  ["merchants", "estimated_gross_margin_bps"],
  ["merchants", "reward_cost_pence"],
  ["merchant_locations", "timezone"],
]

const DROPPED_INDEXES = [
  "billing_customers_merchant_id_idx",
  "customers_auth_user_id_idx",
  "customer_memberships_merchant_id_idx",
  "loyalty_cards_merchant_location_idx",
  "merchant_locations_merchant_id_idx",
  "reward_events_membership_id_idx",
  "stamp_events_membership_id_idx",
]

const KEEP_INDEXES = [
  "billing_customers_merchant_id_key",
  "customers_auth_user_id_key",
  "customer_memberships_merchant_id_customer_id_key",
  "customer_memberships_merchant_id_customer_id_id_key",
  "loyalty_cards_merchant_id_location_id_id_key",
  "merchant_locations_merchant_id_id_key",
  "reward_events_membership_cycle_idx",
  "stamp_events_membership_cycle_idx",
]

test("the seven dead columns are gone", { skip }, async () => {
  const sql = db()
  const conditions = DROPPED_COLUMNS.map(
    ([table, column]) =>
      `(table_name = '${table}' and column_name = '${column}')`
  ).join(" or ")
  const rows = await sql.unsafe(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and (${conditions})`)
  assert.deepEqual(
    rows.map((row) => `${row.table_name}.${row.column_name}`),
    [],
    "no dead column may remain in the public schema"
  )
})

test("the seven duplicate indexes are gone and the keep-list survives", { skip }, async () => {
  const sql = db()
  const quoted = (names) => names.map((name) => `'${name}'`).join(", ")
  const dropped = await sql.unsafe(`
    select indexname from pg_indexes
    where schemaname = 'public' and indexname in (${quoted(DROPPED_INDEXES)})`)
  assert.equal(dropped.length, 0, "no duplicate index may remain")

  const kept = await sql.unsafe(`
    select indexname from pg_indexes
    where schemaname = 'public' and indexname in (${quoted(KEEP_INDEXES)})`)
  assert.equal(
    kept.length,
    KEEP_INDEXES.length,
    "every keep-list unique/composite-FK-target index must survive untouched"
  )
})

test("record_qr_download is gone", { skip }, async () => {
  const sql = db()
  const rows = await sql.unsafe(`
    select proname from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'record_qr_download'`)
  assert.equal(rows.length, 0, "the never-called RPC must be dropped")
})

test("get_reward_scan_context keeps working without min_spend_pence", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [row] = await tx`
      select * from public.get_reward_scan_context(
        ${randomUUID()}::uuid, ${randomUUID()}::uuid)`
    assert.ok(row, "the scan-context function still answers")
    assert.equal(row.scan_status, "not_found", "an unknown token reads not_found")
    assert.ok(
      !("min_spend_pence" in row),
      "the result shape no longer carries the never-assigned min_spend_pence"
    )
    assert.ok("reward_name" in row, "the rest of the result shape is intact")
    assert.ok("blocked_reason" in row, "the rest of the result shape is intact")
  })
})

test("scan-context execution stays service-role scoped after recreation", { skip }, async () => {
  const sql = db()
  const [{ acl }] = await sql`
    select proacl::text as acl from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'get_reward_scan_context'`
  assert.ok(acl, "the recreated function must not fall back to default PUBLIC execute")
  assert.match(acl, /service_role=X/, "service_role keeps execute")
  assert.doesNotMatch(acl, /^\{=X/, "PUBLIC execute must not be granted")
})
