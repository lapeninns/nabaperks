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

test("collection window reminders preserve the authoritative schedule and dedupe key", () => {
  assert.match(source, /"list_collection_window_reminders"/)
  assert.match(source, /p_now: now\.toISOString\(\), p_horizon_hours: 24/)
  assert.match(source, /const dueAt = stringValue\(row\.due_at\)/)
  assert.match(source, /const dedupeKey = stringValue\(row\.dedupe_key\)/)
  assert.match(source, /\{ dueAt, dedupeKey \}/)
  assert.match(source, /url: `\/reward\/\$\{rewardEventId\}`/)
})

test("collection window reminders never derive window eligibility from browser or reward dates", () => {
  const start = source.indexOf("async function enqueueCollectionWindowOpens")
  const end = source.indexOf("async function enqueueRawEvent", start)
  const producer = source.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.doesNotMatch(producer, /get_reward_collection_state/)
  assert.doesNotMatch(producer, /expires_at\s*[<>]=?/)
  assert.doesNotMatch(producer, /new Date\(\)\.getTime/)
})
