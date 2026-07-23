import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const API_VERSION = "2026-03-10"
const EXPECTED_REPOSITORY = "lapeninns/nabaperks"
const MAX_PAGES_PER_CHUNK = 10
const SEARCH_CHUNK_MS = 7 * 86_400_000

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
  assert.ok(
    config.minimumCoverageRatio > 0.5 && config.minimumCoverageRatio <= 1
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
      const url = new URL(
        `/repos/${repository}/actions/workflows/${workflow}/runs`,
        "https://api.github.com"
      )
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
      const url = new URL(
        `/repos/${repository}/actions/workflows/slo-report.yml/runs`,
        "https://api.github.com"
      )
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

export function calculateAvailabilityReport(
  config,
  runs,
  now = new Date(),
  measurementRuns = runs
) {
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()))
  const { intervalMs, windowEndMs, windowStartMs } = reportWindow(config, now)

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
  const observed = [...uniqueRuns.values()]
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
  const expectedSamples = Math.floor(
    (windowEndMs - observationStartMs) / intervalMs
  )
  const successfulSamples = observed.filter(
    ({ conclusion }) => conclusion === "success"
  ).length
  const failedSamples = observed.length - successfulSamples
  const missingSamples = Math.max(0, expectedSamples - observed.length)
  const coverageRatio = expectedSamples
    ? Math.min(1, observed.length / expectedSamples)
    : 0
  const availabilityRatio = observed.length
    ? Math.min(1, successfulSamples / observed.length)
    : 0
  const allowedUnavailableSamples = Math.floor(
    expectedSamples * (1 - config.availabilityObjective)
  )
  const consumedUnavailableSamples = failedSamples
  const remainingUnavailableSamples =
    allowedUnavailableSamples - consumedUnavailableSamples
  const hasMinimumObservation = observationDays >= config.minimumObservationDays
  const meetsObjective =
    coverageRatio >= config.minimumCoverageRatio &&
    availabilityRatio >= config.availabilityObjective
  const state = !hasMinimumObservation
    ? "warming"
    : meetsObjective
      ? "compliant"
      : "breached"

  return {
    schema: "nabaperks.production-slo-report.v1",
    generatedAt: now.toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    measurementStart: Number.isFinite(earliestMeasurementMs)
      ? new Date(earliestMeasurementMs).toISOString()
      : null,
    observationStart: new Date(observationStartMs).toISOString(),
    observationDays: Number(observationDays.toFixed(3)),
    minimumObservationDays: config.minimumObservationDays,
    intervalMinutes: config.probeIntervalMinutes,
    objective: config.availabilityObjective,
    minimumCoverage: config.minimumCoverageRatio,
    expectedSamples,
    observedSamples: observed.length,
    successfulSamples,
    failedSamples,
    missingSamples,
    coverageRatio: Number(coverageRatio.toFixed(6)),
    availabilityRatio: Number(availabilityRatio.toFixed(6)),
    allowedUnavailableSamples,
    consumedUnavailableSamples,
    remainingUnavailableSamples,
    state,
    compliant: state === "compliant",
    failedRunUrls: observed
      .filter(({ conclusion }) => conclusion !== "success")
      .slice(0, 20)
      .map(({ html_url: url }) => url),
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
  return calculateAvailabilityReport(config, runs, now, measurementRuns)
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
