import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const cardActions = readFileSync("app/app/card/actions.ts", "utf8")
const directRewardActions = readFileSync(
  "app/app/customers/send-reward/actions.ts",
  "utf8"
)
const collectionActions = readFileSync(
  "app/app/launch/collection-actions.ts",
  "utf8"
)
const venueFields = readFileSync(
  "lib/merchant/venue-location-submission.ts",
  "utf8"
)

test("merchant reward actions retain every named policy argument expected by PostgREST", () => {
  for (const contract of [
    /rpc\("save_loyalty_card",\s*\{[\s\S]*?p_minimum_spend_pence:[\s\S]*?p_one_transaction_per_stamp:/,
    /rpc\("upsert_reward_pool_item",\s*\{[\s\S]*?p_requires_age_check:/,
    /rpc\("add_reward_pool_presets",\s*\{[\s\S]*?requires_age_check:/,
    /rpc\("save_loyalty_card_birthday_reward",\s*\{[\s\S]*?p_requires_age_check:/,
  ]) {
    assert.match(cardActions, contract)
  }

  assert.match(
    directRewardActions,
    /rpc\(\s*"create_bounded_merchant_reward_invite",[\s\S]*?p_requires_age_check:/
  )
  assert.match(
    directRewardActions,
    /rpc\("issue_merchant_direct_reward",\s*\{[\s\S]*?p_requires_age_check:/
  )
})

test("venue actions retain the trading boundary and complete collection RPC contracts", () => {
  assert.match(
    venueFields,
    /trading_day_starts_at:\s*submission\.tradingDayStartsAt/
  )
  for (const contract of [
    /rpc\("save_venue_collection_windows",\s*\{\s*p_merchant_id:[\s\S]*?p_location_id:[\s\S]*?p_windows:/,
    /rpc\("add_venue_closure",\s*\{\s*p_merchant_id:[\s\S]*?p_location_id:[\s\S]*?p_starts_at:[\s\S]*?p_ends_at:[\s\S]*?p_reason:/,
    /rpc\("end_venue_closure",\s*\{\s*p_closure_id:/,
  ]) {
    assert.match(collectionActions, contract)
  }
})

test("collection-window replacement is delegated to the atomic location-scoped RPC", () => {
  assert.match(
    collectionActions,
    /p_merchant_id:\s*merchant\.id,[\s\S]*?p_location_id:\s*locationId,[\s\S]*?p_windows:\s*parsed\.windows/
  )
  assert.doesNotMatch(collectionActions, /otherWindows|\.neq\("location_id"/)
})
