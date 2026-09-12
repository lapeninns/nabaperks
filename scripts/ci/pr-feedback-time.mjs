import { pathToFileURL } from "node:url"
import { githubJson } from "../../ops/factory/github.mjs"

// Pull-request feedback time: the wall clock a contributor waits between the
// first check starting on a pull request and the last check finishing on it.
// This is the window a merge is blocked on, and it is the figure the agent
// readiness "fast CI feedback" signal measures (a rolling twenty merged pull
// requests, mean under ten minutes). It is deliberately not the CI workflow's
// own duration: a flaky shard that forces a re-run of the failed jobs, or a
// pack queued behind another pull request's run, both lengthen this window
// without changing any single job's timing. Nor is it merge latency - review
// time is not counted, only the span of the checks themselves.
//
// The window is read from `statusCheckRollup` exactly as `gh pr list` returns
// it, so a re-run's later completion, a second workflow (CodeQL, dependency
// review) and a check that is still queued are all reflected the way a
// contributor sees them on the pull request page.
export const FEEDBACK_THRESHOLD_MINUTES = 10
export const DEFAULT_SAMPLE_SIZE = 20
const MAX_SAMPLE_SIZE = 50
const REPOSITORY = "lapeninns/nabaperks"

function parseTime(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function checkName(check) {
  const parts = [check.workflowName, check.name ?? check.context].filter(
    (part) => typeof part === "string" && part.length
  )
  return parts.join(" / ") || "unnamed check"
}

/**
 * The feedback window of one pull request's checks, or null when no check has
 * started. A check that has not completed reports `updatedAt`, which is the
 * last time GitHub touched it; an in-flight check therefore contributes its
 * most recent progress rather than being dropped, so a pull request whose
 * checks are still running is never reported as faster than it is.
 */
export function checkWindow(statusCheckRollup) {
  if (!Array.isArray(statusCheckRollup))
    throw new Error("statusCheckRollup must be an array of checks")
  let startedAt = null
  let completedAt = null
  let slowest = null
  let earliest = null
  for (const check of statusCheckRollup) {
    const start = parseTime(check.startedAt)
    if (start === null) continue
    const end = parseTime(check.completedAt) ?? parseTime(check.updatedAt)
    if (end === null) continue
    if (startedAt === null || start < startedAt) {
      startedAt = start
      earliest = checkName(check)
    }
    if (completedAt === null || end > completedAt) {
      completedAt = end
      slowest = checkName(check)
    }
  }
  if (startedAt === null || completedAt === null) return null
  return {
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    minutes: Math.max(0, completedAt - startedAt) / 60_000,
    firstCheck: earliest,
    lastCheck: slowest,
  }
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Per-pull-request windows plus the sample statistics the readiness signal
 * is judged on. Pull requests with no started check are listed but excluded
 * from the statistics rather than counted as zero minutes.
 */
export function summariseFeedback(
  pullRequests,
  { threshold = FEEDBACK_THRESHOLD_MINUTES } = {}
) {
  if (!Array.isArray(pullRequests))
    throw new Error("Expected a list of pull requests")
  if (!(Number.isFinite(threshold) && threshold > 0))
    throw new Error("Threshold must be a positive number of minutes")
  const samples = pullRequests.map((pullRequest) => {
    const number = Number(pullRequest?.number)
    if (!Number.isSafeInteger(number) || number < 1)
      throw new Error("Every pull request must carry its number")
    return {
      number,
      title: typeof pullRequest.title === "string" ? pullRequest.title : "",
      mergedAt: pullRequest.mergedAt ?? null,
      window: checkWindow(pullRequest.statusCheckRollup ?? []),
    }
  })
  const minutes = samples
    .filter((sample) => sample.window)
    .map((sample) => sample.window.minutes)
  const measured = minutes.length
  const mean = measured
    ? minutes.reduce((total, value) => total + value, 0) / measured
    : null
  return {
    threshold,
    sampleSize: samples.length,
    measured,
    meanMinutes: mean,
    medianMinutes: median(minutes),
    maxMinutes: measured ? Math.max(...minutes) : null,
    overThreshold: minutes.filter((value) => value >= threshold).length,
    withinThreshold: mean !== null && mean < threshold,
    samples,
  }
}

export function collectFeedback({
  count = DEFAULT_SAMPLE_SIZE,
  read = githubJson,
  threshold,
} = {}) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLE_SIZE)
    throw new Error(
      `Sample must contain one to ${MAX_SAMPLE_SIZE} pull requests`
    )
  const pullRequests = read([
    "pr",
    "list",
    "--repo",
    REPOSITORY,
    "--state",
    "merged",
    "--limit",
    String(count),
    "--json",
    "number,title,mergedAt,statusCheckRollup",
  ])
  return summariseFeedback(pullRequests, { threshold })
}

function formatMinutes(value) {
  return value === null ? "   n/a" : `${value.toFixed(2).padStart(6)}m`
}

export function renderFeedback(summary) {
  const lines = []
  for (const sample of summary.samples) {
    const minutes = sample.window
      ? formatMinutes(sample.window.minutes)
      : "   n/a"
    const flag =
      sample.window && sample.window.minutes >= summary.threshold ? " !" : "  "
    const last = sample.window ? `  last: ${sample.window.lastCheck}` : ""
    lines.push(`#${sample.number} ${minutes}${flag} ${sample.title}${last}`)
  }
  lines.push("")
  lines.push(
    `Merged pull requests: ${summary.sampleSize} (${summary.measured} with checks)`
  )
  lines.push(
    `Mean ${formatMinutes(summary.meanMinutes)}  median ${formatMinutes(summary.medianMinutes)}  max ${formatMinutes(summary.maxMinutes)}`
  )
  lines.push(
    `${summary.overThreshold} at or over ${summary.threshold} minutes; mean is ${summary.withinThreshold ? "under" : "not under"} the ${summary.threshold}-minute bar`
  )
  return lines.join("\n")
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length > 3)
      throw new Error("Usage: pr-feedback-time.mjs [merged-pull-request-count]")
    const summary = collectFeedback({
      count: process.argv[2] ? Number(process.argv[2]) : DEFAULT_SAMPLE_SIZE,
    })
    console.log(renderFeedback(summary))
    if (!summary.withinThreshold) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
  }
}
