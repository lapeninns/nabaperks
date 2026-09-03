import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902126000_prevent_overlapping_reward_collections.sql",
    import.meta.url
  ),
  "utf8"
)
const legacyBoundaryMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902129000_harden_legacy_reward_scan_collection.sql",
    import.meta.url
  ),
  "utf8"
)
const provenanceMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902131000_preserve_reward_collection_provenance.sql",
    import.meta.url
  ),
  "utf8"
)
const collection = readFileSync(
  new URL("../../lib/merchant/reward-collection.ts", import.meta.url),
  "utf8"
)

test("one live scan capability exists per reward", () => {
  assert.match(migration, /reward_scan_tokens_one_live_per_reward_idx/)
  assert.match(migration, /where consumed_at is null and superseded_at is null/)
  assert.match(migration, /retire_previous_reward_scan_tokens/)
  assert.match(migration, /superseded_at = clock_timestamp\(\)/)
  assert.match(migration, /expires_at = '-infinity'::timestamptz/)
})

test("merchant collection distinguishes stale forms from first collection", () => {
  assert.match(migration, /for update of tokens, rewards/)
  assert.match(migration, /v_token\.reward_status = 'redeemed'/)
  assert.match(
    migration,
    /if scan_record\.superseded_at is not null then[\s\S]*scan_status := 'expired'/
  )
  assert.doesNotMatch(
    migration,
    /scan_record\.consumed_at is not null or scan_record\.event_status = 'redeemed'/
  )
  assert.match(collection, /collect_current_reward_scan_token/)
  assert.match(collection, /reward already collected/)
  assert.match(collection, /scan token superseded/)
})

test("the directly executable legacy collector enforces the same transition", () => {
  assert.match(legacyBoundaryMigration, /for update of tokens, rewards/i)
  assert.match(legacyBoundaryMigration, /superseded_at is not null/i)
  assert.match(legacyBoundaryMigration, /reward_status = 'redeemed'/i)
  assert.match(
    legacyBoundaryMigration,
    /revoke all on function public\.collect_reward_scan_token\(uuid, uuid\)[\s\S]*from public, anon, authenticated/i
  )
  assert.match(legacyBoundaryMigration, /p_merchant_id is null/i)
  assert.match(
    legacyBoundaryMigration,
    /merchant_id is distinct from p_merchant_id/i
  )
})

test("self-service preserves its retries but cannot inherit merchant success", () => {
  assert.match(provenanceMigration, /for update/i)
  assert.match(
    provenanceMigration,
    /tokens\.reward_event_id = p_reward_event_id[\s\S]*tokens\.consumed_at is not null/i
  )
  assert.match(provenanceMigration, /Reward already collected by merchant/i)
  assert.match(
    provenanceMigration,
    /revoke all on function private\.redeem_self_service_reward_transition[\s\S]*authenticated, service_role/i
  )
})
