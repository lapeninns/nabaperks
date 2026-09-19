import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (...segments) => readFileSync(path.join(root, ...segments), "utf8")

test("merchant customer badges consume one authorised canonical predicate batch", () => {
  const dashboard = read("lib", "merchant", "dashboard.ts")
  const batch = read("lib", "merchant", "customer-collection-states.ts")
  const readback = read("lib", "merchant", "customer-readback.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260922100100_reward_collection_state.sql"
  )

  assert.match(dashboard, /createSupabaseServerClient\(\)/)
  assert.match(
    dashboard,
    /\.from\("reward_events"\)[\s\S]*?\.eq\("merchant_id", merchantId\)[\s\S]*?\.eq\("status", "unlocked"\)[\s\S]*?\.in\("membership_id", membershipIds\)/
  )
  assert.match(
    dashboard,
    /loadMerchantRewardCollectionStates\([\s\S]*?authorisedRewards[\s\S]*?createSupabaseServiceRoleClient\(\)[\s\S]*?service\.rpc\("get_reward_collection_states", args\)/
  )
  assert.doesNotMatch(dashboard, /service\.rpc\("get_reward_collection_state",/)
  assert.match(
    migration,
    /create or replace function public\.get_reward_collection_states\(p_reward_ids uuid\[\]\)[\s\S]*?returns table \(\s*reward_id uuid,[\s\S]*?requires_age_check boolean\s*\)/
  )
  assert.match(
    migration,
    /revoke all on function public\.get_reward_collection_states\(uuid\[\]\)[\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.get_reward_collection_states\(uuid\[\]\) to service_role;/
  )
  assert.match(batch, /MAX_MERCHANT_REWARD_STATE_BATCH = 256/)
  assert.match(batch, /rpc\(\{ p_reward_ids: chunk \}\)/)
  assert.match(batch, /parseRewardCollectionState\(value\)\.state/)
  assert.match(readback, /collectionState: row\.activeReward\.collection_state/)
  assert.match(readback, /switch \(active\.collectionState\)/)
  assert.doesNotMatch(
    readback,
    /active\.redeemableFrom|active\.redeemable_from/
  )
  assert.doesNotMatch(
    readback.slice(
      readback.indexOf("export function deriveMerchantCustomerRewardBadge"),
      readback.indexOf("export function deriveMerchantCustomerInitials")
    ),
    /currentStampCount\s*>?=|stampsRequired/
  )
})
