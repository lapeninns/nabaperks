import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const helper = readFileSync(
  path.join(
    projectRoot,
    "tests",
    "e2e",
    "helpers",
    "merchant-reward-preset-live-db.ts"
  ),
  "utf8"
)

test("reward live proof scopes its combined product-event count to the atomic operation", () => {
  const end = helper.indexOf("as product_event_count")
  assert.notEqual(end, -1)
  const start = helper.lastIndexOf("(select count(*)", end)
  assert.notEqual(start, -1)
  const query = helper.slice(start, end)

  assert.match(query, /event_name\s*=\s*'reward_pool_item_created'/)
  assert.match(query, /metadata\s*->>\s*'source'\s*=\s*'reward_preset_batch'/)
  assert.match(query, /metadata\s*->>\s*'loyalty_card_id'/)
  assert.match(query, /event_name\s*=\s*'qr_created'/)
  assert.doesNotMatch(query, /merchant_launch_entered/)
})
