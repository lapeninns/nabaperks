import { pathToFileURL } from "node:url"
import { githubJson, githubPages } from "../../ops/factory/github.mjs"

export function summariseJobs(jobs) {
  let durationMs = 0,
    timedJobs = 0
  const outcomes = {}
  for (const job of jobs) {
    outcomes[job.conclusion ?? job.status] =
      (outcomes[job.conclusion ?? job.status] ?? 0) + 1
    const start = Date.parse(job.started_at),
      end = Date.parse(job.completed_at)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durationMs += end - start
      timedJobs++
    }
  }
  return {
    jobCount: jobs.length,
    timedJobs,
    aggregateExecutionMinutes: durationMs / 60_000,
    outcomes,
  }
}

export function collectUsage({ count = 5, read = githubJson } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw new Error("Usage sample must contain one to twenty runs")
  const repository = "lapeninns/nabaperks"
  const root = `repos/${repository}`
  const runs = read([
    "api",
    `${root}/actions/workflows/ci.yml/runs?per_page=${count}`,
  ]).workflow_runs
  if (!Array.isArray(runs)) throw new Error("CI run metadata missing")
  const samples = runs.map((run) => {
    const attempts = []
    const seenJobs = new Set()
    for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
      const jobs = githubPages(
        `${root}/actions/runs/${run.id}/attempts/${attempt}/jobs?per_page=100`,
        read
      ).flatMap((page) => page.jobs ?? [])
      const executed = jobs.filter((job) => {
        if (!Number.isSafeInteger(job.id))
          throw new Error(
            "Job identity missing; cannot distinguish reruns from reused jobs"
          )
        if (seenJobs.has(job.id)) return false
        seenJobs.add(job.id)
        return true
      })
      attempts.push({
        attempt,
        priorAttemptJobs: jobs.length - executed.length,
        ...summariseJobs(executed),
      })
    }
    return {
      id: run.id,
      sha: run.head_sha,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      attempts,
    }
  })
  const artifacts = githubPages(
    `${root}/actions/artifacts?per_page=100`,
    read
  ).flatMap((page) => page.artifacts ?? [])
  const live = artifacts.filter((artifact) => !artifact.expired)
  const cache = read(["api", `${root}/actions/cache/usage`])
  return {
    schema: "nabaperks.ci-usage.v1",
    checkedAt: new Date().toISOString(),
    repository,
    samples,
    artifacts: {
      historicalCount: artifacts.length,
      unexpiredCount: live.length,
      unexpiredBytes: live.reduce(
        (sum, artifact) => sum + artifact.size_in_bytes,
        0
      ),
    },
    cache: {
      count: cache.active_caches_count,
      bytes: cache.active_caches_size_in_bytes,
    },
    limitation:
      "Aggregate job timestamp durations count each job ID once across sampled attempts and are not billed minutes. Storage is a point-in-time snapshot, not GB-hours. Account invoices and provider cash savings are not established.",
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length > 3)
      throw new Error("Usage: collect-usage.mjs [run-count]")
    console.log(
      JSON.stringify(
        collectUsage({ count: process.argv[2] ? Number(process.argv[2]) : 5 }),
        null,
        2
      )
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
