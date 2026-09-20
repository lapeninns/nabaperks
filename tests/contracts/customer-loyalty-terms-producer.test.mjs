import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const source = readFileSync(
  path.join(root, "lib/notifications/notification-producers.ts"),
  "utf8"
)

test("loyalty terms updates are scheduled from persisted cutover notices", () => {
  const start = source.indexOf("async function enqueueLoyaltyTermsUpdated")
  const end = source.indexOf("async function enqueueRawEvent", start)
  const producer = source.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.match(
    producer,
    /\.rpc\(\s*"list_pending_loyalty_terms_updates",\s*\{\s*p_limit: 100,?\s*\}\s*\)/
  )
  assert.match(
    producer,
    /const membershipId = stringValue\(row\.membership_id\)/
  )
  assert.doesNotMatch(producer, /\.from\("customer_memberships"\)/)
  assert.match(producer, /eventType = "loyalty_terms_updated"/)
  assert.match(producer, /url: `\/card\/\$\{membershipId\}`/)
  assert.match(producer, /source: "policy_cutover"/)
  assert.match(producer, /policy_cutover_notice_at: cutoverAt/)
  assert.match(producer, /londonBusinessDate\(new Date\(cutoverAt\)\)/)
  assert.match(
    producer,
    /dedupeKey: `loyalty_terms_updated:\$\{membershipId\}:\$\{cutoverAt\}`/
  )
  assert.doesNotMatch(producer, /update\(|insert\(/)
})
