import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const MIGRATIONS_DIR = path.join(projectRoot, "supabase", "migrations")
const DEFINE = "create or replace function private.issue_visit_stamp("
const REVOKE = "revoke all on function private.issue_visit_stamp("

/**
 * The effective private.issue_visit_stamp is the one in the last migration
 * that defines it. Every guest stamp path (QR, venue code, join first stamp)
 * returns its reward_unlocked unchanged, so this one body decides whether the
 * app may show an unlock.
 */
function effectiveVisitStamp() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const defining = files.filter((file) =>
    readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").includes(DEFINE)
  )
  const file = defining.at(-1)
  assert.ok(file, "a migration defines private.issue_visit_stamp")
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
  const start = sql.lastIndexOf(DEFINE)
  const end = sql.indexOf(REVOKE, start)
  assert.ok(end > start, "the definition is followed by its revoke")
  return { file, body: sql.slice(start, end) }
}

test("Given the effective visit stamp Then reward_unlocked comes from the minted reward id, not the count", () => {
  const { file, body } = effectiveVisitStamp()

  assert.ok(
    file >= "20261005100500",
    `the effective definition carries the fix (found ${file})`
  )
  assert.match(
    body,
    /v_reward_id := private\.complete_cycle_if_full\(/,
    "the completion helper's return is captured"
  )
  assert.match(body, /reward_unlocked := v_reward_id is not null;/)
  assert.doesNotMatch(
    body,
    /reward_unlocked := new_stamp_count/,
    "a full count alone never reports an unlock"
  )
  assert.doesNotMatch(
    body,
    /perform private\.complete_cycle_if_full\(/,
    "the helper's result is never discarded"
  )

  const mintAt = body.indexOf("v_reward_id := private.complete_cycle_if_full(")
  const reportAt = body.indexOf("reward_unlocked := v_reward_id is not null;")
  const returnAt = body.indexOf("return next;")
  assert.ok(mintAt < reportAt && reportAt < returnAt)
})

test("Given the stamp service Then the issued result carries the RPC's reward_unlocked as-is", () => {
  const stampService = readFileSync(
    path.join(projectRoot, "lib/customer/stamp.ts"),
    "utf8"
  )
  assert.match(
    stampService,
    /rewardUnlocked: booleanValue\(row\.reward_unlocked\)/,
    "no client-side count heuristic replaces the server's answer"
  )
})
