import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import {
  calculateAvailabilityReport,
  fetchScheduledSmokeRuns,
  fetchSloMeasurementRuns,
  readSloConfig,
  reportWindow,
} from "../../scripts/check-production-slo.mjs"

const CONFIG = {
  probeIntervalMinutes: 15,
  windowDays: 1,
  availabilityObjective: 0.99,
  minimumObservedSamplesPerDay: 4,
  minimumObservationDays: 1,
}
const NOW = new Date("2026-07-22T23:45:00.000Z")
const WINDOW_START = new Date("2026-07-22T00:00:00.000Z")
// GitHub delivered the nominal 15-minute probe schedule as ~6.8 scheduled runs
// a day, with gaps of up to 5.7 hours (production-smoke.yml run history,
// September 2026). These gaps average 211.8 minutes: 1440 / 211.8 = 6.8 a day.
const OBSERVED_GAPS_MINUTES = [90, 150, 210, 342, 180, 299]
const LIVE_NOW = new Date("2026-09-22T07:13:00.000Z")
const ACTIVATION = {
  id: "slo-activation",
  event: "schedule",
  created_at: "2026-07-31T07:13:00.000Z",
}

function scheduledRuns(count = 96) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    event: "schedule",
    status: "completed",
    conclusion: "success",
    created_at: new Date(
      WINDOW_START.getTime() + index * 15 * 60_000
    ).toISOString(),
    html_url: `https://github.com/lapeninns/nabaperks/actions/runs/${index + 1}`,
  }))
}

function sparseScheduledRuns(config, { untilDay = Infinity } = {}) {
  const { windowEndMs, windowStartMs } = reportWindow(config, LIVE_NOW)
  const stopMs = Math.min(windowEndMs, windowStartMs + untilDay * 86_400_000)
  const runs = []
  for (
    let createdMs = windowStartMs + 20 * 60_000;
    createdMs < stopMs;
    createdMs +=
      OBSERVED_GAPS_MINUTES[(runs.length - 1) % OBSERVED_GAPS_MINUTES.length] *
      60_000
  ) {
    const id = runs.length + 1
    runs.push({
      id,
      event: "schedule",
      status: "completed",
      conclusion: "success",
      created_at: new Date(createdMs).toISOString(),
      html_url: `https://github.com/lapeninns/nabaperks/actions/runs/${id}`,
    })
  }
  return runs
}

function withFailures(runs, start, count) {
  return runs.map((run, index) =>
    index >= start && index < start + count
      ? { ...run, conclusion: "failure" }
      : run
  )
}

function liveReport(runs) {
  return calculateAvailabilityReport(readSloConfig(), runs, LIVE_NOW, [
    ACTIVATION,
  ])
}

test("production SLO config pins the nominal probe cadence, owner and 99% observed-sample objective", () => {
  const config = readSloConfig()
  assert.equal(config.probeSchedule, "7/15 * * * *")
  assert.equal(config.probeIntervalMinutes, 15)
  assert.equal(config.probeMinuteOffset, 7)
  assert.equal(config.evaluationLagMinutes, 10)
  assert.equal(config.windowDays, 30)
  assert.equal(config.availabilityObjective, 0.99)
  assert.equal(config.minimumObservedSamplesPerDay, 4)
  assert.equal(Object.hasOwn(config, "minimumCoverageRatio"), false)
  assert.equal(config.minimumObservationDays, 7)
  assert.ok(config.owner)
})

test("SLO config rejects the retired cron-slot coverage ratio and an unmeetable sample floor", () => {
  const source = JSON.parse(readFileSync("config/production-slos.json", "utf8"))
  const directory = mkdtempSync(join(tmpdir(), "production-slos-"))
  try {
    for (const [override, message] of [
      [{ minimumCoverageRatio: 0.95 }, /minimumCoverageRatio was replaced/],
      [{ minimumObservedSamplesPerDay: 0 }, /observed-sample floor/],
      [{ minimumObservedSamplesPerDay: 97 }, /observed-sample floor/],
    ]) {
      const path = join(directory, "production-slos.json")
      writeFileSync(path, JSON.stringify({ ...source, ...override }))
      assert.throws(() => readSloConfig(path), message)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("availability is measured over observed samples, not nominal cron slots", () => {
  const healthy = calculateAvailabilityReport(CONFIG, scheduledRuns(), NOW)
  assert.equal(healthy.schema, "nabaperks.production-slo-report.v2")
  assert.equal(healthy.observedSamples, 96)
  assert.equal(healthy.successfulSamples, 96)
  assert.equal(healthy.requiredObservedSamples, 4)
  assert.equal(healthy.sampleFloorMet, true)
  assert.equal(healthy.availabilityRatio, 1)
  assert.equal(healthy.errorRate, 0)
  assert.equal(healthy.state, "compliant")
  assert.equal(healthy.compliant, true)
  for (const retired of [
    "expectedSamples",
    "missingSamples",
    "coverageRatio",
    "minimumCoverage",
  ])
    assert.equal(Object.hasOwn(healthy, retired), false, retired)

  const failedRuns = scheduledRuns()
  failedRuns[10] = { ...failedRuns[10], conclusion: "failure" }
  const failed = calculateAvailabilityReport(CONFIG, failedRuns, NOW)
  assert.equal(failed.failedSamples, 1)
  assert.equal(failed.errorRate, 0.010417)
  assert.equal(failed.allowedUnavailableSamples, 0)
  assert.equal(failed.consumedUnavailableSamples, 1)
  assert.equal(failed.remainingUnavailableSamples, -1)
  assert.equal(failed.state, "breached")
  assert.equal(failed.compliant, false)

  // Scheduler gaps are not downtime: fewer delivered runs leave a healthy
  // service compliant while the observed-sample floor is still met.
  const gappy = calculateAvailabilityReport(CONFIG, scheduledRuns(91), NOW)
  assert.equal(gappy.observedSamples, 91)
  assert.equal(gappy.availabilityRatio, 1)
  assert.equal(gappy.consumedUnavailableSamples, 0)
  assert.equal(gappy.state, "compliant")
})

test("sparse but healthy GitHub-scheduled samples at ~6.8 a day are compliant", () => {
  const config = readSloConfig()
  const runs = sparseScheduledRuns(config)
  const report = liveReport(runs)

  assert.equal(report.observationDays, 30)
  assert.equal(report.observedSamples, runs.length)
  const perDay = report.observedSamples / report.observationDays
  assert.ok(perDay > 6.7 && perDay < 6.9, `observed ${perDay} samples a day`)
  // The retired model divided by 30 x 96 nominal cron slots and required 0.95,
  // so this healthy history was reported as breached on every run.
  const retiredCoverage =
    report.observedSamples /
    ((config.windowDays * 1440) / config.probeIntervalMinutes)
  assert.ok(retiredCoverage < 0.075, `retired coverage ${retiredCoverage}`)
  assert.equal(report.requiredObservedSamples, 120)
  assert.equal(report.sampleFloorMet, true)
  assert.equal(report.availabilityRatio, 1)
  assert.equal(report.allowedUnavailableSamples, 2)
  assert.equal(report.state, "compliant")
  assert.equal(report.compliant, true)

  const withinBudget = liveReport(withFailures(runs, 40, 2))
  assert.equal(withinBudget.failedSamples, 2)
  assert.equal(withinBudget.remainingUnavailableSamples, 0)
  assert.equal(withinBudget.state, "compliant")
})

test("a realistic multi-day outage in sparse samples breaches the objective", () => {
  const config = readSloConfig()
  const report = liveReport(withFailures(sparseScheduledRuns(config), 150, 19))

  assert.equal(report.failedSamples, 19)
  assert.equal(report.consumedUnavailableSamples, 19)
  assert.equal(report.remainingUnavailableSamples, 2 - 19)
  assert.ok(report.availabilityRatio < 0.91, `${report.availabilityRatio}`)
  assert.equal(report.sampleFloorMet, true)
  assert.equal(report.failedRunUrls.length, 19)
  assert.equal(report.state, "breached")
  assert.equal(report.compliant, false)

  const oneOverBudget = liveReport(
    withFailures(sparseScheduledRuns(config), 40, 3)
  )
  assert.equal(oneOverBudget.remainingUnavailableSamples, -1)
  assert.equal(oneOverBudget.state, "breached")
})

test("a stopped monitor breaches the observed-sample floor without counting downtime", () => {
  const config = readSloConfig()
  const report = liveReport(sparseScheduledRuns(config, { untilDay: 10 }))

  assert.ok(report.observedSamples < report.requiredObservedSamples)
  assert.equal(report.sampleFloorMet, false)
  assert.equal(report.availabilityRatio, 1)
  assert.equal(report.consumedUnavailableSamples, 0)
  assert.equal(report.state, "breached")
  assert.equal(report.compliant, false)
})

test("availability report warms up without paging before its minimum observation period", () => {
  const warmingConfig = { ...CONFIG, minimumObservationDays: 2 }
  const report = calculateAvailabilityReport(
    warmingConfig,
    scheduledRuns(),
    NOW
  )

  assert.equal(report.availabilityRatio, 1)
  assert.equal(report.state, "warming")
  assert.equal(report.compliant, false)
})

test("availability observation starts when the SLO workflow is activated", () => {
  const activation = {
    id: "slo-1",
    event: "schedule",
    created_at: "2026-07-22T12:01:00.000Z",
  }
  const report = calculateAvailabilityReport(
    CONFIG,
    scheduledRuns().slice(49),
    NOW,
    [activation]
  )

  assert.equal(report.measurementStart, activation.created_at)
  assert.equal(report.observationStart, "2026-07-22T12:15:00.000Z")
  assert.equal(report.observationDays, 0.49)
  assert.equal(report.observedSamples, 47)
  // The floor scales with the observed period: ceil(4 x 0.49 days) samples.
  assert.equal(report.requiredObservedSamples, 2)
})

test("GitHub SLO evidence is restricted to the scheduled production workflow", async () => {
  let request
  const runs = await fetchScheduledSmokeRuns({
    token: "test-token",
    windowStart: WINDOW_START,
    windowEnd: new Date("2026-07-23T00:00:00.000Z"),
    fetcher: async (url, init) => {
      request = { url: new URL(url), init }
      return Response.json({ workflow_runs: scheduledRuns(2) })
    },
  })

  assert.equal(runs.length, 2)
  assert.equal(request.url.origin, "https://api.github.com")
  assert.equal(
    request.url.pathname,
    "/repos/lapeninns/nabaperks/actions/workflows/production-smoke.yml/runs"
  )
  assert.equal(request.url.searchParams.get("event"), "schedule")
  assert.equal(request.url.searchParams.get("status"), "completed")
  assert.equal(
    request.url.searchParams.get("created"),
    "2026-07-22T00:00:00.000Z..2026-07-23T00:00:00.000Z"
  )
  assert.equal(request.url.searchParams.get("per_page"), "100")
  assert.equal(request.init.redirect, "error")
  assert.equal(request.init.headers.authorization, "Bearer test-token")

  await assert.rejects(
    fetchScheduledSmokeRuns({
      token: "test-token",
      repository: "attacker/fork",
      windowStart: WINDOW_START,
      windowEnd: new Date("2026-07-23T00:00:00.000Z"),
      fetcher: async () => Response.json({ workflow_runs: [] }),
    }),
    /unexpected GitHub repository/
  )
})

test("SLO activation evidence comes from the report workflow itself", async () => {
  let request
  const activationRuns = await fetchSloMeasurementRuns({
    token: "test-token",
    windowStart: WINDOW_START,
    windowEnd: new Date("2026-07-23T00:00:00.000Z"),
    fetcher: async (url, init) => {
      request = { url: new URL(url), init }
      return Response.json({
        workflow_runs: [
          {
            id: 1,
            event: "schedule",
            created_at: "2026-07-22T07:13:00.000Z",
          },
        ],
      })
    },
  })

  assert.equal(activationRuns.length, 1)
  assert.equal(
    request.url.pathname,
    "/repos/lapeninns/nabaperks/actions/workflows/slo-report.yml/runs"
  )
  assert.equal(request.url.searchParams.has("event"), false)
  assert.equal(request.init.headers.authorization, "Bearer test-token")
})
