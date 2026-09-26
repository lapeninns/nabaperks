// Production promotion janitor.
//
// A release pauses once, at the secret-free `Production approval` environment,
// after its release proof and qualification. An approval that waits longer
// than the release evidence expiry can never pass: every protected stage
// re-verifies the ledger with a fresh clock (scripts/release/manifest.mjs,
// maxAgeMs 3_600_000). A waiting job has not started on a runner, so its
// timeout-minutes never arms, yet the run keeps the production-release
// concurrency slot and newer promotions queue behind it. This janitor releases
// any approval gate that has waited past the threshold: it rejects the gate
// with an explanatory comment, falling back to cancelling the run.
//
// --dry-run performs reads only. The script targets exactly one repository,
// one workflow path and the approval environment, and never approves. The
// credential-holding `Production` environment has no reviewer, so it never
// holds a pending deployment.
import assert from "node:assert/strict"
import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const API_VERSION = "2026-03-10"
export const EXPECTED_REPOSITORY = "lapeninns/nabaperks"
export const PROMOTION_WORKFLOW_PATH =
  ".github/workflows/production-database.yml"
export const APPROVAL_ENVIRONMENT = "Production approval"
// Mirrors the validateStageManifest default in scripts/release/manifest.mjs.
export const EVIDENCE_MAX_AGE_MS = 3_600_000
// Headroom for an approval that is genuinely in flight at the expiry boundary.
const APPROVAL_HEADROOM_MS = 15 * 60_000
export const JANITOR_STALE_MS = EVIDENCE_MAX_AGE_MS + APPROVAL_HEADROOM_MS
export const REJECTION_COMMENT =
  "Promotion janitor: Production approval exceeded the 1h release-evidence expiry (scripts/release/manifest.mjs maxAgeMs 3600000). Start a fresh complete outer run per docs/operations/production-runbook.md."

const GITHUB_API_ORIGIN = "https://api.github.com"
const RUNS_PATH = `/repos/${EXPECTED_REPOSITORY}/actions/workflows/production-database.yml/runs`
const ACTIVE_STATUSES = ["in_progress", "waiting", "queued"]
const MAX_PAGES = 10
const PAGE_SIZE = 100
const REJECT_FALLBACK_STATUSES = new Set([403, 404, 422])

assert.equal(APPROVAL_ENVIRONMENT, "Production approval")
assert.ok(JANITOR_STALE_MS > EVIDENCE_MAX_AGE_MS)

export function createGithubClient({ token, fetcher = fetch, dryRun = false }) {
  assert.ok(token?.trim(), "GH_TOKEN is required")
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "nabaperks-promotion-janitor/1.0",
    "x-github-api-version": API_VERSION,
  }
  const request = (method, path, body) =>
    fetcher(new URL(path, GITHUB_API_ORIGIN), {
      method,
      headers:
        body === undefined
          ? headers
          : { ...headers, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })

  return {
    async get(path) {
      const response = await request("GET", path)
      assert.equal(
        response.ok,
        true,
        `GitHub read ${path} returned HTTP ${response.status}`
      )
      return response.json()
    },
    // Writes return the status so callers can apply the fallback policy.
    async post(path, body) {
      if (dryRun) throw new Error(`dry-run refuses the write to ${path}`)
      const response = await request("POST", path, body)
      return response.status
    },
  }
}

export function isPromotionRun(run) {
  return (
    run?.path === PROMOTION_WORKFLOW_PATH &&
    run.head_branch === "main" &&
    (run.repository?.full_name ?? EXPECTED_REPOSITORY) === EXPECTED_REPOSITORY
  )
}

// GitHub stamps a never-started, approval-waiting job's started_at at gate
// entry; its created_at carries the same instant.
export function gateEnteredAt(run, jobs) {
  const waiting = jobs
    .filter(({ status }) => status === "waiting")
    .map((job) => job.started_at ?? job.created_at)
    .filter((value) => Number.isFinite(Date.parse(value ?? "")))
    .sort()
  return waiting[0] ?? run.run_started_at ?? null
}

function approvalEnvironmentIds(pendingDeployments) {
  return pendingDeployments
    .filter(({ environment }) => environment?.name === APPROVAL_ENVIRONMENT)
    .map(({ environment }) => environment.id)
    .filter((id) => Number.isSafeInteger(id) && id > 0)
}

// Pure decision for one promotion run.
export function decidePromotion({
  run,
  pendingDeployments,
  jobs,
  now,
  staleMs = JANITOR_STALE_MS,
}) {
  const base = { runId: run.id, runUrl: run.html_url ?? null }
  if (!pendingDeployments.length)
    return { ...base, action: "skip", reason: "not-approval-blocked" }
  const environmentIds = approvalEnvironmentIds(pendingDeployments)
  if (!environmentIds.length)
    return { ...base, action: "skip", reason: "no-approval-gate" }

  const enteredAt = gateEnteredAt(run, jobs)
  const enteredMs = Date.parse(enteredAt ?? "")
  assert.ok(Number.isFinite(enteredMs), `run ${run.id} has no gate entry time`)
  const waitedMs = Math.max(0, now.getTime() - enteredMs)
  const gateJob =
    jobs.find(({ status }) => status === "waiting")?.name ?? "unknown"
  const decision = {
    ...base,
    environmentIds,
    gateJob,
    gateEnteredAt: enteredAt,
    waitedMinutes: Math.floor(waitedMs / 60_000),
  }
  return waitedMs > staleMs
    ? { ...decision, action: "reject", reason: "stale" }
    : { ...decision, action: "skip", reason: "within-threshold" }
}

async function listPromotionRuns(client) {
  const runs = new Map()
  for (const status of ACTIVE_STATUSES) {
    let complete = false
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const document = await client.get(
        `${RUNS_PATH}?status=${status}&branch=main&exclude_pull_requests=true&per_page=${PAGE_SIZE}&page=${page}`
      )
      assert.ok(
        Array.isArray(document.workflow_runs),
        "GitHub run listing is malformed"
      )
      for (const run of document.workflow_runs)
        if (isPromotionRun(run)) runs.set(run.id, run)
      if (document.workflow_runs.length < PAGE_SIZE) {
        complete = true
        break
      }
    }
    assert.equal(complete, true, `too many ${status} promotion runs to review`)
  }
  return [...runs.values()]
}

async function readPendingDeployments(client, runId) {
  const document = await client.get(
    `/repos/${EXPECTED_REPOSITORY}/actions/runs/${runId}/pending_deployments`
  )
  assert.ok(Array.isArray(document), "pending deployments are malformed")
  return document
}

async function readJobs(client, runId) {
  const document = await client.get(
    `/repos/${EXPECTED_REPOSITORY}/actions/runs/${runId}/jobs?filter=latest&per_page=100`
  )
  assert.ok(Array.isArray(document.jobs), "run jobs are malformed")
  return document.jobs
}

async function releaseStaleRun(client, decision) {
  const runPath = `/repos/${EXPECTED_REPOSITORY}/actions/runs/${decision.runId}`
  const rejectStatus = await client.post(`${runPath}/pending_deployments`, {
    environment_ids: decision.environmentIds,
    state: "rejected",
    comment: REJECTION_COMMENT,
  })
  if (rejectStatus >= 200 && rejectStatus < 300)
    return { ...decision, outcome: "rejected" }
  if (!REJECT_FALLBACK_STATUSES.has(rejectStatus))
    return {
      ...decision,
      outcome: "error",
      rejectStatus,
      error: `reject returned HTTP ${rejectStatus}`,
    }

  const cancelStatus = await client.post(`${runPath}/cancel`)
  if (cancelStatus === 202)
    return { ...decision, outcome: "cancelled", rejectStatus }
  // 409: the run already completed (or an approval landed) before the cancel.
  if (cancelStatus === 409)
    return { ...decision, outcome: "already-finished", rejectStatus }
  return {
    ...decision,
    outcome: "error",
    rejectStatus,
    cancelStatus,
    error: `cancel returned HTTP ${cancelStatus}`,
  }
}

async function reviewRun(client, run, { now, dryRun }) {
  const pendingDeployments = await readPendingDeployments(client, run.id)
  const jobs = pendingDeployments.length ? await readJobs(client, run.id) : []
  const decision = decidePromotion({ run, pendingDeployments, jobs, now })
  if (decision.action !== "reject") return decision

  // Race guard: an approval may have landed since the first read.
  const current = approvalEnvironmentIds(
    await readPendingDeployments(client, run.id)
  )
  if (!current.length)
    return { ...decision, action: "skip", reason: "approval-landed" }
  const guarded = { ...decision, environmentIds: current }
  if (dryRun) return { ...guarded, outcome: "would-reject" }
  return releaseStaleRun(client, guarded)
}

export async function runPromotionJanitor({
  token,
  repository = EXPECTED_REPOSITORY,
  fetcher = fetch,
  now = new Date(),
  dryRun = false,
} = {}) {
  assert.equal(repository, EXPECTED_REPOSITORY, "unexpected GitHub repository")
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()))
  const client = createGithubClient({ token, fetcher, dryRun })
  const runs = await listPromotionRuns(client)
  const results = []
  for (const run of runs)
    results.push(await reviewRun(client, run, { now, dryRun }))
  return {
    schema: "nabaperks.promotion-janitor.v1",
    generatedAt: now.toISOString(),
    dryRun,
    staleThresholdMinutes: JANITOR_STALE_MS / 60_000,
    checkedRuns: runs.length,
    results,
    errors: results.filter(({ outcome }) => outcome === "error"),
  }
}

function escapeCommand(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
}

function describe(result) {
  const detail = `run ${result.runId} (${result.gateJob}, waited ${result.waitedMinutes} min)`
  switch (result.outcome) {
    case "rejected":
      return ["notice", `Rejected the stale Production approval on ${detail}.`]
    case "would-reject":
      return [
        "notice",
        `Dry run: would reject the Production approval on ${detail}.`,
      ]
    case "cancelled":
      return [
        "warning",
        `Reject returned HTTP ${result.rejectStatus}; cancelled ${detail} instead.`,
      ]
    case "already-finished":
      return ["notice", `${detail} finished before it could be cancelled.`]
    default:
      return ["error", `Could not release ${detail}: ${result.error}.`]
  }
}

export function renderAnnotations(report) {
  const acted = report.results.filter(({ outcome }) => outcome)
  if (!acted.length)
    return [
      `::notice title=Promotion janitor::No Production approval wait exceeded ${JANITOR_STALE_MS / 60_000} minutes (${report.checkedRuns} active promotion runs checked).`,
    ]
  return acted.map((result) => {
    const [level, message] = describe(result)
    return `::${level} title=Promotion janitor::${escapeCommand(message)}`
  })
}

function cell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ")
}

export function renderSummary(report) {
  const lines = [
    "## Production promotion janitor",
    "",
    `${report.dryRun ? "Dry run. " : ""}Checked ${report.checkedRuns} active promotion runs against the ${JANITOR_STALE_MS / 60_000}-minute Production approval threshold.`,
    "",
  ]
  if (!report.results.length) return `${lines.join("\n")}\n`
  lines.push(
    "| Run | Gate job | Waited (min) | Decision |",
    "| --- | --- | --- | --- |"
  )
  for (const result of report.results) {
    const run = result.runUrl
      ? `[${result.runId}](${result.runUrl})`
      : result.runId
    lines.push(
      `| ${cell(run)} | ${cell(result.gateJob ?? "")} | ${cell(result.waitedMinutes ?? "")} | ${cell(result.outcome ?? result.reason)} |`
    )
  }
  return `${lines.join("\n")}\n`
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const report = await runPromotionJanitor({
    token: process.env.GH_TOKEN,
    repository: process.env.GITHUB_REPOSITORY || EXPECTED_REPOSITORY,
    dryRun,
  })
  for (const line of renderAnnotations(report)) console.log(line)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderSummary(report))
  console.log(JSON.stringify(report, null, 2))
  if (report.errors.length) process.exitCode = 1
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(
      `::error title=Promotion janitor::${escapeCommand(error instanceof Error ? error.message : "promotion janitor failed")}`
    )
    process.exitCode = 1
  })
}
