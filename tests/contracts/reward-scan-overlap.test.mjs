import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
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

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url)
const latestMigrationDefining = (signature) =>
  readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(new URL(name, migrationsDir), "utf8"))
    .filter((sql) => sql.includes(`create or replace function ${signature}(`))
    .at(-1) ?? ""

test("the live redemption transition attributes owner counter collections", () => {
  // The latest definition wins, so a later redefinition must keep both owner
  // receipts or counter collections fall back to customer self-service.
  const transition = latestMigrationDefining(
    "private.redeem_self_service_reward_transition"
  )
  assert.match(transition, /private\.has_current_owner_id_check\(/)
  assert.match(transition, /private\.has_current_owner_counter_collection\(/)
  assert.match(
    transition,
    /case when v_owner_collection then 'merchant' else 'customer' end/
  )
})

test("owner counter collection is authenticated-only and receipts are private", () => {
  const owner = latestMigrationDefining(
    "public.collect_owner_reward_scan_token"
  )
  assert.match(owner, /private\.reward_scan_owner_merchant\(p_scan_token\)/)
  assert.doesNotMatch(
    owner,
    /collect_owner_reward_scan_token\(\s*p_scan_token uuid,\s*p_merchant_id/
  )
  assert.match(
    owner,
    /revoke all on function public\.collect_owner_reward_scan_token\(uuid\)\s+from public, anon, authenticated, service_role;\s+grant execute on function public\.collect_owner_reward_scan_token\(uuid\)\s+to authenticated;/
  )
  assert.match(
    owner,
    /revoke all on table private\.merchant_counter_collection_receipts\s+from public, anon, authenticated, service_role/
  )
  assert.match(owner, /receipts\.transaction_id = pg_current_xact_id\(\)/)
})
