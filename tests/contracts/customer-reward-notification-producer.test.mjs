import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const producer = readFileSync(
  path.join(root, "lib/notifications/notification-producers.ts"),
  "utf8"
)
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260922100100_reward_collection_state.sql"
  ),
  "utf8"
)

test("ready and expiry producers use fair pending candidates and one authoritative state batch", () => {
  assert.equal(
    (producer.match(/"list_pending_reward_notification_candidates"/g) ?? [])
      .length,
    2
  )
  assert.equal(
    (producer.match(/"get_reward_collection_states"/g) ?? []).length,
    1
  )
  assert.doesNotMatch(producer, /rpc\("get_reward_collection_state"/)
  assert.match(producer, /collection\?\.state !== "ready"/)
  assert.match(
    producer,
    /\["waiting", "ready"\]\.includes\(collection\?\.state \?\? ""\)/
  )
  // A recoverable setup block still receives the final expiry warning.
  assert.match(producer, /isCollectionSetupBlock\(collection\.reason\)/)
  assert.match(producer, /expiresAt: collection\.expiresAt/)
  assert.match(producer, /nullableString\(row\.reward_event_id\)/)
})

test("pending candidates remove notified and blocked rewards before the bounded page", () => {
  assert.match(
    migration,
    /not exists \([\s\S]*?notifications\.reward_event_id = rewards\.id[\s\S]*?notifications\.event_type = p_event_type/
  )
  assert.match(migration, /collection\.state = 'ready'/)
  assert.match(migration, /collection\.state in \('waiting', 'ready'\)/)
  assert.match(
    migration,
    /collection\.state = 'blocked'[\s\S]*?'Complete your profile before redeeming'[\s\S]*?'Verified email required for reward collection'/
  )
  assert.match(migration, /limit p_limit/)
  assert.doesNotMatch(migration, /grant execute[\s\S]*?to authenticated/)
})
