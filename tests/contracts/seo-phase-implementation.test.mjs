import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const root = process.cwd()

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

function run(script, fixture) {
  return spawnSync(
    process.execPath,
    [
      path.join(root, "scripts", script),
      path.join(root, "tests", "fixtures", fixture),
    ],
    { encoding: "utf8" }
  )
}

test("Phase 2 keeps retirement candidates discoverable without claiming evidence for a destructive redirect", () => {
  const persona = read("components", "marketing", "persona-page.tsx")
  const facts = read("lib", "marketing", "facts.ts")

  assert.match(persona, /index: false,[\s\S]*follow: true/)
  assert.doesNotMatch(facts, /path: ROUTES\.(?:cafes|bars|takeaways)/)

  const result = run("audit-seo-content.mjs", "seo-content-audit.csv")
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\/dead,0,0,0,0,dead intent,,KILL_REVIEW_410/)
  assert.match(result.stdout, /\/cannibal[^\n]+CONSOLIDATE_301,\/winner/)
  assert.match(result.stdout, /\/linked[^\n]+KILL_REVIEW_301,\/winner/)
})

test("Phase 3 captures privacy-bounded field metrics and keeps brochure routes outside the auth Proxy", () => {
  const proxy = read("proxy.ts")
  const reporter = read("components", "analytics", "web-vitals-reporter.tsx")
  const migration = read(
    "supabase",
    "migrations",
    "20260719160000_web_vital_samples.sql"
  )

  assert.doesNotMatch(proxy, /"\/pricing\/:path\*"/)
  assert.match(reporter, /useReportWebVitals/)
  assert.match(reporter, /navigator\.sendBeacon/)
  assert.doesNotMatch(
    migration,
    /^\s*(?:raw_url|ip_address|contact(?:_detail)?)\s+/m
  )
  assert.match(migration, /purge_web_vital_samples/)
  assert.match(migration, /force row level security/)
})

test("Phase 3 keeps the browser and database web-vital route vocabularies aligned", () => {
  const contract = read("lib", "analytics", "web-vitals-contract.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260728190000_add_faq_web_vital_route.sql"
  )
  const routeKeys = contract
    .match(/WEB_VITAL_ROUTE_KEYS = \[([\s\S]*?)\] as const/)?.[1]
    ?.match(/"([^"]+)"/g)
    ?.map((value) => value.slice(1, -1))
  const databaseKeys = migration
    .match(/route_key in \(([\s\S]*?)\)/)?.[1]
    ?.match(/'([^']+)'/g)
    ?.map((value) => value.slice(1, -1))

  assert.ok(routeKeys, "application web-vital route keys missing")
  assert.ok(databaseKeys, "database web-vital route constraint missing")
  assert.deepEqual(databaseKeys, routeKeys)
})

test("Phase 4 produces evidence-led crawl smoking guns without mutating crawler policy", () => {
  const result = run("analyze-crawl-logs.mjs", "seo-crawl-logs.csv")
  assert.equal(result.status, 0, result.stderr)

  const report = JSON.parse(result.stdout)
  assert.equal(report.bot_requests, 5)
  assert.equal(report.smoking_guns.parameter_urls, 3)
  assert.equal(report.smoking_guns.utility_or_faceted_paths, 1)
  assert.equal(report.smoking_guns.private_paths, 1)
  assert.equal(report.smoking_guns.not_found_4xx, 1)
  assert.equal(report.smoking_guns.server_5xx, 1)
  assert.deepEqual(report.repeated_query_variant_groups, [
    { path: "/", variants: 2 },
  ])
})
