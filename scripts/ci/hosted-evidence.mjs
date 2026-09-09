#!/usr/bin/env node
/**
 * The hosted half of the shadow comparison's input.
 *
 * `ops/local-ci/compare-shadow.mjs` requires `--hosted-evidence FILE` and
 * nothing produced it, so the only way to obtain a verdict was to assemble
 * that file by hand - which makes the verdict unreproducible and therefore
 * worthless as evidence. This reads a real GitHub Actions run and emits the
 * same `nabaperks.lane-result.v1` envelope the local plane publishes, so the
 * two documents are comparable because they were built the same way.
 *
 * Three rules govern this file:
 *
 *   - **Read-only.** Every provider call is a GET. This never publishes a
 *     check, reruns a job, or writes provider state of any kind.
 *
 *   - **A job that cannot be placed stops the run.** Hosted e2e and a11y are
 *     sharded across many jobs while the local plane runs one lane per
 *     project, so shards are aggregated back into lanes. Silently dropping an
 *     unrecognised job would understate hosted coverage and hand the
 *     comparison a lane that looks equivalent because half of it is missing.
 *     Every job name is matched against ci.yml's own `name:` templates, every
 *     shard is placed exactly once, and the union of placed shards is checked
 *     against the matrix the workflow declares.
 *
 *   - **A count that could not be read is null, never zero.** This mirrors
 *     `buildLaneResult`: `countsParsed: false` with null counts makes
 *     `compareShadowEvidence` return "incomplete" for that lane, which is
 *     "cannot assert equivalence". Zeros would read as a passing lane with
 *     nothing to prove.
 */

import { execFile as execFileCallback } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { parseArgs, promisify } from "node:util"

import { parseLaneCounts } from "../../ops/local-ci/agent/runner.mjs"
import { REQUIRED_HOSTED_JOBS } from "./verify-required-evidence.mjs"

const execFile = promisify(execFileCallback)

/** The workflow whose jobs carry the hosted workload. */
export const CI_WORKFLOW_PATH = ".github/workflows/ci.yml"

/** Shard key of a lane that hosted runs as a single unsharded job. */
export const SINGLE_SHARD = "(single)"

/**
 * ci.yml jobs whose outcome is a comparison lane, and how each fans out.
 *
 * Only the correspondence is declared here; the fan-out itself - which
 * projects exist, how many packs or shards each has - is read from the job's
 * own `strategy.matrix`, so adding a browser project to ci.yml changes what
 * this producer expects instead of being quietly ignored.
 *
 * `quality` is the one hosted job that carries two local lanes: the hygiene
 * sweeps and the print-kit PDF proof share it hosted and are split locally
 * only because their dependency sets are disjoint. Both are command checks,
 * so the job's single outcome is the honest status for each.
 */
export const HOSTED_LANE_SOURCES = Object.freeze({
  fast: { lanes: ["fast"], shardKeys: [] },
  quality: { lanes: ["quality", "print-kit"], shardKeys: [] },
  e2e: { lanePrefix: "e2e", laneKey: "project", shardKeys: ["pack"] },
  a11y: { lanePrefix: "a11y", laneKey: "project", shardKeys: ["shard"] },
  db: { lanes: ["db"], shardKeys: [] },
})

/**
 * ci.yml jobs that are deliberately not comparison lanes, and why. Listing
 * them is what lets an unclassified job be an error rather than a shrug: a new
 * workload job added to ci.yml fails this producer until someone decides
 * whether it belongs in the lane vocabulary.
 */
export const NON_LANE_JOBS = Object.freeze({
  build: "the production bundle has no lane in the qualification policy",
  "build-gate": "rollup of fast, quality and build",
  "e2e-gate": "rollup of the e2e matrix",
  "a11y-gate": "rollup of the a11y matrix",
  visual: "pixel baselines stay GitHub-hosted on x64; no local lane exists",
  "visual-gate": "rollup of the visual matrix",
  lighthouse: "performance budgets have no local lane",
  "lighthouse-gate": "rollup of the lighthouse matrix",
  "zap-baseline": "the baseline scan has no local lane",
  "db-gate": "rollup of the db job",
  "release-gate": "the verdict job, not a workload",
})

/** Hosted conclusions that map onto a lane status the comparison accepts. */
const LANE_STATUS_BY_CONCLUSION = Object.freeze({
  success: "success",
  failure: "failure",
  timed_out: "timed_out",
  skipped: "skipped",
})

const COMMIT_SHA = /^[a-f0-9]{40}$/
const MATRIX_PLACEHOLDER = /\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g

export class HostedEvidenceError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new HostedEvidenceError(message)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/* ---------------------------------------------------------------- workflow */

/**
 * ci.yml's jobs as `{ name, matrix }`, keyed by job id. Pure.
 *
 * No YAML parser is a dependency of this repository, so this reads the two
 * things it needs the way the contract tests already do: job bodies are
 * indented four spaces or more, so the first following line indented exactly
 * two ends the job. A matrix key whose value is not an inline sequence (the
 * `include:` form) is recorded with a null value rather than guessed at.
 */
export function parseWorkflowJobs(text) {
  const marker = "\njobs:\n"
  const start = text.indexOf(marker)
  requireCondition(start !== -1, `${CI_WORKFLOW_PATH} declares no jobs mapping`)
  const section = text.slice(start + marker.length - 1)
  const jobs = new Map()
  for (const match of section.matchAll(/\n {2}([A-Za-z0-9_-]+):\n/g)) {
    const rest = section.slice(match.index + match[0].length)
    const next = rest.search(/\n {2}\S/)
    const body = rest.slice(0, next === -1 ? rest.length : next)
    jobs.set(match[1], {
      name: (body.match(/^ {4}name: (.+)$/m)?.[1] ?? match[1])
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2"),
      matrix: parseMatrix(body),
    })
  }
  requireCondition(jobs.size > 0, `${CI_WORKFLOW_PATH} declares no jobs`)
  return jobs
}

function parseMatrix(body) {
  const anchor = body.search(/^ {6}matrix:$/m)
  if (anchor === -1) return null
  const matrix = {}
  for (const line of body.slice(anchor).split("\n").slice(1)) {
    if (line.trim() === "" || line.startsWith("        #")) continue
    if (!line.startsWith("        ")) break
    const entry = line.match(/^ {8}([A-Za-z0-9_-]+): \[(.*)\]$/)
    if (entry) matrix[entry[1]] = entry[2].split(",").map((v) => v.trim())
    else matrix[line.trim().replace(/:.*$/, "")] = null
  }
  return matrix
}

/**
 * A job's `name:` template as an anchored matcher over rendered job names,
 * with the matrix values it interpolates captured. Pure.
 *
 * Matching on the template rather than on an expanded product is what lets
 * `include:`-style matrices (Lighthouse's routes) be recognised without this
 * file having to evaluate them, while still recovering the matrix values that
 * identify a shard. Placeholders exclude commas and brackets so
 * `E2E (chromium, pack 1)` cannot also satisfy `E2E (DB-free harness tier)`.
 */
export function jobNameMatcher(template) {
  const keys = []
  let source = "^"
  let last = 0
  for (const match of template.matchAll(MATRIX_PLACEHOLDER)) {
    source += escapeRegExp(template.slice(last, match.index)) + "([^,()]+)"
    keys.push(match[1])
    last = match.index + match[0].length
  }
  return {
    pattern: new RegExp(source + escapeRegExp(template.slice(last)) + "$"),
    keys,
  }
}

function matchJobName(matchers, name) {
  const hits = []
  for (const matcher of matchers) {
    const match = matcher.pattern.exec(name)
    if (!match) continue
    hits.push({
      jobId: matcher.jobId,
      values: Object.fromEntries(
        matcher.keys.map((key, i) => [key, match[i + 1]])
      ),
    })
  }
  requireCondition(
    hits.length <= 1,
    `hosted job ${JSON.stringify(name)} matches more than one ci.yml job (${hits.map((hit) => hit.jobId).join(", ")}); an ambiguous name cannot be placed in a lane`
  )
  return hits[0] ?? null
}

function cartesian(keys, matrix, jobId) {
  return keys.reduce(
    (rows, key) => {
      const values = matrix?.[key]
      requireCondition(
        Array.isArray(values) && values.length > 0,
        `ci.yml job ${jobId} declares no ${key} matrix values; the shard fan-out cannot be derived`
      )
      return rows.flatMap((row) => values.map((value) => [...row, value]))
    },
    [[]]
  )
}

function shardKeyOf(source, values, jobId) {
  const keys = source.shardKeys ?? []
  if (keys.length === 0) return SINGLE_SHARD
  return keys
    .map((key) => {
      requireCondition(
        values[key] !== undefined,
        `hosted job for ci.yml job ${jobId} carries no ${key} value; its shard cannot be identified`
      )
      return values[key]
    })
    .join("/")
}

/**
 * The lane vocabulary this run is expected to fill, derived from ci.yml. Pure.
 *
 * Refuses when ci.yml declares a job this file classifies neither way, when a
 * declared source is missing from ci.yml, when the matrix fans out to a lane
 * the qualification policy does not list, or when a policy lane has no hosted
 * source - each of those is a drift between the two planes that would
 * otherwise show up as a comparison nobody notices is incomplete.
 */
export function buildLaneIndex(workflowText, laneIds) {
  const jobs = parseWorkflowJobs(workflowText)
  const classified = new Set([
    ...Object.keys(HOSTED_LANE_SOURCES),
    ...Object.keys(NON_LANE_JOBS),
  ])
  for (const jobId of jobs.keys()) {
    requireCondition(
      classified.has(jobId),
      `${CI_WORKFLOW_PATH} declares job ${jobId}, which is neither a lane source nor a declared hosted-only job; classify it before comparing`
    )
  }
  for (const jobId of classified) {
    requireCondition(
      jobs.has(jobId),
      `${CI_WORKFLOW_PATH} no longer declares job ${jobId}`
    )
  }

  const expected = new Map()
  for (const [jobId, source] of Object.entries(HOSTED_LANE_SOURCES)) {
    const { matrix } = jobs.get(jobId)
    const lanes =
      source.lanes ??
      cartesian([source.laneKey], matrix, jobId).map(
        ([value]) => `${source.lanePrefix}-${value}`
      )
    const shards = new Set(
      (source.shardKeys ?? []).length === 0
        ? [SINGLE_SHARD]
        : cartesian(source.shardKeys, matrix, jobId).map((row) => row.join("/"))
    )
    for (const laneId of lanes) {
      requireCondition(
        laneIds.includes(laneId),
        `${CI_WORKFLOW_PATH} job ${jobId} fans out to lane ${laneId}, which the qualification policy does not list`
      )
      expected.set(laneId, { jobId, shards })
    }
  }
  for (const laneId of laneIds) {
    requireCondition(
      expected.has(laneId),
      `no ${CI_WORKFLOW_PATH} job produces the policy lane ${laneId}`
    )
  }

  return {
    jobs,
    expected,
    matchers: [...jobs].map(([jobId, job]) => ({
      jobId,
      ...jobNameMatcher(job.name),
    })),
  }
}

/* --------------------------------------------------------------- placement */

/**
 * Every hosted job placed against the index: lane shards on one side, the
 * declared hosted-only jobs on the other. Pure.
 *
 * The three refusals here are the point of the tool. An unplaceable job stops
 * the run rather than being dropped; a shard reported twice stops it rather
 * than inflating the lane's counts; a shard the matrix declares and the run
 * does not carry stops it rather than leaving a lane short.
 */
export function placeHostedJobs({ index, jobs, laneIds }) {
  const placed = new Map(laneIds.map((laneId) => [laneId, new Map()]))
  const nonLaneJobs = []
  const observedJobIds = new Set()
  const nonLaneNames = new Set()

  for (const job of jobs) {
    requireCondition(
      typeof job?.name === "string" && job.name !== "",
      "a hosted job carries no name and cannot be placed"
    )
    const match = matchJobName(index.matchers, job.name)
    requireCondition(
      match !== null,
      `hosted job ${JSON.stringify(job.name)} matches no ${CI_WORKFLOW_PATH} job; a job this producer cannot place would understate hosted coverage`
    )
    observedJobIds.add(match.jobId)
    const source = HOSTED_LANE_SOURCES[match.jobId]
    if (!source) {
      requireCondition(
        !nonLaneNames.has(job.name),
        `hosted job ${JSON.stringify(job.name)} is listed twice; list the latest attempt of each job once`
      )
      nonLaneNames.add(job.name)
      nonLaneJobs.push({
        jobId: job.id,
        job: match.jobId,
        name: job.name,
        conclusion: job.conclusion,
        reason: NON_LANE_JOBS[match.jobId],
      })
      continue
    }
    const lanes = source.lanes ?? [
      `${source.lanePrefix}-${match.values[source.laneKey]}`,
    ]
    const shardKey = shardKeyOf(source, match.values, match.jobId)
    for (const laneId of lanes) {
      const lane = index.expected.get(laneId)
      requireCondition(
        lane !== undefined && placed.has(laneId),
        `hosted job ${JSON.stringify(job.name)} belongs to lane ${laneId}, which is outside the compared lane set`
      )
      requireCondition(
        lane.shards.has(shardKey),
        `hosted job ${JSON.stringify(job.name)} carries shard ${shardKey}, which the ${CI_WORKFLOW_PATH} matrix for ${laneId} does not declare`
      )
      const shards = placed.get(laneId)
      requireCondition(
        !shards.has(shardKey),
        `lane ${laneId} shard ${shardKey} is reported by two jobs (${shards.get(shardKey)?.id} and ${job.id}); a double-counted shard inflates hosted counts`
      )
      shards.set(shardKey, job)
    }
  }

  for (const laneId of laneIds) {
    const missing = [...index.expected.get(laneId).shards].filter(
      (shardKey) => !placed.get(laneId).has(shardKey)
    )
    requireCondition(
      missing.length === 0,
      `lane ${laneId} is missing hosted shard(s) ${missing.join(", ")}; the run does not cover the matrix ${CI_WORKFLOW_PATH} declares`
    )
  }
  for (const jobId of REQUIRED_HOSTED_JOBS) {
    requireCondition(
      observedJobIds.has(jobId),
      `the run carries no job for the required validation root ${jobId}`
    )
  }
  return { placed, nonLaneJobs }
}

/* ------------------------------------------------------------------ counts */

/**
 * A hosted log line without the runner's ISO timestamp prefix. Pure.
 *
 * Both tally parsers anchor on the start of the line, and every line the
 * Actions log API returns is prefixed `2026-09-08T23:31:20.8953916Z `, so
 * without this every hosted lane would report counts it could not read.
 */
export function stripRunnerTimestamps(text) {
  return String(text).replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm, "")
}

/**
 * A lane's counts, summed over its shard logs with the same parsers the local
 * plane uses. Pure.
 *
 * A command lane reports zeros because zero is the truth there, mirroring
 * `buildLaneResult`. A test lane whose shard logs are absent or unparseable -
 * even one of them - reports nulls for the whole lane, because a partial sum
 * understates hosted coverage as badly as a zero does.
 */
export function laneCountsFromLogs({ kind, status, logs }) {
  const unavailable = {
    testsRun: null,
    testsPassed: null,
    testsFailed: null,
    testsSkipped: null,
    flaky: null,
    countsExpected: kind === "tests",
    countsParsed: false,
    countSources: [],
  }
  if (kind !== "tests") {
    return {
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsSkipped: 0,
      flaky: 0,
      countsExpected: false,
      countsParsed: false,
      countSources: ["no-test-command"],
    }
  }
  if (status === "skipped" || logs.length === 0) return unavailable
  const parsed = logs.map((text) =>
    typeof text === "string"
      ? parseLaneCounts(stripRunnerTimestamps(text))
      : null
  )
  if (parsed.some((counts) => counts === null)) return unavailable
  const sources = new Set()
  const totals = parsed.reduce(
    (total, counts) => {
      for (const source of counts.sources) sources.add(source)
      return {
        testsRun: total.testsRun + counts.testsRun,
        testsPassed: total.testsPassed + counts.testsPassed,
        testsFailed: total.testsFailed + counts.testsFailed,
        testsSkipped: total.testsSkipped + counts.testsSkipped,
        flaky: total.flaky + counts.flaky,
      }
    },
    { testsRun: 0, testsPassed: 0, testsFailed: 0, testsSkipped: 0, flaky: 0 }
  )
  return {
    ...totals,
    countsExpected: true,
    countsParsed: true,
    countSources: [...sources],
  }
}

/* ------------------------------------------------------------------ record */

function laneStatusOf(laneId, shards) {
  const statuses = shards.map(([shardKey, job]) => {
    requireCondition(
      job.status === "completed",
      `lane ${laneId} shard ${shardKey} is still ${job.status}; an unfinished run is not evidence`
    )
    const status = LANE_STATUS_BY_CONCLUSION[job.conclusion]
    requireCondition(
      status !== undefined,
      `lane ${laneId} shard ${shardKey} concluded ${JSON.stringify(job.conclusion)}, which the comparison does not accept as a lane outcome`
    )
    return status
  })
  if (statuses.includes("timed_out")) return "timed_out"
  if (statuses.includes("failure")) return "failure"
  if (statuses.every((status) => status === "skipped")) return "skipped"
  requireCondition(
    statuses.every((status) => status === "success"),
    `lane ${laneId} mixes skipped and completed shards; a partly executed lane cannot stand in for the whole lane`
  )
  return "success"
}

function spanSeconds(jobs) {
  if (jobs.length === 0) return null
  const started = jobs.map((job) => Date.parse(job.started_at))
  const completed = jobs.map((job) => Date.parse(job.completed_at))
  if ([...started, ...completed].some((value) => !Number.isFinite(value))) {
    return null
  }
  return (Math.max(...completed) - Math.min(...started)) / 1000
}

/**
 * One hosted lane record, in the shape `compareShadowEvidence` reads. Pure.
 *
 * `durationSeconds` is the lane's wall clock - the span from its first shard
 * starting to its last finishing - so it means what the local lane's duration
 * means rather than being a sum of parallel shard times.
 */
export function buildHostedLane({
  laneId,
  envelope,
  kind,
  sourceJob,
  shards,
  logsByJobId,
}) {
  const entries = [...shards].sort(([a], [b]) => a.localeCompare(b))
  const jobs = entries.map(([, job]) => job)
  const status = laneStatusOf(laneId, entries)
  const counts = laneCountsFromLogs({
    kind,
    status,
    // One entry per shard, including the shards whose log could not be read:
    // a lane summed from the shards that happened to answer is understated.
    logs: jobs.map((job) => logsByJobId.get(job.id)),
  })
  if (counts.countsParsed) {
    requireCondition(
      counts.testsRun ===
        counts.testsPassed +
          counts.testsFailed +
          counts.testsSkipped +
          counts.flaky,
      `lane ${laneId} counts do not add up (${counts.testsRun} run vs ${counts.testsPassed}/${counts.testsFailed}/${counts.testsSkipped}/${counts.flaky})`
    )
    requireCondition(
      status !== "success" || (counts.testsFailed === 0 && counts.flaky === 0),
      `lane ${laneId} passed hosted but its logs report failures or flakes`
    )
  }
  return {
    ...envelope,
    laneId,
    title: laneId,
    sourceJob,
    status,
    durationSeconds: spanSeconds(jobs),
    ...counts,
    blockedByLaneId: null,
    shards: entries.map(([shardKey, job]) => ({
      shardKey,
      jobId: job.id,
      name: job.name,
      conclusion: job.conclusion,
    })),
    jobIds: jobs.map((job) => job.id),
  }
}

/**
 * The `nabaperks.lane-result.v1` document for a hosted run. Pure.
 *
 * The run conclusion is derived from the lane statuses with the same rule
 * `shadow-evidence.mjs` enforces, so a document this builds can never be
 * rejected for disagreeing with itself. Provenance is the run and job ids
 * rather than a log digest: the bytes stay with the provider.
 */
export function buildHostedEvidence({
  contract,
  profile,
  headSha,
  run,
  jobs,
  workflowText,
  logsByJobId = new Map(),
  repository = contract?.repository,
}) {
  requireCondition(
    COMMIT_SHA.test(headSha ?? ""),
    "head SHA must be 40 lowercase hex characters"
  )
  const policy = contract?.shadowMode?.qualification
  requireCondition(
    policy?.profiles?.includes(profile),
    `no qualification policy for profile ${profile}`
  )
  const laneIds = Object.keys(policy.lanes ?? {})
  requireCondition(
    laneIds.length > 0,
    "the qualification policy lists no lanes"
  )
  requireCondition(
    run?.head_sha === headSha,
    `run ${run?.id} is for head ${run?.head_sha}, not ${headSha}`
  )
  requireCondition(
    run.status === "completed",
    `run ${run.id} is still ${run.status}`
  )
  // Provenance has to name what was read, not what the contract pins, or a run
  // collected from a fork with --repo would be filed under the canonical
  // repository. Where the run states its own identity, it is checked too.
  requireCondition(
    typeof repository === "string" && repository !== "",
    "the repository the run was read from is unknown"
  )
  const runRepository = run.repository?.full_name
  requireCondition(
    runRepository === undefined || runRepository === repository,
    `run ${run.id} belongs to ${runRepository}, not ${repository}`
  )
  requireCondition(
    run.path === undefined || run.path === CI_WORKFLOW_PATH,
    `run ${run.id} is a run of ${run.path}, not ${CI_WORKFLOW_PATH}`
  )

  const index = buildLaneIndex(workflowText, laneIds)
  const { placed, nonLaneJobs } = placeHostedJobs({ index, jobs, laneIds })
  const envelope = {
    schema: contract.evidence.resultSchema,
    plane: "hosted",
    profile,
    headSha,
  }
  const lanes = laneIds.map((laneId) =>
    buildHostedLane({
      laneId,
      envelope,
      kind: policy.lanes[laneId].kind,
      sourceJob: index.expected.get(laneId).jobId,
      shards: placed.get(laneId),
      logsByJobId,
    })
  )
  const statuses = lanes.map((lane) => lane.status)
  return {
    ...envelope,
    ref: run.head_branch ? `refs/heads/${run.head_branch}` : null,
    conclusion: statuses.includes("timed_out")
      ? "timed_out"
      : statuses.includes("failure")
        ? "failure"
        : "success",
    deadlineExpired: false,
    durationSeconds: spanSeconds(
      jobs.filter((job) => job.started_at && job.completed_at)
    ),
    provider: {
      repository,
      workflow: CI_WORKFLOW_PATH,
      runId: run.id,
      runAttempt: run.run_attempt ?? null,
      runUrl: run.html_url ?? null,
      jobCount: jobs.length,
    },
    lanes,
    nonLaneJobs,
  }
}

/* ------------------------------------------------------------- provider IO */

/**
 * A read-only GitHub reader. Every call is a GET and no body is ever sent, so
 * this cannot publish a check, rerun a job or mutate provider state.
 *
 * A token is used directly when one is ambient; otherwise the authenticated
 * `gh` CLI is shelled out to, which is how an operator's machine is already
 * set up. Both are injectable so the unit tests never touch a network.
 */
export function createGitHubReader({
  token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
  fetchImpl = globalThis.fetch,
  exec = execFile,
} = {}) {
  const read = async (path) => {
    if (token) {
      const response = await fetchImpl(`https://api.github.com/${path}`, {
        method: "GET",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
        },
      })
      const body = await response.text()
      requireCondition(response.ok, `GET ${path} answered ${response.status}`)
      return body
    }
    const { stdout } = await exec("gh", ["api", path], {
      maxBuffer: 256 * 1024 * 1024,
    })
    return stdout
  }
  return {
    json: async (path) => JSON.parse(await read(path)),
    text: (path) => read(path),
  }
}

/** The run to read: the one named, or the single completed run for this SHA. */
export async function resolveRun({ reader, repository, sha, runId }) {
  if (runId) return reader.json(`repos/${repository}/actions/runs/${runId}`)
  const { workflow_runs: runs = [] } = await reader.json(
    `repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`
  )
  const completed = runs.filter((run) => run.status === "completed")
  requireCondition(completed.length > 0, `no completed CI run for ${sha}`)
  requireCondition(
    completed.length === 1,
    `${completed.length} completed CI runs for ${sha} (${completed.map((run) => run.id).join(", ")}); name one with --run-id`
  )
  return completed[0]
}

/** Every latest-attempt job of a run. Refuses a short page rather than a gap. */
export async function readRunJobs({ reader, repository, runId }) {
  const jobs = []
  let total = null
  for (let page = 1; page <= 20; page += 1) {
    const body = await reader.json(
      `repos/${repository}/actions/runs/${runId}/jobs?per_page=100&filter=latest&page=${page}`
    )
    total = body.total_count
    jobs.push(...(body.jobs ?? []))
    if ((body.jobs ?? []).length < 100) break
  }
  requireCondition(
    jobs.length === total,
    `the provider listed ${jobs.length} of ${total} jobs for run ${runId}; an incomplete job list cannot be compared`
  )
  return jobs
}

/**
 * Logs for the jobs that feed a test lane, keyed by job id.
 *
 * A log that cannot be read is left out of the map rather than stored empty,
 * so the lane reports counts as unavailable instead of as zero.
 */
export async function readJobLogs({ reader, repository, jobIds }) {
  const logs = new Map()
  for (const jobId of jobIds) {
    try {
      logs.set(
        jobId,
        await reader.text(`repos/${repository}/actions/jobs/${jobId}/logs`)
      )
    } catch {
      // Expired retention is a fact about the run, not a reason to guess.
    }
  }
  return logs
}

/* --------------------------------------------------------------------- CLI */

const USAGE = `Usage: node scripts/ci/hosted-evidence.mjs --sha <40-hex> [options]

Reads a hosted GitHub Actions CI run and writes the hosted evidence document
that 'pnpm ops:ci:shadow-compare --hosted-evidence FILE' consumes. Read-only:
every provider call is a GET.

  --sha SHA        head commit of the hosted run (required)
  --run-id ID      the run to read, when a SHA has more than one
  --profile NAME   qualification profile (default: pr)
  --repo SLUG      owner/name (default: the pinned contract repository)
  --out FILE       write the document here instead of stdout
  --no-logs        skip job logs; every test lane reports counts unavailable
  --help           print this
`

export async function collectHostedEvidence({
  contract,
  workflowText,
  reader,
  sha,
  runId,
  profile,
  repository,
  withLogs = true,
}) {
  const run = await resolveRun({ reader, repository, sha, runId })
  const jobs = await readRunJobs({ reader, repository, runId: run.id })
  const laneIds = Object.keys(contract.shadowMode.qualification.lanes)
  const index = buildLaneIndex(workflowText, laneIds)
  // Only test lanes have counts to read, so only their jobs are fetched. The
  // placement runs first so an unplaceable job refuses before any log is read.
  const { placed } = placeHostedJobs({ index, jobs, laneIds })
  const testLaneJobIds = []
  if (withLogs) {
    for (const [laneId, shards] of placed) {
      if (contract.shadowMode.qualification.lanes[laneId].kind !== "tests")
        continue
      for (const job of shards.values()) testLaneJobIds.push(job.id)
    }
  }
  const logsByJobId = await readJobLogs({
    reader,
    repository,
    jobIds: testLaneJobIds,
  })
  return buildHostedEvidence({
    contract,
    profile,
    headSha: sha,
    run,
    jobs,
    workflowText,
    logsByJobId,
    repository,
  })
}

/** A one-screen account of what was read, for the operator's transcript. */
export function summariseHostedEvidence(document) {
  return [
    `run ${document.provider.runId} attempt ${document.provider.runAttempt} — ${document.provider.jobCount} jobs, ${document.conclusion}`,
    ...document.lanes.map(
      (lane) =>
        `  ${lane.laneId}: ${lane.status}, ${lane.shards.length} shard(s), ` +
        (lane.countsParsed
          ? `${lane.testsRun} run / ${lane.testsSkipped} skipped`
          : lane.countsExpected
            ? "counts UNAVAILABLE (equivalence cannot be asserted)"
            : "no test command")
    ),
    `  ${document.nonLaneJobs.length} hosted-only job(s) outside the lane vocabulary`,
  ].join("\n")
}

export async function main(
  argv,
  { readFileImpl = readFile, writeFileImpl = writeFile, reader } = {}
) {
  const { values } = parseArgs({
    args: argv,
    options: {
      sha: { type: "string" },
      "run-id": { type: "string" },
      profile: { type: "string", default: "pr" },
      repo: { type: "string" },
      out: { type: "string" },
      "no-logs": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })
  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }
  requireCondition(
    COMMIT_SHA.test(values.sha ?? ""),
    `--sha must be 40 lowercase hex characters\n\n${USAGE}`
  )
  const contract = JSON.parse(
    await readFileImpl(
      new URL("../../config/local-ci-contract.json", import.meta.url),
      "utf8"
    )
  )
  const workflowText = await readFileImpl(
    new URL(`../../${CI_WORKFLOW_PATH}`, import.meta.url),
    "utf8"
  )
  const document = await collectHostedEvidence({
    contract,
    workflowText,
    reader: reader ?? createGitHubReader(),
    sha: values.sha,
    runId: values["run-id"],
    profile: values.profile,
    repository: values.repo ?? contract.repository,
    withLogs: !values["no-logs"],
  })
  const json = `${JSON.stringify(document, null, 2)}\n`
  if (values.out) await writeFileImpl(values.out, json)
  else process.stdout.write(json)
  process.stderr.write(`${summariseHostedEvidence(document)}\n`)
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`Hosted evidence refused: ${error.message}\n`)
    process.exitCode = 1
  }
}
