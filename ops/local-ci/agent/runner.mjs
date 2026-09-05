/**
 * Executing a profile's lanes and turning what happened into evidence.
 *
 * The hard part of this file is not running commands - it is being honest
 * about what the output did and did not say. Two rules govern that:
 *
 *   - **A count that could not be parsed is `null`, never zero.** A lane that
 *     ran 400 tests and printed a summary this file did not recognise must not
 *     report "0 tests"; that reads as a passing lane with nothing to prove and
 *     is exactly how a shadow comparison gets fooled. Nulls are carried into
 *     the `nabaperks.lane-result.v1` document, and a lane that was *expected*
 *     to produce counts and did not raises an entry in the published summary's
 *     failure list, because incomplete evidence is a defect of this plane.
 *
 *   - **A lane that never ran is reported, not omitted.** When an earlier lane
 *     fails and stops the run, the remaining lanes are recorded with status
 *     `skipped`. A missing row and a passing row look identical from the
 *     outside, and the whole point of this plane is that they must not.
 *
 * Everything above `createRunner` is pure: the parsers, the shell-script
 * builder, the lane-result builder and the record builder all take their
 * inputs as arguments. `createRunner` is the only impure export, and it is
 * thin on purpose - the interesting logic is in the functions a test can call
 * with a string.
 */

import {
  LocalCiError,
  deepFreeze,
  describeValue,
  runtimeEnvSource,
} from "../core/contract.mjs"
import { digestLogBundle, logDigest } from "../core/digest.mjs"
import { buildJobEnv } from "../core/job-env.mjs"
import { selectLanes } from "../core/profiles.mjs"
import { LANE_STATUSES } from "../core/summary.mjs"

export class RunnerError extends LocalCiError {}

/** Prefix of every line this runner injects into a lane's log. */
export const LOG_MARKER = "##local-ci##"

/** Cap on failure titles collected from one lane's output. */
export const LANE_FAILURE_CAP = 50

/** Shell variable namespace, chosen not to collide with anything a lane sets. */
const SHELL_NS = "__lci"

function fail(code, message) {
  throw new RunnerError(code, `local-ci runner: ${message}`)
}

function requireObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(
      "INVALID_INPUT",
      `${label} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

/* ------------------------------------------------------------------ parsing */

/**
 * node:test's end-of-run tallies, in either the spec reporter's `ℹ tests 12`
 * form or TAP's `# tests 12`. Summed across every block in the text, because a
 * lane runs several commands and each prints its own block. Pure.
 *
 * Returns null when the text carries no block at all, which is a different
 * fact from "a block that said zero".
 */
export function parseNodeTestCounts(text) {
  if (typeof text !== "string") return null
  const pattern =
    /^[^\S\n]*(?:ℹ|#)[^\S\n]+(tests|suites|pass|fail|cancelled|skipped|todo)[^\S\n]+(\d+)[^\S\n]*$/gm
  const totals = {
    tests: 0,
    suites: 0,
    pass: 0,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  }
  let seen = false
  for (const match of text.matchAll(pattern)) {
    totals[match[1]] += Number(match[2])
    seen = true
  }
  return seen ? Object.freeze(totals) : null
}

/**
 * Playwright's end-of-run tallies (`3 failed`, `2 flaky`, `120 passed (3.4m)`,
 * `1 skipped`, `4 did not run`). Summed across shards. Pure.
 *
 * The leading-digit anchor is what keeps the list reporter's own `1) [chromium]
 * › …` failure headers out of the tally: those carry a `)` where this pattern
 * demands whitespace.
 */
export function parsePlaywrightCounts(text) {
  if (typeof text !== "string") return null
  const pattern =
    /^[^\S\n]*(\d+)[^\S\n]+(passed|failed|flaky|skipped|interrupted|did not run)\b/gm
  const totals = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    interrupted: 0,
    didNotRun: 0,
  }
  const key = {
    passed: "passed",
    failed: "failed",
    flaky: "flaky",
    skipped: "skipped",
    interrupted: "interrupted",
    "did not run": "didNotRun",
  }
  let seen = false
  for (const match of text.matchAll(pattern)) {
    totals[key[match[2]]] += Number(match[1])
    seen = true
  }
  return seen ? Object.freeze(totals) : null
}

/**
 * The two parsers folded into the counts core/summary.mjs consumes, or null
 * when neither recognised anything. Pure.
 */
export function parseLaneCounts(text) {
  const node = parseNodeTestCounts(text)
  const playwright = parsePlaywrightCounts(text)
  if (node === null && playwright === null) return null

  const playwrightRun =
    playwright === null
      ? 0
      : playwright.passed +
        playwright.failed +
        playwright.flaky +
        playwright.skipped +
        playwright.interrupted +
        playwright.didNotRun

  const sources = []
  if (node !== null) sources.push("node:test")
  if (playwright !== null) sources.push("playwright")

  return Object.freeze({
    testsRun: (node?.tests ?? 0) + playwrightRun,
    testsPassed: (node?.pass ?? 0) + (playwright?.passed ?? 0),
    testsFailed: (node?.fail ?? 0) + (playwright?.failed ?? 0),
    testsSkipped:
      (node?.skipped ?? 0) +
      (node?.todo ?? 0) +
      (playwright?.skipped ?? 0) +
      (playwright?.didNotRun ?? 0),
    flaky: playwright?.flaky ?? 0,
    sources: Object.freeze(sources),
  })
}

/**
 * Commands whose output these parsers understand. Anything else genuinely
 * reports no tests, and reporting zero for it is the truth rather than a
 * guess - which is what keeps the "counts missing" signal meaningful. Pure.
 */
export const COUNT_PRODUCING_COMMANDS = Object.freeze([
  /\btest:(unit|contracts|coverage|db|e2e|a11y)\b/,
  /\bnode\s+(?:[^\s]+\s+)*--test\b/,
  /\bplaywright\s+test\b/,
])

/** True when this lane's commands should produce machine-readable counts. */
export function expectsTestCounts(lane) {
  requireObject(lane, "lane")
  return (lane.commands ?? []).some((command) =>
    COUNT_PRODUCING_COMMANDS.some((pattern) => pattern.test(command))
  )
}

/**
 * Failure titles from a lane's output: Playwright's numbered failure headers
 * and node:test's TAP `not ok` lines. Pure, capped, and deduplicated in first
 * -seen order so a retried shard does not list the same test twice.
 */
export function extractFailureTitles(text, limit = LANE_FAILURE_CAP) {
  if (typeof text !== "string") return Object.freeze([])
  const titles = []
  const seen = new Set()
  const add = (raw) => {
    const title = raw.replace(/[\s─-]+$/u, "").trim()
    if (title === "" || seen.has(title) || titles.length >= limit) return
    seen.add(title)
    titles.push(title)
  }
  for (const match of text.matchAll(/^[^\S\n]*\d+\)[^\S\n]+(.+)$/gm)) {
    add(match[1])
  }
  for (const match of text.matchAll(
    /^not ok[^\S\n]+\d+[^\S\n]*-?[^\S\n]*(.+)$/gm
  )) {
    add(match[1])
  }
  return Object.freeze(titles)
}

/* ---------------------------------------------------------- script building */

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * Runtime-env sources split by where they can be resolved. Pure.
 *
 * `per-run` sources resolve on the host before the container starts, so their
 * values are identical for every lane in the run - which is what lets one lane
 * seed ciphertext another reads back. `per-lane` sources cannot: a local
 * Supabase stack has no status until that lane's own `supabase start` has
 * finished, so they are resolved inside the lane script instead.
 */
export function partitionRuntimeSources(profile, lane, contract) {
  requireObject(profile, "profile")
  requireObject(lane, "lane")
  const ids = [
    ...(profile.baselineRuntimeEnv ?? []),
    ...(lane.runtimeEnv ?? []),
  ]
  const perRun = []
  const perLane = []
  for (const id of ids) {
    const source = runtimeEnvSource(contract, id)
    if (source.resolution === "per-lane") perLane.push(source)
    else perRun.push(source)
  }
  return Object.freeze({
    perRun: Object.freeze(perRun),
    perLane: Object.freeze(perLane),
  })
}

/**
 * The lane as core/job-env.mjs should see it: only the runtime-env sources the
 * host can actually resolve before the container starts. Pure.
 *
 * Without this, `buildJobEnv` would demand a value for every name a per-lane
 * source promises and refuse a lane whose values do not exist yet by
 * construction.
 */
export function laneForEnvBuild(lane, contract) {
  requireObject(lane, "lane")
  const ids = (lane.runtimeEnv ?? []).filter(
    (id) => runtimeEnvSource(contract, id).resolution !== "per-lane"
  )
  return { ...lane, runtimeEnv: ids }
}

function runtimeEnvBlock(source) {
  if (source.kind !== "command" || source.format !== "dotenv") {
    fail(
      "UNSUPPORTED_RUNTIME_ENV_SOURCE",
      `runtime-env source ${JSON.stringify(source.id)} resolves per lane but is ${JSON.stringify(source.kind)}/${JSON.stringify(source.format)}; only a dotenv-producing command can be resolved inside the lane script`
    )
  }
  const variable = `${SHELL_NS}_src_${source.id.replace(/[^A-Za-z0-9]+/g, "_")}`
  const lines = [
    `echo ${shellSingleQuote(`${LOG_MARKER} resolving runtime env source ${source.id}`)}`,
    `${variable}="$(${source.command})" || {`,
    `  echo ${shellSingleQuote(`runtime env source ${source.id} failed: ${source.command}`)} >&2`,
    "  exit 1",
    "}",
  ]
  const map = source.map ?? {}
  const inverse = new Map()
  for (const [from, to] of Object.entries(map)) inverse.set(to, from)
  for (const name of source.provides ?? []) {
    const dotenvKey = inverse.get(name) ?? name
    lines.push(
      `export ${name}="$(printf '%s\\n' "$${variable}" | sed -n 's/^[[:space:]]*${dotenvKey}=//p' | head -n 1 | sed 's/^"//; s/"$//')"`,
      `if [ -z "\${${name}:-}" ]; then`,
      `  echo ${shellSingleQuote(`runtime env source ${source.id} did not provide ${name}`)} >&2`,
      "  exit 1",
      "fi"
    )
  }
  return lines
}

function backgroundServiceBlock(service, index) {
  const readiness = service.readiness ?? {}
  const attempts = readiness.attempts ?? 60
  const interval = readiness.intervalSeconds ?? 1
  const method = readiness.method ?? "GET"
  const logFile = service.logFile ?? `${service.id}.log`
  const readyVar = `${SHELL_NS}_ready_${index}`
  return [
    `echo ${shellSingleQuote(`${LOG_MARKER} starting background service ${service.id}`)}`,
    `( ${service.command} ) > ${shellSingleQuote(logFile)} 2>&1 &`,
    `${SHELL_NS}_pids="$${SHELL_NS}_pids $!"`,
    `sleep ${service.startAfter ?? 1}`,
    `${readyVar}=0`,
    `for ${SHELL_NS}_attempt in $(seq 1 ${attempts}); do`,
    `  if curl -fsS -o /dev/null -X ${method} ${shellSingleQuote(readiness.url)}; then`,
    `    ${readyVar}=1`,
    "    break",
    "  fi",
    `  sleep ${interval}`,
    "done",
    `if [ "$${readyVar}" -ne 1 ]; then`,
    `  echo ${shellSingleQuote(`background service ${service.id} never answered ${readiness.url} after ${attempts} attempts`)} >&2`,
    `  cat ${shellSingleQuote(logFile)} >&2 || true`,
    "  exit 1",
    "fi",
    `echo ${shellSingleQuote(`${LOG_MARKER} background service ${service.id} is ready`)}`,
  ]
}

function snapshotGuardBlock(contract) {
  const guard = contract.snapshotGuard
  if (!guard?.enabled || !guard.mutationCheck?.command) return []
  const variable = `${SHELL_NS}_snapshot_mutations`
  return [
    `echo ${shellSingleQuote(`${LOG_MARKER} snapshot guard`)}`,
    `${variable}="$(${guard.mutationCheck.command} || true)"`,
    `if [ -n "$${variable}" ]; then`,
    `  echo ${shellSingleQuote("snapshot guard: this run modified pixel baselines, which a local ARM64 run must never do")} >&2`,
    `  printf '%s\\n' "$${variable}" >&2`,
    "  exit 1",
    "fi",
  ]
}

/**
 * The bash script one lane's container executes. **Pure.**
 *
 * Structure, in order: strict mode, an EXIT trap that stops background
 * services and runs the lane's teardown commands whatever happened, the
 * background services with their readiness polls, the lane's commands, the
 * per-lane runtime-env resolution after the first command, and finally the
 * contract's snapshot-mutation check.
 *
 * The teardown lives in the trap rather than after the commands because
 * ci.yml's own `supabase stop --no-backup` runs under `if: always()`: a lane
 * that failed still has to release its ports and its containers.
 */
export function buildLaneScript(lane, contract, { workspacePath = null } = {}) {
  requireObject(lane, "lane")
  requireObject(contract, "contract")
  const commands = lane.commands ?? []
  if (commands.length === 0) {
    fail(
      "EMPTY_LANE_COMMANDS",
      `lane ${JSON.stringify(lane.id)} has no commands; a lane that runs nothing reports success and proves nothing`
    )
  }
  const cwd = workspacePath ?? contract.container?.workspacePath
  const teardown = lane.teardownCommands ?? []
  const services = lane.backgroundServices ?? []
  const perLaneSources = (lane.runtimeEnv ?? [])
    .map((id) => runtimeEnvSource(contract, id))
    .filter((source) => source.resolution === "per-lane")

  const lines = [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    `cd ${shellSingleQuote(cwd)}`,
    `${SHELL_NS}_pids=""`,
    `${SHELL_NS}_cleanup() {`,
    `  ${SHELL_NS}_status=$?`,
    "  set +e",
    `  for ${SHELL_NS}_pid in $${SHELL_NS}_pids; do`,
    `    kill -TERM "$${SHELL_NS}_pid" 2>/dev/null`,
    "  done",
  ]
  for (const command of teardown) {
    lines.push(
      `  echo ${shellSingleQuote(`${LOG_MARKER} teardown: ${command}`)}`,
      `  ${command}`
    )
  }
  lines.push(
    `  exit "$${SHELL_NS}_status"`,
    "}",
    `trap ${SHELL_NS}_cleanup EXIT`,
    `echo ${shellSingleQuote(`${LOG_MARKER} lane ${lane.id} starting`)}`
  )

  for (const [index, service] of services.entries()) {
    lines.push(...backgroundServiceBlock(service, index))
  }

  for (const [index, command] of commands.entries()) {
    lines.push(
      `echo ${shellSingleQuote(`${LOG_MARKER} command ${index + 1}/${commands.length}: ${command}`)}`,
      command
    )
    // Resolved once, immediately after the lane's first command: that is the
    // command whose completion is what makes the source answerable at all
    // (`supabase status` has nothing to report before `supabase start`), and
    // an exported value persists for every command that follows in this shell.
    if (index === 0) {
      for (const source of perLaneSources) {
        lines.push(...runtimeEnvBlock(source))
      }
    }
  }

  lines.push(...snapshotGuardBlock(contract))
  lines.push(
    `echo ${shellSingleQuote(`${LOG_MARKER} lane ${lane.id} completed`)}`
  )
  return lines.join("\n")
}

/** Log file name for a lane, and the extra parts its services write. Pure. */
export function laneLogParts(lane) {
  requireObject(lane, "lane")
  return Object.freeze([
    `${lane.id}.log`,
    ...(lane.backgroundServices ?? []).map(
      (service) => service.logFile ?? `${service.id}.log`
    ),
  ])
}

/* ----------------------------------------------------------------- records */

function statusFor({ exitCode, timedOut, cancelled }) {
  if (cancelled) return "cancelled"
  if (timedOut) return "timed_out"
  return exitCode === 0 ? "success" : "failure"
}

/**
 * One `nabaperks.lane-result.v1` document. **Pure.**
 *
 * `testsRun`/`testsPassed`/`testsFailed`/`testsSkipped` are `number | null`.
 * Null means "the output carried no tally this runner recognised", and
 * `countsParsed`/`countsExpected` say whether that is a fact about the lane
 * (a hygiene lane runs no tests) or a defect in this plane's evidence.
 */
export function buildLaneResult({
  lane,
  contract,
  profile,
  ref = null,
  headSha,
  output = "",
  exitCode = null,
  timedOut = false,
  cancelled = false,
  status = null,
  startedAt = null,
  completedAt = null,
  durationSeconds = null,
  logParts = null,
  logDigestValue = null,
}) {
  requireObject(lane, "lane")
  requireObject(contract, "contract")
  const resolved = status ?? statusFor({ exitCode, timedOut, cancelled })
  if (!LANE_STATUSES.includes(resolved)) {
    fail(
      "INVALID_LANE_STATUS",
      `lane status must be one of ${LANE_STATUSES.join(", ")} (received ${describeValue(resolved)})`
    )
  }

  const countsExpected = expectsTestCounts(lane)
  const parsed = resolved === "skipped" ? null : parseLaneCounts(output)
  // A lane that legitimately runs no tests reports zeros, because zero is the
  // truth there. A lane that should have printed a tally and did not reports
  // nulls, because zero would be a lie.
  const counts =
    parsed ??
    (countsExpected || resolved === "skipped"
      ? {
          testsRun: null,
          testsPassed: null,
          testsFailed: null,
          testsSkipped: null,
          flaky: null,
          sources: [],
        }
      : {
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          testsSkipped: 0,
          flaky: 0,
          sources: ["no-test-command"],
        })

  return deepFreeze({
    schema: contract.evidence.resultSchema,
    plane: "local",
    profile,
    ref,
    headSha: String(headSha).toLowerCase(),
    laneId: lane.id,
    title: lane.title ?? lane.id,
    status: resolved,
    exitCode,
    timedOut,
    durationSeconds,
    startedAt,
    completedAt,
    testsRun: counts.testsRun,
    testsPassed: counts.testsPassed,
    testsFailed: counts.testsFailed,
    testsSkipped: counts.testsSkipped,
    flaky: counts.flaky,
    countsExpected,
    countsParsed: parsed !== null,
    countSources: [...counts.sources],
    failures: [...extractFailureTitles(output)],
    commands: [...(lane.commands ?? [])],
    logParts: logParts ?? [...laneLogParts(lane)],
    logDigest: logDigestValue ?? logDigest(output),
  })
}

/**
 * A lane-result document as core/summary.mjs's lane record. **Pure.**
 *
 * The four counts are required non-negative integers there, so a null is
 * rendered as zero in the table - and `buildRunRecord` puts the lanes that
 * needed that coercion into the run's failure list, so the zero is never the
 * only thing a reader sees.
 */
export function toSummaryLane(laneResult) {
  requireObject(laneResult, "laneResult")
  const orZero = (value) => (typeof value === "number" ? value : 0)
  return {
    laneId: laneResult.laneId,
    title: laneResult.title ?? laneResult.laneId,
    status: laneResult.status,
    durationSeconds: laneResult.durationSeconds,
    testsRun: orZero(laneResult.testsRun),
    testsPassed: orZero(laneResult.testsPassed),
    testsFailed: orZero(laneResult.testsFailed),
    testsSkipped: orZero(laneResult.testsSkipped),
    flaky: orZero(laneResult.flaky),
    failures: (laneResult.failures ?? []).map((title) => ({
      title,
      laneId: laneResult.laneId,
    })),
  }
}

/** Lanes that should have reported counts and did not. Pure. */
export function unparsedCountLanes(laneResults) {
  return Object.freeze(
    laneResults
      .filter(
        (lane) =>
          lane.countsExpected &&
          !lane.countsParsed &&
          lane.status !== "skipped" &&
          lane.status !== "cancelled"
      )
      .map((lane) => lane.laneId)
  )
}

/** The run conclusion implied by its lanes. Pure. */
export function conclusionFor(laneResults) {
  if (laneResults.some((lane) => lane.status === "cancelled"))
    return "cancelled"
  if (laneResults.some((lane) => lane.status === "timed_out"))
    return "timed_out"
  if (laneResults.some((lane) => lane.status === "failure")) return "failure"
  if (laneResults.every((lane) => lane.status === "skipped")) return "skipped"
  return "success"
}

/**
 * The record `renderCheckSummary` consumes. **Pure.**
 *
 * Lanes this host could not run appear in `hostedOnlyLanes` with the reason
 * `selectLanes` gave, so the published summary states their absence rather
 * than leaving a gap a reader has to notice.
 */
export function buildRunRecord({
  profile,
  ref = null,
  headSha,
  laneResults,
  hostedOnly = [],
  reasons = {},
  durationSeconds = null,
  logDigestValue,
  plane = "local",
  conclusion = null,
}) {
  if (!Array.isArray(laneResults)) {
    fail(
      "INVALID_INPUT",
      `laneResults must be an array (received ${describeValue(laneResults)})`
    )
  }
  const missingCounts = unparsedCountLanes(laneResults)
  const failures = missingCounts.map((laneId) => ({
    laneId,
    title: "no machine-readable test tally in the lane output",
    message:
      "the lane ran a test command but printed no summary this agent recognises; its counts are reported as zero and cannot be compared against the hosted plane",
  }))

  return {
    plane,
    profile,
    ref,
    headSha: String(headSha).toLowerCase(),
    conclusion: conclusion ?? conclusionFor(laneResults),
    durationSeconds,
    logDigest: logDigestValue,
    lanes: laneResults.map((lane) => toSummaryLane(lane)),
    failures,
    hostedOnlyLanes: hostedOnly.map((lane) => ({
      laneId: lane.id ?? lane,
      reason: reasons[lane.id ?? lane] ?? null,
    })),
  }
}

/* ------------------------------------------------------------------ runtime */

/**
 * Resolve the per-run runtime-env sources on the host. **Impure** for `command`
 * sources (it shells out) and for `generated` sources (it reads the CSPRNG).
 *
 * `exec` is injected as `(command) => Promise<string>` and `randomBytes` as
 * `(n) => Buffer`, so the whole resolver is drivable offline.
 */
export function createRuntimeEnvResolver({ contract, exec, randomBytes }) {
  requireObject(contract, "contract")
  const base64url = (buffer) =>
    Buffer.from(buffer)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

  function parseDotenv(text, map = {}) {
    const inverse = new Map(Object.entries(map))
    const values = {}
    for (const line of String(text).split("\n")) {
      const match =
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (!match) continue
      const raw = match[2]
        .trim()
        .replace(/^"(.*)"$/s, "$1")
        .replace(/^'(.*)'$/s, "$1")
      values[inverse.get(match[1]) ?? match[1]] = raw
    }
    return values
  }

  return async function resolve(source) {
    if (source.kind === "command") {
      const output = await exec(source.command)
      return parseDotenv(output, source.map)
    }
    if (source.kind === "generated") {
      const spec = source.spec ?? {}
      const bytes = spec.bytes ?? 32
      if (source.generator === "standard-webhook-secret") {
        const secret = `v1,whsec_${Buffer.from(randomBytes(bytes)).toString("base64")}`
        return Object.fromEntries(source.provides.map((name) => [name, secret]))
      }
      if (source.generator === "high-entropy-fixture") {
        // A distinct value per name: check-env.mjs refuses two strict secrets
        // that are equal to each other.
        return Object.fromEntries(
          source.provides.map((name) => [name, base64url(randomBytes(bytes))])
        )
      }
      fail(
        "UNSUPPORTED_RUNTIME_ENV_SOURCE",
        `runtime-env source ${JSON.stringify(source.id)} declares generator ${describeValue(source.generator)}, which this runner does not implement`
      )
    }
    fail(
      "UNSUPPORTED_RUNTIME_ENV_SOURCE",
      `runtime-env source ${JSON.stringify(source.id)} is of kind ${describeValue(source.kind)}, which this runner does not implement`
    )
  }
}

/**
 * Execute a profile's lanes and collect the evidence. **Impure.**
 *
 * Dependencies are injected: `containerRuntime` (ops/local-ci/agent/container.mjs),
 * `resolveRuntimeEnv`, `openLaneLog` (a `(name) => { write, close, read }`
 * sink), `hostEnv`, `now`, and `logger`. Nothing here reads `process.env` or
 * the clock directly.
 *
 * Lanes run one at a time, in profile order. `contract.agent.maxConcurrentLanes`
 * is therefore satisfied trivially, and every `concurrencyGroup` with it: no
 * two lanes are ever in flight, so no two lanes contend for 127.0.0.1:3000 or
 * for the local Supabase ports. Running independent lanes in parallel is a
 * later change, and it is the concurrency groups that will make it safe.
 */
export function createRunner({
  contract,
  containerRuntime,
  resolveRuntimeEnv,
  openLaneLog,
  hostEnv = {},
  arch,
  image,
  daemonImage,
  workspaceHostPath,
  now = () => Date.now(),
  logger = null,
} = {}) {
  requireObject(contract, "contract")
  requireObject(containerRuntime, "containerRuntime")
  if (typeof resolveRuntimeEnv !== "function") {
    fail(
      "INVALID_INPUT",
      `createRunner requires a resolveRuntimeEnv(source) function (received ${describeValue(resolveRuntimeEnv)})`
    )
  }
  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }

  return Object.freeze({
    async runProfile({
      profile,
      ref = null,
      headSha,
      signal = null,
      writeEnvFile,
    }) {
      requireObject(profile, "profile")
      const routing = selectLanes(profile, { arch })
      const runStarted = now()

      // Per-run sources resolve once so every lane sees identical values.
      const perRunValues = {}
      const perRunIds = new Set()
      for (const lane of routing.local) {
        for (const source of partitionRuntimeSources(profile, lane, contract)
          .perRun) {
          if (perRunIds.has(source.id)) continue
          perRunIds.add(source.id)
          Object.assign(perRunValues, await resolveRuntimeEnv(source))
        }
      }

      const laneResults = []
      const logBundle = []
      let stopped = false

      for (const lane of routing.local) {
        if (stopped || signal?.aborted) {
          laneResults.push(
            buildLaneResult({
              lane,
              contract,
              profile: profile.profile,
              ref,
              headSha,
              status: signal?.aborted ? "cancelled" : "skipped",
              output: "",
              durationSeconds: 0,
            })
          )
          continue
        }

        const laneStarted = now()
        const env = buildJobEnv({
          profile,
          lane: laneForEnvBuild(lane, contract),
          runtimeEnv: perRunValues,
          hostEnv,
          contract,
        })
        const envFile =
          typeof writeEnvFile === "function"
            ? await writeEnvFile(lane, env)
            : null
        const sink = openLaneLog ? await openLaneLog(`${lane.id}.log`) : null
        let output = ""

        let result
        try {
          result = await containerRuntime.withJobContainer({
            headSha,
            laneId: lane.id,
            image,
            daemonImage,
            command: ["bash", "-lc", buildLaneScript(lane, contract)],
            workspaceHostPath,
            env,
            envFile,
            labels: {
              "com.nabaperks.local-ci.profile": profile.profile,
              "com.nabaperks.local-ci.lane": lane.id,
              "com.nabaperks.local-ci.head-sha": String(headSha).toLowerCase(),
            },
            timeoutMs: Math.round(lane.timeoutMinutes * 60_000),
            needsDaemon: lane.concurrencyGroup === "supabase-local",
            signal,
            onOutput: (chunk) => {
              output += chunk
              sink?.write(chunk)
            },
          })
        } finally {
          await sink?.close?.()
        }

        const laneEnded = now()
        const laneResult = buildLaneResult({
          lane,
          contract,
          profile: profile.profile,
          ref,
          headSha,
          output: result?.output ?? output,
          exitCode: result?.exitCode ?? null,
          timedOut: result?.timedOut ?? false,
          cancelled: result?.cancelled ?? false,
          startedAt: new Date(laneStarted).toISOString(),
          completedAt: new Date(laneEnded).toISOString(),
          durationSeconds: Math.round((laneEnded - laneStarted) / 1000),
        })
        laneResults.push(laneResult)
        logBundle.push(result?.output ?? output)

        if (laneResult.status !== "success" && lane.continueOnError !== true) {
          log(
            "warn",
            `lane ${lane.id} reported ${laneResult.status}; stopping the run - the remaining lanes are recorded as skipped`
          )
          stopped = true
        }
      }

      const runEnded = now()
      return Object.freeze({
        laneResults: Object.freeze(laneResults),
        routing,
        record: buildRunRecord({
          profile: profile.profile,
          ref,
          headSha,
          laneResults,
          hostedOnly: routing.hostedOnly,
          reasons: routing.reasons,
          durationSeconds: Math.round((runEnded - runStarted) / 1000),
          logDigestValue: digestLogBundle(logBundle),
        }),
        startedAt: new Date(runStarted).toISOString(),
        completedAt: new Date(runEnded).toISOString(),
      })
    },
  })
}
