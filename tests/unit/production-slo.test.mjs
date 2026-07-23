import assert from "node:assert/strict"
import { test } from "node:test"

import {
  calculateAvailabilityReport,
  fetchScheduledSmokeRuns,
  fetchSloMeasurementRuns,
  readSloConfig,
} from "../../scripts/check-production-slo.mjs"

const CONFIG = {
  probeIntervalMinutes: 15,
  windowDays: 1,
  availabilityObjective: 0.999,
  minimumCoverageRatio: 0.95,
  minimumObservationDays: 1,
}
const NOW = new Date("2026-07-22T23:45:00.000Z")
const WINDOW_START = new Date("2026-07-22T00:00:00.000Z")

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

test("production SLO config pins the probe cadence, owner and 99.9% objective", () => {
  const config = readSloConfig()
  assert.equal(config.probeSchedule, "7/15 * * * *")
  assert.equal(config.probeIntervalMinutes, 15)
  assert.equal(config.probeMinuteOffset, 7)
  assert.equal(config.evaluationLagMinutes, 10)
  assert.equal(config.windowDays, 30)
  assert.equal(config.availabilityObjective, 0.999)
  assert.equal(config.minimumCoverageRatio, 0.95)
  assert.equal(config.minimumObservationDays, 7)
  assert.ok(config.owner)
})

test("availability report separates service failures from monitor coverage gaps", () => {
  const healthy = calculateAvailabilityReport(CONFIG, scheduledRuns(), NOW)
  assert.equal(healthy.expectedSamples, 96)
  assert.equal(healthy.successfulSamples, 96)
  assert.equal(healthy.availabilityRatio, 1)
  assert.equal(healthy.errorRate, 0)
  assert.equal(healthy.state, "compliant")
  assert.equal(healthy.compliant, true)

  const failedRuns = scheduledRuns()
  failedRuns[10] = { ...failedRuns[10], conclusion: "failure" }
  const failed = calculateAvailabilityReport(CONFIG, failedRuns, NOW)
  assert.equal(failed.failedSamples, 1)
  assert.equal(failed.errorRate, 0.010417)
  assert.equal(failed.consumedUnavailableSamples, 1)
  assert.equal(failed.remainingUnavailableSamples, -1)
  assert.equal(failed.state, "breached")
  assert.equal(failed.compliant, false)

  const missing = calculateAvailabilityReport(CONFIG, scheduledRuns(91), NOW)
  assert.equal(missing.missingSamples, 5)
  assert.equal(missing.availabilityRatio, 1)
  assert.equal(missing.errorRate, 0)
  assert.equal(missing.consumedUnavailableSamples, 0)
  assert.ok(missing.coverageRatio < CONFIG.minimumCoverageRatio)
  assert.equal(missing.state, "breached")
  assert.equal(missing.compliant, false)
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
  assert.equal(report.expectedSamples, 47)
  assert.equal(report.observedSamples, 47)
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
