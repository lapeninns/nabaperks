import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("nightly mutation load runs only in protected isolated staging", () => {
  const nightly = read(".github/workflows/nightly.yml")

  assert.match(nightly, /load-race:[\s\S]*environment: Staging/)
  assert.match(nightly, /LOAD_TARGET_MODE: isolated-staging/)
  assert.match(
    nightly,
    /LOAD_ISOLATED_STAGING_ORIGIN: \$\{\{ vars\.ISOLATED_STAGING_LOAD_ORIGIN \}\}/
  )
  assert.match(nightly, /RACE_STATE_URL: \$\{\{ vars\.RACE_STATE_URL \}\}/)
  assert.match(nightly, /RACE_RUN_ID: nightly-\$\{\{ github\.run_id \}\}/)
})

test("performance and k6 probes fail closed on unsafe targets and state", () => {
  const perf = read("scripts/perf-stress.mjs")
  const policy = read("scripts/perf-stress-policy.mjs")
  const race = read("tests/load/stamp-redeem-race.js")
  const targetSafety = read("tests/load/target-safety.js")

  assert.match(perf, /await proveAppTarget\(\)/)
  assert.match(perf, /assertPerformanceBudgets\(/)
  assert.match(policy, /refusing to stress production host/)
  assert.match(targetSafety, /refusing to load-test production host/)
  assert.match(race, /http\.batch\(requests\)/)
  assert.match(race, /assertFinalRaceState\(/)
  assert.doesNotMatch(race, /\b401\b|\b403\b/)
})
