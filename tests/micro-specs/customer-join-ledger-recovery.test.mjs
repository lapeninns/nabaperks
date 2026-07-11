import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("join and QR stamp wrappers are restored to service-role-only execution", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260713090000_repair_join_rpc_privileges.sql"
  )

  for (const signature of [
    /join_customer_membership_with_first_stamp\([\s\S]*?uuid, text, text, boolean, text, numeric, numeric, text[\s\S]*?\)/,
    /issue_self_service_stamp\([\s\S]*?uuid, uuid, text, numeric, numeric, numeric, text, integer[\s\S]*?\)/,
  ]) {
    assert.match(migration, signature)
  }

  assert.match(
    migration,
    /revoke execute on function public\.join_customer_membership_with_first_stamp\([\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.join_customer_membership_with_first_stamp\([\s\S]*?to service_role;/i
  )
  assert.match(
    migration,
    /revoke execute on function public\.issue_self_service_stamp\([\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.issue_self_service_stamp\([\s\S]*?to service_role;/i
  )
})

test("Given a QR join first-stamp failure When the recovery migration is inspected Then typed durable state and an idempotent retry RPC exist", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260713100000_customer_join_ledger_recovery.sql"
  )

  assert.match(migration, /create table if not exists public\.customer_join_stamp_recoveries/)
  assert.match(migration, /reason in \('invalid_qr', 'billing_unavailable', 'reward_pool_unavailable', 'transient'\)/)
  assert.match(migration, /resolution in \('rescan', 'retry', 'venue_action'\)/)
  assert.match(migration, /retry_until timestamptz/)
  assert.match(migration, /create or replace function public\.retry_customer_join_first_stamp/)
  assert.match(migration, /for update/)
  assert.match(migration, /grant execute[\s\S]*retry_customer_join_first_stamp[\s\S]*to service_role/i)
  assert.doesNotMatch(migration, /grant execute[\s\S]*retry_customer_join_first_stamp[\s\S]*to authenticated/i)
})

test("Given a customer reloads a card When source wiring is inspected Then recovery comes from the database rather than a query flag", () => {
  const loader = read("lib", "customer", "experience", "load-card.ts")
  const action = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const recovery = read("lib", "customer", "join-first-stamp-recovery.ts")

  assert.match(loader, /getJoinFirstStampRecovery/)
  assert.match(recovery, /customer_join_stamp_recoveries/)
  assert.doesNotMatch(loader, /searchParams\.firststamp/)
  assert.doesNotMatch(action, /params\.set\("firststamp"/)
})

test("Given durable recovery reaches the card When presentation source is inspected Then each resolution exposes only its safe action", () => {
  const card = read("components", "customer", "customer-card-experience.tsx")
  const panel = read(
    "components",
    "customer",
    "join-first-stamp-recovery-panel.tsx"
  )
  const action = read("app", "card", "[membershipId]", "actions.ts")

  assert.match(card, /exp\.firstStampRecovery \? \(/)
  assert.match(panel, /case "retry"[\s\S]*Try my first stamp again/)
  assert.match(panel, /case "rescan"[\s\S]*Scan the venue QR again/)
  assert.match(panel, /case "venue_action"[\s\S]*Ask the team/)
  assert.doesNotMatch(panel, /firststamp=/)
  assert.match(action, /retryJoinFirstStampRecovery/)
  assert.match(action, /merchantActivitySummaryCacheTag\(recovery\.merchantId\)/)
  assert.match(action, /outcome === "issued" \|\| outcome === "already_issued"/)
})
