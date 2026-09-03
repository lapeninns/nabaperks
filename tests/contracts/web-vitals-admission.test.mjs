import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")

const migration = read(
  "supabase/migrations/20260902133000_bound_web_vital_ingestion.sql"
)
const recorder = read("lib/analytics/web-vitals.ts")
const route = read("app/api/analytics/web-vitals/route.ts")

test("web-vital replay and global admission meet at one database boundary", () => {
  assert.match(migration, /nabaperks:web-vital:v1:/)
  assert.match(migration, /on conflict \(id\) do nothing/i)
  assert.match(migration, /if not found then[\s\S]*return false/i)
  assert.match(migration, /'web-vitals-global-burst-v1'[\s\S]*600[\s\S]*60000/i)
  assert.match(
    migration,
    /'web-vitals-global-daily-v1'[\s\S]*10000[\s\S]*86400000/i
  )
  assert.match(
    migration,
    /revoke insert on table public\.web_vital_samples from service_role/i
  )
  assert.match(recorder, /rpc\("record_web_vital_sample"/)
  assert.doesNotMatch(recorder, /\.from\("web_vital_samples"\)\.insert/)
  assert.ok(
    migration.indexOf("web-vitals-global-burst-v1") <
      migration.indexOf("on conflict (id) do nothing"),
    "global work admission precedes replay detection"
  )
})

test("global telemetry exhaustion is a bounded best-effort response", () => {
  assert.match(recorder, /throw new RateLimitError/)
  assert.match(
    route,
    /error instanceof RateLimitError[\s\S]*errorResponse\(429\)/
  )
  assert.match(
    route,
    /await recordWebVitalSample\(sample\)[\s\S]*noStoreEmpty\(202\)/
  )
})
