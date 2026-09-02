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
const collection = readFileSync(
  new URL("../../lib/merchant/reward-collection.ts", import.meta.url),
  "utf8"
)

test("one live scan capability exists per reward", () => {
  assert.match(migration, /reward_scan_tokens_one_live_per_reward_idx/)
  assert.match(migration, /where consumed_at is null and superseded_at is null/)
  assert.match(migration, /retire_previous_reward_scan_tokens/)
  assert.match(migration, /superseded_at = clock_timestamp\(\)/)
  assert.match(
    migration,
    /expires_at = least\(expires_at, clock_timestamp\(\)\)/
  )
})

test("merchant collection distinguishes stale forms from first collection", () => {
  assert.match(migration, /for update of tokens, rewards/)
  assert.match(migration, /v_token\.reward_status = 'redeemed'/)
  assert.match(collection, /collect_current_reward_scan_token/)
  assert.match(collection, /reward already collected/)
  assert.match(collection, /scan token superseded/)
})
