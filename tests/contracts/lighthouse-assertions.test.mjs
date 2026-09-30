import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"

// Hosted Lighthouse evidence (118 route jobs, 22 September 2026): the first run
// in each job is a cold-server outlier, and simulated public-page LCP split
// between a ~3.35 s and a ~4.0 s mode. The harness removes a CI-only stall and
// collects five runs.
//
// Hosted evidence (155 route jobs, 25-28 September 2026): the LCP mode is set by
// the runner, not by chance. Lantern builds the LCP graph from the unthrottled
// trace, so a script counts only if its evaluation started before the observed
// paint; faster runners evaluate more of the bundle first. On home, runners with
// benchmarkIndex >= 2800 (12 of 40 jobs) put 54% of warm runs above 4000 ms,
// slower runners 0.9%. Job 36420398641 failed at 4030-4046 ms on four warm runs
// (index ~3300) and passed on rerun at 3900-3976 ms (index ~2450), with the same
// 44 requests. More runs cannot outvote the host, so best-of-N still flakes.
// LCP is therefore asserted on the median run, which a single fast run cannot
// flatter; public pages allow 4100 ms, above the highest warm home run (4094 ms)
// and job median (4047 ms) observed. Replayed through LHCI, a uniform LCP
// regression now fails home at a median +175 ms, not +650 ms under best-of-five.
const config = JSON.parse(readFileSync(".lighthouserc.json", "utf8"))
// Evaluate the configuration with the installed LHCI assertion engine, not a
// copy of its aggregation rules.
const require = createRequire(import.meta.url)
const lhciRequire = createRequire(require.resolve("@lhci/cli/package.json"))
const { getAllAssertionResults } = lhciRequire("@lhci/utils/src/assertions.js")

const HOME = "http://127.0.0.1:3130/"
const SIGNUP = "http://127.0.0.1:3130/signup"
const PRICING = "http://127.0.0.1:3130/pricing"
const LOYALTY = "http://127.0.0.1:3130/loyalty-for-pubs"

function run(url, { lcp = 3400, tbt = 60, fcp = 1400 } = {}) {
  const category = (score) => ({ score })
  return {
    finalUrl: url,
    requestedUrl: url,
    categories: {
      accessibility: category(1),
      "best-practices": category(1),
      performance: category(0.9),
      seo: category(1),
    },
    audits: {
      "first-contentful-paint": { score: 1, numericValue: fcp },
      "largest-contentful-paint": { score: 0.5, numericValue: lcp },
      "total-blocking-time": { score: 1, numericValue: tbt },
      interactive: { score: 1, numericValue: 4000 },
    },
  }
}

function failures(lhrs) {
  return getAllAssertionResults(config.ci.assert, lhrs).map(
    ({ auditId, name, actual }) => ({ auditId, name, actual })
  )
}

test("Lighthouse collects five runs per route and asserts LCP on the median", () => {
  assert.equal(config.ci.collect.numberOfRuns, 5)
  const lcpBudget = (url) =>
    config.ci.assert.assertMatrix.find(({ matchingUrlPattern }) =>
      new RegExp(matchingUrlPattern).test(url)
    ).assertions["largest-contentful-paint"]
  for (const url of [HOME, PRICING, LOYALTY])
    assert.deepEqual(lcpBudget(url), [
      "error",
      { maxNumericValue: 4100, aggregationMethod: "median" },
    ])
  assert.deepEqual(lcpBudget(SIGNUP), [
    "error",
    { maxNumericValue: 4000, aggregationMethod: "median" },
  ])
  for (const { assertions } of config.ci.assert.assertMatrix) {
    assert.deepEqual(assertions["total-blocking-time"], [
      "error",
      { maxNumericValue: 300 },
    ])
    assert.deepEqual(assertions["first-contentful-paint"], [
      "error",
      { maxNumericValue: 2500 },
    ])
    assert.deepEqual(assertions["categories:performance"], [
      "error",
      { minScore: 0.7 },
    ])
  }
})

test("Lighthouse blocks only the analytics beacons that stall hosted runs", () => {
  // CI serves the build on 127.0.0.1 with NEXT_PUBLIC_APP_URL=https://example.test,
  // so the same-origin analytics routes answer 403. The unread keepalive POST then
  // never finishes, so every public-page run waited out the 45 s load timeout
  // and was marked incomplete. Blocking it cuts a run to seconds, which is what
  // pays for five runs. Production requests are same-origin and complete.
  const patterns = config.ci.collect.settings.blockedUrlPatterns
  assert.deepEqual(patterns, ["*/api/analytics/*"])
  const blocked = (path) =>
    patterns.some((pattern) =>
      new RegExp(`^${pattern.split("*").map(RegExp.escape).join(".*")}$`).test(
        `http://127.0.0.1:3130${path}`
      )
    )
  assert.ok(blocked("/api/analytics/funnel"))
  assert.ok(blocked("/api/analytics/web-vitals"))
  for (const path of [
    "/",
    "/pricing",
    "/signup",
    "/_next/static/chunks/app/page.js",
    "/_next/static/media/font.woff2",
    "/api/health",
    "/manifest.webmanifest",
  ])
    assert.equal(blocked(path), false, path)
})

test("every Lighthouse budget group names its best-run aggregation", () => {
  // TBT, FCP and category scores stay best-run: a median TBT reached 282 ms
  // against 300 ms on a hosted home job. Only LCP overrides it, per assertion.
  // Keep the choice explicit, not a default.
  for (const group of config.ci.assert.assertMatrix) {
    assert.equal(group.aggregationMethod, "optimistic")
    for (const [auditId, [, options]] of Object.entries(group.assertions))
      assert.equal(
        options.aggregationMethod,
        auditId === "largest-contentful-paint" ? "median" : undefined,
        auditId
      )
  }
})

test("a cold run or a fast runner cannot fail a route that meets its budget", () => {
  // Hosted home job 108922326268 (run 36420398641, 28 September 2026) failed
  // best-of-five at 4029.742 ms on a fast runner; its rerun passed unchanged.
  const fastRunner = [4865.144, 4046.866, 4030.05, 4046.45, 4029.742]
  assert.deepEqual(
    failures(fastRunner.map((value) => run(HOME, { lcp: value }))),
    []
  )
  const tbt = [2765, 392, 430, 70, 64]
  assert.deepEqual(
    failures(tbt.map((value) => run(SIGNUP, { tbt: value }))),
    []
  )
})

test("a regression in the representative run fails despite one fast run", () => {
  // Best-of-five passed this at 3350 ms; the median run decides the verdict.
  const lcp = [5678, 4150, 3350, 4210, 4180]
  assert.deepEqual(failures(lcp.map((value) => run(HOME, { lcp: value }))), [
    {
      auditId: "largest-contentful-paint",
      name: "maxNumericValue",
      actual: 4180,
    },
  ])
  const signupLcp = [4400, 4010, 3050, 4030, 4020]
  assert.deepEqual(
    failures(signupLcp.map((value) => run(SIGNUP, { lcp: value }))),
    [
      {
        auditId: "largest-contentful-paint",
        name: "maxNumericValue",
        actual: 4020,
      },
    ]
  )
})

test("a TBT regression present in every run still fails the route", () => {
  const tbt = [2765, 392, 430, 318, 355]
  assert.deepEqual(failures(tbt.map((value) => run(SIGNUP, { tbt: value }))), [
    { auditId: "total-blocking-time", name: "maxNumericValue", actual: 318 },
  ])
})
