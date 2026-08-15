import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const harness = readFileSync("scripts/perf-mutation-stress.mjs", "utf8")

test("mutation stress uses the reset seed owner and service-only RPC role", () => {
  assert.match(
    harness,
    /const OWNER_AUTH_USER_ID = "00000000-0000-0000-0000-000000000101"/
  )
  assert.match(harness, /function stampCall[\s\S]*?rpc\(\s*"service_role"/)
  assert.match(harness, /scenarioJoinIdempotent[\s\S]*?rpc\(\s*"service_role"/)
  assert.match(
    harness,
    /issue_birthday_rewards\(date_trunc\('year', now\(\)\) \+ interval '6 months 6 days 12 hours'/
  )
})
