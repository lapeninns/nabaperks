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
 *   - **A log named in the evidence exists.** `logParts` lists the files this
 *     run actually wrote into the run directory, and `logDigest` is the bundle
 *     digest over exactly those files in exactly that order. A background
 *     service's log is written inside the VM workspace, which is deleted with
 *     the worktree, so it is copied out before the lane's result is built; one
 *     that could not be copied is named in `missingLogParts` rather than
 *     quietly dropped, because an absent log and an empty log are different
 *     facts.
 *
 * The run also has a deadline of its own. Every lane carries a timeout, but a
 * profile's lanes summed run far past `bridge.timeoutMinutes` - so a run that
 * is slow rather than hung would still be burning the machine long after the
 * hosted bridge had given up, and would publish into a check nobody was
 * waiting for. `runDeadlineMs` is the whole-profile ceiling that keeps the
 * agent-side expiry first, and it is enforced by clamping the in-flight lane
 * and skipping the rest.
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
import { digestLogBundle } from "../core/digest.mjs"
import { buildJobEnv } from "../core/job-env.mjs"
import { selectLanes } from "../core/profiles.mjs"
import { LANE_STATUSES } from "../core/summary.mjs"

export class RunnerError extends LocalCiError {}

/** Prefix of every line this runner injects into a lane's log. */
export const LOG_MARKER = "##local-ci##"

/** Cap on failure titles collected from one lane's output. */
export const LANE_FAILURE_CAP = 50

/**
 * Minutes held back from the bridge's ceiling for everything that happens
 * after the last lane stops: the container teardown, the workspace release,
 * the evidence write and the check-run publish. A deadline that consumed the
 * whole window would expire into a bridge that had already stopped polling,
 * which is the failure it exists to prevent.
 */
export const PUBLISH_MARGIN_MINUTES = 10

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

/* ----------------------------------------------------------------- deadline */

/**
 * The whole-profile ceiling, in milliseconds. **Pure.**
 *
 * Derived from the bridge's own ceiling rather than from the profile, because
 * the property that matters is a relationship between the two planes: the
 * agent must stop, tear down and publish while the hosted job is still
 * listening. Summing the lanes would derive the opposite - pr and main allow
 * about 295 lane-minutes and nightly about 535, all of them past the 120 the
 * bridge waits.
 *
 * This is a ceiling on the run, not a budget for it. A healthy pr run finishes
 * inside a fraction of it; what it stops is the run that is merely slow, which
 * a per-lane timeout never catches because no single lane exceeds its own.
 */
export function runDeadlineMs(contract) {
  requireObject(contract, "contract")
  const minutes = contract.bridge?.timeoutMinutes
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    fail(
      "INVALID_CONTRACT",
      `contract.bridge.timeoutMinutes must be a positive finite number (received ${describeValue(minutes)})`
    )
  }
  const budget = minutes - PUBLISH_MARGIN_MINUTES
  if (budget <= 0) {
    fail(
      "INVALID_CONTRACT",
      `contract.bridge.timeoutMinutes is ${minutes}, which leaves nothing once the ${PUBLISH_MARGIN_MINUTES}-minute publishing margin is held back; the agent-side ceiling must expire before the bridge's`
    )
  }
  return Math.round(budget * 60_000)
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
    `${variable}="$(${guard.mutationCheck.command})"`,
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

/**
 * The background-service logs a lane declares. **Pure.**
 *
 * `source` is the name the service writes inside the workspace; `stored` is
 * the name that copy takes in the run directory. They differ because the run
 * directory is flat and shared by every lane in the run, so two lanes that
 * declared the same log file name would otherwise overwrite each other's
 * evidence - and the digest of whichever was written first would then no
 * longer match its own bytes on disk.
 */
export function laneServiceLogs(lane) {
  requireObject(lane, "lane")
  const taken = new Set([`${lane.id}.log`])
  return Object.freeze(
    (lane.backgroundServices ?? []).map((service) => {
      const source = service.logFile ?? `${service.id}.log`
      const stored = `${lane.id}.${source}`
      // Two parts under one name would mean the second overwrote the first,
      // and the digest of a bundle that names both would match neither file.
      if (taken.has(stored)) {
        fail(
          "DUPLICATE_LOG_PART",
          `lane ${JSON.stringify(lane.id)} would store two log parts as ${JSON.stringify(stored)}; every part in a run directory has to be openable by the name the evidence gives it`
        )
      }
      taken.add(stored)
      return Object.freeze({ serviceId: service.id, source, stored })
    })
  )
}

/**
 * Every log part a lane would contribute if everything it declares is
 * captured, in digest order. Pure.
 *
 * This is the declared set, not the recorded one: a lane result's `logParts`
 * names only the files that reached the run directory.
 */
export function laneLogParts(lane) {
  requireObject(lane, "lane")
  return Object.freeze([
    `${lane.id}.log`,
    ...laneServiceLogs(lane).map((part) => part.stored),
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
 *
 * `logs` is `[{ name, text }]`: the files this lane put in the run directory,
 * in the order they are hashed. `logParts` is their names and `logDigest` is
 * `digestLogBundle` over their texts, so the record's manifest and its digest
 * can never describe different sets of bytes. Anything the lane declared and
 * did not produce belongs in `missingLogs` as `{ name, reason }`.
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
  logs = null,
  missingLogs = [],
  logDigestValue = null,
  blockedByLaneId = null,
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

  // A lane that never started wrote nothing, so it names no parts. Every other
  // lane has at least its own streamed output.
  const parts =
    logs ??
    (resolved === "skipped" || resolved === "cancelled"
      ? []
      : [{ name: `${lane.id}.log`, text: output }])
  for (const [index, part] of parts.entries()) {
    requireObject(part, `logs[${index}]`)
    if (typeof part.name !== "string" || part.name.trim() === "") {
      fail(
        "INVALID_INPUT",
        `logs[${index}].name must be a non-empty string (received ${describeValue(part.name)})`
      )
    }
    if (typeof part.text !== "string") {
      fail(
        "INVALID_INPUT",
        `logs[${index}].text must be a string (received ${describeValue(part.text)}); a part named in logParts must carry the bytes it was hashed from`
      )
    }
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
    blockedByLaneId,
    countsExpected,
    countsParsed: parsed !== null,
    countSources: [...counts.sources],
    failures: [...extractFailureTitles(output)],
    commands: [...(lane.commands ?? [])],
    logParts: parts.map((part) => part.name),
    missingLogParts: missingLogs.map((entry) => ({
      name: entry.name,
      reason: entry.reason ?? null,
    })),
    logDigest: logDigestValue ?? digestLogBundle(parts.map((p) => p.text)),
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
    countsExpected: laneResult.countsExpected,
    countsParsed: laneResult.countsParsed,
    blockedByLaneId: laneResult.blockedByLaneId ?? null,
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

/**
 * The run conclusion implied by its lanes. Pure.
 *
 * `deadlineExpired` reads as a timed-out lane, because that is what it is: the
 * run was stopped by a clock rather than by a result.
 */
export function conclusionFor(laneResults, { deadlineExpired = false } = {}) {
  if (laneResults.some((lane) => lane.status === "cancelled"))
    return "cancelled"
  if (
    deadlineExpired ||
    laneResults.some((lane) => lane.status === "timed_out")
  )
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
 *
 * A run stopped by its own deadline says so in the failure list as well as in
 * the conclusion, because "timed_out" on its own does not distinguish one
 * hung lane from a profile that simply did not fit.
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
  deadlineExpired = false,
  deadlineMinutes = null,
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
  for (const lane of laneResults) {
    for (const part of lane.missingLogParts ?? []) {
      failures.push({
        laneId: lane.laneId,
        title: `declared log ${part.name} is not in the evidence`,
        message:
          part.reason ??
          "the lane declared this log and the run directory does not hold it; that lane's evidence cannot be fully reconstructed",
      })
    }
  }
  if (deadlineExpired) {
    const skipped = laneResults.filter(
      (lane) => lane.status === "skipped"
    ).length
    failures.push({
      laneId: null,
      title: "the run hit its whole-profile deadline",
      message: `the agent stopped ${deadlineMinutes === null ? "at its whole-profile ceiling" : `after ${deadlineMinutes} minutes`} so it could tear down and publish before the hosted bridge stops polling; ${skipped} lane(s) never ran and this result covers less than the profile declares`,
    })
  }

  return {
    plane,
    profile,
    ref,
    headSha: String(headSha).toLowerCase(),
    conclusion: conclusion ?? conclusionFor(laneResults, { deadlineExpired }),
    durationSeconds,
    deadlineExpired,
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
 *
 * The run's own deadline is enforced in two places, both of them here: a lane
 * about to start after it has passed is skipped instead, and a lane that
 * starts inside it is given the *remaining* time rather than its own, so the
 * container is stopped and torn down at the deadline rather than at whatever
 * its profile allowed.
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

  /**
   * The lane's own streamed output plus every background-service log it
   * declared, copied out of the VM workspace and into the run directory.
   *
   * Called while the workspace still exists - the caller deletes the worktree
   * once the run ends, and these files live inside it. A log that could not be
   * copied comes back in `missing` with the reason, never dropped: the whole
   * value of the digest is that a reader can rebuild it from the files the
   * record names.
   */
  async function captureLaneLogs(lane, laneOutput) {
    const logs = [{ name: `${lane.id}.log`, text: laneOutput }]
    const missing = []
    for (const part of laneServiceLogs(lane)) {
      if (typeof containerRuntime.readWorkspaceLog !== "function") {
        missing.push({
          name: part.stored,
          reason:
            "this container runtime cannot read a file back out of the run workspace",
        })
        continue
      }
      const read = await containerRuntime.readWorkspaceLog({
        workspaceHostPath,
        name: part.source,
      })
      if (read.status !== "captured") {
        missing.push({
          name: part.stored,
          reason:
            read.reason ??
            `${part.source}, declared by background service ${part.serviceId}, is ${read.status}`,
        })
        continue
      }
      if (read.truncated === true) {
        // The stored copy and its digest still agree, so the evidence stays
        // verifiable; what is lost is the tail of a service's own log.
        log(
          "warn",
          `lane ${lane.id}: ${part.source} was longer than this plane copies out of the workspace; the evidence holds its first portion only`
        )
      }
      try {
        const sink = openLaneLog ? await openLaneLog(part.stored) : null
        sink?.write(read.text)
        await sink?.close?.()
      } catch (error) {
        missing.push({
          name: part.stored,
          reason: `read out of the workspace but could not be written to the run directory: ${error.message}`,
        })
        continue
      }
      logs.push({ name: part.stored, text: read.text })
    }
    return { logs, missing }
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
      const deadlineMs = runDeadlineMs(contract)
      const deadlineMinutes = Math.round(deadlineMs / 60_000)
      const deadlineAt = runStarted + deadlineMs

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
      let stoppedByLaneId = null
      let deadlineExpired = false

      for (const lane of routing.local) {
        const remainingMs = deadlineAt - now()
        if (
          !stopped &&
          !deadlineExpired &&
          !signal?.aborted &&
          remainingMs <= 0
        ) {
          deadlineExpired = true
          log(
            "warn",
            `the run passed its ${deadlineMinutes}-minute ceiling before lane ${lane.id} started; the remaining lanes are recorded as skipped and this run publishes a timed-out conclusion while the hosted bridge is still listening`
          )
        }
        if (stopped || deadlineExpired || signal?.aborted) {
          laneResults.push(
            buildLaneResult({
              lane,
              contract,
              profile: profile.profile,
              ref,
              headSha,
              status: signal?.aborted ? "cancelled" : "skipped",
              blockedByLaneId: stoppedByLaneId,
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
        if (signal?.aborted) {
          laneResults.push(
            buildLaneResult({
              lane,
              contract,
              profile: profile.profile,
              ref,
              headSha,
              status: "cancelled",
              output: "",
              durationSeconds: 0,
            })
          )
          continue
        }
        const sink = openLaneLog ? await openLaneLog(`${lane.id}.log`) : null
        let output = ""

        let result = null
        let runtimeError = null
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
            // The remaining run budget, not the lane's own: the two differ
            // only when the deadline would fall inside this lane, and that is
            // precisely when the lane must be the one to give way.
            timeoutMs: Math.min(
              Math.round(lane.timeoutMinutes * 60_000),
              remainingMs
            ),
            // The lane declares this. Inferring it from `concurrencyGroup`
            // tied "needs a Docker daemon" to "contends for the Supabase
            // ports", which are unrelated facts: the nightly `zap-full` lane
            // shells out to `docker run` while grouping on the HTTP port, so
            // it was scheduled without a daemon and could only ever have
            // failed. A group rename must not be able to take the daemon away
            // from a lane that needs one.
            needsDaemon: lane.needsDaemon === true,
            signal,
            onOutput: (chunk) => {
              output += chunk
              sink?.write(chunk)
            },
          })
        } catch (error) {
          // A lane whose container could not be started at all - a stale
          // resource that would not reconcile, a docker that is not there - is
          // a failed lane, not a failed run. Letting this escape would abort
          // the whole profile before anything was published, and the check the
          // bridge is polling would simply never arrive.
          runtimeError = error
          // Through the sink as well, so the reason is in the lane's log file
          // and not only in the agent's own stderr. The digest below covers
          // these bytes; the file it is rebuilt from has to carry them too.
          const note = `${LOG_MARKER} lane ${lane.id} could not run: ${error.message}\n`
          output += note
          sink?.write(note)
          log("error", `lane ${lane.id} could not run: ${error.message}`)
        } finally {
          await sink?.close?.()
        }

        // The bytes the log file received, rather than the runtime's own
        // buffered copy: that copy is capped, and a digest taken over a
        // truncated copy would not match the file §6.4 rebuilds it from. The
        // fallback is for a runtime that returns output without streaming it,
        // which writes no file either.
        const laneOutput = output === "" ? (result?.output ?? "") : output
        const laneEnded = now()
        const captured = await captureLaneLogs(lane, laneOutput)
        const laneResult = buildLaneResult({
          lane,
          contract,
          profile: profile.profile,
          ref,
          headSha,
          output: laneOutput,
          exitCode: result?.exitCode ?? null,
          timedOut: result?.timedOut ?? false,
          cancelled: result?.cancelled ?? false,
          status: signal?.aborted
            ? "cancelled"
            : runtimeError === null
              ? null
              : "failure",
          startedAt: new Date(laneStarted).toISOString(),
          completedAt: new Date(laneEnded).toISOString(),
          durationSeconds: Math.round((laneEnded - laneStarted) / 1000),
          logs: captured.logs,
          missingLogs: captured.missing,
        })
        laneResults.push(laneResult)
        // In `logParts` order, so the run digest is reproducible from the
        // manifest the lane documents publish.
        logBundle.push(...captured.logs.map((part) => part.text))

        if (laneResult.status !== "success" && lane.continueOnError !== true) {
          log(
            "warn",
            `lane ${lane.id} reported ${laneResult.status}; stopping the run - the remaining lanes are recorded as skipped`
          )
          stopped = true
          stoppedByLaneId = lane.id
        }
      }

      const runEnded = now()
      return Object.freeze({
        laneResults: Object.freeze(laneResults),
        routing,
        deadlineExpired,
        deadlineAt: new Date(deadlineAt).toISOString(),
        record: buildRunRecord({
          profile: profile.profile,
          ref,
          headSha,
          laneResults,
          hostedOnly: routing.hostedOnly,
          reasons: routing.reasons,
          durationSeconds: Math.round((runEnded - runStarted) / 1000),
          logDigestValue: digestLogBundle(logBundle),
          deadlineExpired,
          deadlineMinutes,
        }),
        startedAt: new Date(runStarted).toISOString(),
        completedAt: new Date(runEnded).toISOString(),
      })
    },
  })
}
