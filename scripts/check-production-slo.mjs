import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const API_VERSION = "2026-03-10"
const EXPECTED_REPOSITORY = "lapeninns/nabaperks"
const GITHUB_API_ORIGIN = "https://api.github.com"
const MAX_PAGES_PER_CHUNK = 10
const SEARCH_CHUNK_MS = 7 * 86_400_000
const SLO_RUNS_PATH =
  "/repos/lapeninns/nabaperks/actions/workflows/slo-report.yml/runs"
const SMOKE_RUNS_PATH =
  "/repos/lapeninns/nabaperks/actions/workflows/production-smoke.yml/runs"

// `probeIntervalMinutes` is the smoke cron's NOMINAL cadence. It aligns the
// report window and evaluation lag only. GitHub throttles scheduled workflows:
// the 15-minute cron has been delivered as ~6.8 runs a day, so counting
// nominal cron slots measured GitHub's scheduler rather than production.
export function readSloConfig(path = "config/production-slos.json") {
  const config = JSON.parse(readFileSync(path, "utf8"))
  assert.equal(config.schema, "nabaperks.production-slos.v1")
  assert.equal(config.probeWorkflow, "production-smoke.yml")
  assert.equal(config.probeSchedule, "7/15 * * * *")
  assert.ok(Number.isInteger(config.probeIntervalMinutes))
  assert.ok(config.probeIntervalMinutes >= 5)
  assert.ok(
    Number.isInteger(config.probeMinuteOffset) &&
      config.probeMinuteOffset >= 0 &&
      config.probeMinuteOffset < config.probeIntervalMinutes
  )
  assert.ok(
    Number.isInteger(config.evaluationLagMinutes) &&
      config.evaluationLagMinutes >= 5 &&
      config.evaluationLagMinutes <= config.probeIntervalMinutes
  )
  assert.ok(Number.isInteger(config.windowDays) && config.windowDays >= 7)
  assert.ok(
    config.availabilityObjective > 0.9 && config.availabilityObjective < 1
  )
  assert.equal(
    Object.hasOwn(config, "minimumCoverageRatio"),
    false,
    "minimumCoverageRatio was replaced by minimumObservedSamplesPerDay"
  )
  assert.ok(
    Number.isFinite(config.minimumObservedSamplesPerDay) &&
      config.minimumObservedSamplesPerDay > 0 &&
      config.minimumObservedSamplesPerDay <= 1440 / config.probeIntervalMinutes,
    "observed-sample floor must be positive and within the nominal cadence"
  )
  assert.ok(
    Number.isInteger(config.minimumObservationDays) &&
      config.minimumObservationDays >= 1 &&
      config.minimumObservationDays <= config.windowDays
  )
  assert.equal(config.runbook, "docs/operations/incident-response.md")
  assert.ok(config.owner?.trim())
  return config
}

export async function fetchScheduledSmokeRuns({
  token,
  repository = EXPECTED_REPOSITORY,
  workflow = "production-smoke.yml",
  windowStart,
  windowEnd,
  fetcher = fetch,
}) {
  assert.equal(repository, EXPECTED_REPOSITORY, "unexpected GitHub repository")
  assert.equal(workflow, "production-smoke.yml", "unexpected probe workflow")
  assert.ok(token?.trim(), "GITHUB_TOKEN is required")
  assert.ok(
    windowStart instanceof Date && Number.isFinite(windowStart.getTime())
  )
  assert.ok(windowEnd instanceof Date && Number.isFinite(windowEnd.getTime()))
  assert.ok(windowEnd > windowStart, "SLO evidence window is invalid")

  const runs = []
  for (
    let chunkStartMs = windowStart.getTime();
    chunkStartMs < windowEnd.getTime();
    chunkStartMs += SEARCH_CHUNK_MS
  ) {
    const chunkEndMs = Math.min(
      chunkStartMs + SEARCH_CHUNK_MS,
      windowEnd.getTime()
    )
    let chunkComplete = false
    for (let page = 1; page <= MAX_PAGES_PER_CHUNK; page += 1) {
      const url = new URL(SMOKE_RUNS_PATH, GITHUB_API_ORIGIN)
      const range = `${new Date(chunkStartMs).toISOString()}..${new Date(chunkEndMs).toISOString()}`
      url.searchParams.set("event", "schedule")
      url.searchParams.set("status", "completed")
      url.searchParams.set("created", range)
      url.searchParams.set("exclude_pull_requests", "true")
      url.searchParams.set("per_page", "100")
      url.searchParams.set("page", String(page))

      const response = await fetcher(url, {
        headers: githubHeaders(token),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(
        response.ok,
        true,
        `GitHub SLO evidence returned HTTP ${response.status}`
      )
      const document = await response.json()
      assert.ok(
        Array.isArray(document.workflow_runs),
        "GitHub run evidence is malformed"
      )
      runs.push(...document.workflow_runs)
      if (document.workflow_runs.length < 100) {
        chunkComplete = true
        break
      }
    }
    assert.equal(
      chunkComplete,
      true,
      "GitHub SLO evidence exceeded a seven-day search chunk"
    )
  }
  return runs
}

export async function fetchSloMeasurementRuns({
  token,
  repository = EXPECTED_REPOSITORY,
  windowStart,
  windowEnd,
  fetcher = fetch,
}) {
  assert.equal(repository, EXPECTED_REPOSITORY, "unexpected GitHub repository")
  assert.ok(token?.trim(), "GITHUB_TOKEN is required")
  assert.ok(
    windowStart instanceof Date && Number.isFinite(windowStart.getTime())
  )
  assert.ok(windowEnd instanceof Date && Number.isFinite(windowEnd.getTime()))

  const runs = []
  for (
    let chunkStartMs = windowStart.getTime();
    chunkStartMs < windowEnd.getTime();
    chunkStartMs += SEARCH_CHUNK_MS
  ) {
    const chunkEndMs = Math.min(
      chunkStartMs + SEARCH_CHUNK_MS,
      windowEnd.getTime()
    )
    let chunkComplete = false
    for (let page = 1; page <= MAX_PAGES_PER_CHUNK; page += 1) {
      const url = new URL(SLO_RUNS_PATH, GITHUB_API_ORIGIN)
      url.searchParams.set(
        "created",
        `${new Date(chunkStartMs).toISOString()}..${new Date(chunkEndMs).toISOString()}`
      )
      url.searchParams.set("exclude_pull_requests", "true")
      url.searchParams.set("per_page", "100")
      url.searchParams.set("page", String(page))

      const response = await fetcher(url, {
        headers: githubHeaders(token),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(
        response.ok,
        true,
        `GitHub SLO activation evidence returned HTTP ${response.status}`
      )
      const document = await response.json()
      assert.ok(
        Array.isArray(document.workflow_runs),
        "GitHub SLO activation evidence is malformed"
      )
      runs.push(...document.workflow_runs)
      if (document.workflow_runs.length < 100) {
        chunkComplete = true
        break
      }
    }
    assert.equal(
      chunkComplete,
      true,
      "GitHub SLO activation evidence exceeded a seven-day search chunk"
    )
  }
  return runs
}

function githubHeaders(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "nabaperks-slo-audit/1.0",
    "x-github-api-version": API_VERSION,
  }
}

export const PROBE_JOB_NAME = "Liveness and readiness"
const PROBE_OUTAGE_CONCLUSIONS = new Set(["failure", "timed_out"])

// A completed scheduled run is only evidence about production when its probe
// job actually ran. Runs GitHub never started (billing or budget blocks), and
// probes that were cancelled or skipped, are MISSING samples: neither uptime
// nor downtime. A probe that passed inside a run that failed later (the pager
// or incident job) is an available sample plus a separate monitoring failure,
// so a broken alert path stays visible without being reported as an outage.
// When the probe job has not been looked up (`probeConclusion` undefined) the
// run conclusion is used conservatively, as before.
export function classifySample(run) {
  if (run.conclusion === "success") return "available"
  if (run.probeConclusion === undefined) return "unavailable"
  if (run.probeConclusion === "success") return "available-monitoring-failed"
  if (PROBE_OUTAGE_CONCLUSIONS.has(run.probeConclusion)) return "unavailable"
  return "missing"
}

// Availability is measured over OBSERVED samples (see classifySample). Missing
// scheduled runs are not downtime; the observed-sample floor instead fails the
// report closed when too few samples arrive to judge availability.
export function calculateAvailabilityReport(
  config,
  runs,
  now = new Date(),
  measurementRuns = runs
) {
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()))
  const { windowEndMs, windowStartMs } = reportWindow(config, now)

  const eligible = runs.filter((run) => {
    const createdAt = new Date(run.created_at).getTime()
    return (
      run.event === "schedule" &&
      run.status === "completed" &&
      createdAt >= windowStartMs &&
      createdAt < windowEndMs
    )
  })
  const uniqueRuns = new Map(eligible.map((run) => [String(run.id), run]))
  const completed = [...uniqueRuns.values()].map((run) => ({
    run,
    sample: classifySample(run),
  }))
  const missing = completed.filter(({ sample }) => sample === "missing")
  const monitoringFailures = completed.filter(
    ({ sample }) => sample === "available-monitoring-failed"
  )
  const observed = completed
    .filter(({ sample }) => sample !== "missing")
    .map(({ run, sample }) => ({ ...run, sample }))
  const earliestMeasurementMs = measurementRuns
    .filter(
      ({ event }) => event === "schedule" || event === "workflow_dispatch"
    )
    .reduce(
      (earliest, run) => Math.min(earliest, new Date(run.created_at).getTime()),
      Number.POSITIVE_INFINITY
    )
  const observationStartMs = Number.isFinite(earliestMeasurementMs)
    ? Math.max(windowStartMs, firstSlotAtOrAfter(config, earliestMeasurementMs))
    : windowEndMs
  const observationDays = (windowEndMs - observationStartMs) / 86_400_000
  const observedSamples = observed.length
  const requiredObservedSamples = Math.ceil(
    Number((config.minimumObservedSamplesPerDay * observationDays).toFixed(6))
  )
  const successfulSamples = observed.filter(
    ({ sample }) => sample !== "unavailable"
  ).length
  const failedSamples = observedSamples - successfulSamples
  const availabilityRatio = observedSamples
    ? Math.min(1, successfulSamples / observedSamples)
    : 0
  const errorRate = observedSamples
    ? Math.min(1, failedSamples / observedSamples)
    : 1
  const allowedUnavailableSamples = Math.floor(
    Number((observedSamples * (1 - config.availabilityObjective)).toFixed(6))
  )
  const consumedUnavailableSamples = failedSamples
  const remainingUnavailableSamples =
    allowedUnavailableSamples - consumedUnavailableSamples
  const hasMinimumObservation = observationDays >= config.minimumObservationDays
  const sampleFloorMet =
    observedSamples > 0 && observedSamples >= requiredObservedSamples
  const meetsObjective =
    sampleFloorMet && availabilityRatio >= config.availabilityObjective
  const state = !hasMinimumObservation
    ? "warming"
    : meetsObjective
      ? "compliant"
      : "breached"

  return {
    schema: "nabaperks.production-slo-report.v2",
    generatedAt: now.toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    measurementStart: Number.isFinite(earliestMeasurementMs)
      ? new Date(earliestMeasurementMs).toISOString()
      : null,
    observationStart: new Date(observationStartMs).toISOString(),
    observationDays: Number(observationDays.toFixed(3)),
    minimumObservationDays: config.minimumObservationDays,
    nominalProbeIntervalMinutes: config.probeIntervalMinutes,
    objective: config.availabilityObjective,
    minimumObservedSamplesPerDay: config.minimumObservedSamplesPerDay,
    requiredObservedSamples,
    sampleFloorMet,
    observedSamples,
    successfulSamples,
    failedSamples,
    availabilityRatio: Number(availabilityRatio.toFixed(6)),
    errorRate: Number(errorRate.toFixed(6)),
    allowedUnavailableSamples,
    consumedUnavailableSamples,
    remainingUnavailableSamples,
    state,
    compliant: state === "compliant",
    failedRunUrls: observed
      .filter(({ sample }) => sample === "unavailable")
      .slice(0, 20)
      .map(({ html_url: url }) => url),
    // Not part of availability: evidence the monitor itself is unhealthy.
    unobservedRuns: missing.length,
    unobservedRunUrls: missing.slice(0, 20).map(({ run }) => run.html_url),
    monitoringFailureSamples: monitoringFailures.length,
    monitoringFailureRunUrls: monitoringFailures
      .slice(0, 20)
      .map(({ run }) => run.html_url),
  }
}

function firstSlotAtOrAfter(config, timestampMs) {
  const intervalMs = config.probeIntervalMinutes * 60_000
  const offsetMs = (config.probeMinuteOffset ?? 0) * 60_000
  return (
    Math.ceil((timestampMs - offsetMs) / intervalMs) * intervalMs + offsetMs
  )
}

export function reportWindow(config, now) {
  const intervalMs = config.probeIntervalMinutes * 60_000
  const offsetMs = (config.probeMinuteOffset ?? 0) * 60_000
  const lagMs = (config.evaluationLagMinutes ?? 0) * 60_000
  const eligibleTimeMs = now.getTime() - lagMs
  const latestSlotMs =
    Math.floor((eligibleTimeMs - offsetMs) / intervalMs) * intervalMs + offsetMs
  const windowEndMs = latestSlotMs + intervalMs
  return {
    intervalMs,
    windowEndMs,
    windowStartMs: windowEndMs - config.windowDays * 86_400_000,
  }
}

export async function runProductionSloAudit({
  env = process.env,
  now = new Date(),
  fetcher = fetch,
} = {}) {
  const config = readSloConfig(env.PRODUCTION_SLO_CONFIG)
  const { windowEndMs, windowStartMs } = reportWindow(config, now)
  const windowStart = new Date(windowStartMs)
  const windowEnd = new Date(windowEndMs)
  const request = {
    token: env.GITHUB_TOKEN,
    repository: env.GITHUB_REPOSITORY,
    windowStart,
    windowEnd,
    fetcher,
  }
  const [runs, measurementRuns] = await Promise.all([
    fetchScheduledSmokeRuns({
      ...request,
      workflow: config.probeWorkflow,
    }),
    fetchSloMeasurementRuns(request),
  ])
  const classified = await attachProbeConclusions({ ...request, runs })
  return calculateAvailabilityReport(config, classified, now, measurementRuns)
}

// Looks up the probe job only for runs that did not succeed, which keeps the
// request count proportional to failures. Any lookup failure throws: evidence
// that could not be read is never treated as a clean or missing sample.
export async function attachProbeConclusions({
  token,
  repository = EXPECTED_REPOSITORY,
  runs,
  fetcher = fetch,
}) {
  assert.equal(repository, EXPECTED_REPOSITORY, "unexpected GitHub repository")
  const result = []
  for (const run of runs) {
    if (run.conclusion === "success") {
      result.push(run)
      continue
    }
    assert.ok(/^[0-9]+$/.test(String(run.id)), "GitHub run id is malformed")
    const url = new URL(
      `/repos/${EXPECTED_REPOSITORY}/actions/runs/${run.id}/jobs`,
      GITHUB_API_ORIGIN
    )
    url.searchParams.set("filter", "latest")
    url.searchParams.set("per_page", "100")
    const response = await fetcher(url, {
      headers: githubHeaders(token),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    assert.equal(
      response.ok,
      true,
      `GitHub probe job evidence returned HTTP ${response.status}`
    )
    const document = await response.json()
    assert.ok(
      Array.isArray(document.jobs),
      "GitHub probe job evidence is malformed"
    )
    const probes = document.jobs.filter((job) => job.name === PROBE_JOB_NAME)
    assert.ok(probes.length <= 1, "GitHub probe job evidence is ambiguous")
    // GitHub still creates, and marks as failed, a job it refused to start
    // (for example "The job was not started because recent account payments
    // have failed"): it has no runner and no steps. Such a probe never touched
    // production, so it is a missing sample exactly like an absent probe job.
    const probe = probes[0]
    const ran =
      probe !== undefined &&
      typeof probe.runner_name === "string" &&
      probe.runner_name !== "" &&
      Array.isArray(probe.steps) &&
      probe.steps.length > 0
    result.push({ ...run, probeConclusion: ran ? probe.conclusion : null })
  }
  return result
}

async function main() {
  const report = await runProductionSloAudit()
  console.log(JSON.stringify(report, null, 2))
  if (!report.compliant) process.exitCode = 1
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "SLO audit failed")
    process.exitCode = 1
  })
}
