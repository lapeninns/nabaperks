/**
 * The GitHub check output.
 *
 * This is the only artifact of a local run that leaves the operator's machine,
 * so it carries two jobs at once. It has to be readable by a human deciding
 * whether to merge, and it has to be parseable by the shadow-mode comparison
 * that decides whether this plane is trustworthy at all - which is why the
 * per-lane counts are published twice: once in a table and once as fenced
 * JSON, from the same source values.
 *
 * Two rules are absolute:
 *
 *   - Truncation is always announced. A failure list that silently stops at 20
 *     entries reads as "20 failures" when it was 400, and someone merges.
 *   - Nothing named in `contract.hostSecrets`, and nothing credential-shaped,
 *     survives into the output. The redaction runs over the finished strings
 *     and then a proof pass re-checks them, because the redaction is an
 *     argument and the proof is a proof.
 */

import { LocalCiError, describeValue } from "./contract.mjs"
import { formatDigestLine, isDigestShaped } from "./digest.mjs"
import { credentialShapeOf, redactCredentials } from "./job-env.mjs"

/** Maximum failure entries rendered before the "N more" line takes over. */
export const FAILURE_LIST_CAP = 20

/** Maximum length of the check run title, per the GitHub Checks API. */
export const TITLE_MAX_LENGTH = 255

/** Fence label of the machine-readable block, used by `extractLaneSummary`. */
export const LANE_SUMMARY_FENCE = "json"

/** Heading the machine-readable block sits under. */
export const LANE_SUMMARY_HEADING = "Lane summary (machine-readable)"

export const CHECK_CONCLUSIONS = Object.freeze([
  "success",
  "failure",
  "neutral",
  "cancelled",
  "timed_out",
  "action_required",
  "skipped",
  "stale",
])

export const LANE_STATUSES = Object.freeze([
  "success",
  "failure",
  "timed_out",
  "cancelled",
  "skipped",
])

export const REDACTION_PLACEHOLDER = "[redacted]"

export class SummaryError extends LocalCiError {}

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/

function fail(code, message) {
  throw new SummaryError(code, `local-ci summary: ${message}`)
}

function requireObject(value, path) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(
      "RECORD_SHAPE",
      `${path} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

function requireCount(value, path) {
  if (!Number.isInteger(value) || value < 0) {
    fail(
      "RECORD_SHAPE",
      `${path} must be a non-negative integer (received ${describeValue(value)}); a missing count and a zero count are different facts`
    )
  }
  return value
}

/**
 * A value rendered into a markdown table cell.
 *
 * The backslash is escaped first because it is the escape character: escaping
 * the pipe first turns a value containing `\|` into `\\|`, where the leading
 * backslash consumes its own escape and the pipe breaks out to forge an extra
 * column. This table is the evidence a reviewer reads before merging, so a
 * crafted lane id or failure string must not be able to move a count into a
 * different column.
 *
 * A row ends at the first line break and a carriage return ends it exactly as
 * a newline does, so both fold to a space - and a CRLF pair, which is what a
 * Windows-shaped log line carries, folds to one space rather than two.
 *
 * The escaped characters are deliberately disjoint from the credential shapes
 * in job-env.mjs: redaction runs over the finished string, so an escape
 * inserted inside a token would hide it from the pass that must catch it.
 */
export function escapeCell(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n?|\n/g, " ")
}

/**
 * A value rendered as a markdown code span.
 *
 * Backticks inside the value are data, not delimiters, and a code span has no
 * escape character - a backslash inside one is a literal backslash. So the
 * span is fenced with one more backtick than the longest run it contains and
 * padded when the value itself begins or ends with one, which is what
 * CommonMark prescribes. Without this a lane id containing a backtick closes
 * its own span early and the remainder renders as markdown.
 */
function codeSpan(value) {
  const text = String(value).replace(/\r\n?|\n/g, " ")
  const longestRun = (text.match(/`+/g) ?? []).reduce(
    (longest, run) => Math.max(longest, run.length),
    0
  )
  const fence = "`".repeat(longestRun + 1)
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : ""
  return `${fence}${pad}${text}${pad}${fence}`
}

/**
 * A value rendered as running markdown text - a failure title, a message, a
 * reason.
 *
 * Line breaks fold to a space because a list item is one line, and the
 * characters that could restructure what follows are escaped: the backslash
 * first, then the code-span delimiter, the raw-HTML opener (`<!--` would hide
 * the rest of the section from the reader outright), the link brackets and
 * the table delimiter. Everything else is left alone, so a message naming
 * `timed_out` or a shard `1/8` still reads as itself.
 */
function escapeInline(value) {
  return String(value)
    .replace(/[\\`<>[\]|]/g, "\\$&")
    .replace(/\r\n?|\n/g, " ")
}

/** `45s` / `12m 03s`. An em dash when the duration was not recorded. */
export function formatDuration(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "—"
  }
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  return `${minutes}m ${String(rest).padStart(2, "0")}s`
}

function normaliseFailure(entry, laneId, index, path) {
  if (typeof entry === "string") {
    if (entry.trim() === "") {
      fail("RECORD_SHAPE", `${path}[${index}] is an empty failure title`)
    }
    return { laneId, title: entry, message: null }
  }
  requireObject(entry, `${path}[${index}]`)
  if (typeof entry.title !== "string" || entry.title.trim() === "") {
    fail(
      "RECORD_SHAPE",
      `${path}[${index}].title must be a non-empty string (received ${describeValue(entry.title)})`
    )
  }
  const message =
    typeof entry.message === "string" && entry.message.trim() !== ""
      ? entry.message
      : null
  return { laneId: entry.laneId ?? laneId, title: entry.title, message }
}

function normaliseLane(lane, index) {
  const path = `record.lanes[${index}]`
  requireObject(lane, path)
  const laneId = lane.laneId ?? lane.id
  if (typeof laneId !== "string" || laneId.trim() === "") {
    fail(
      "RECORD_SHAPE",
      `${path}.laneId must be a non-empty string (received ${describeValue(laneId)})`
    )
  }
  if (!LANE_STATUSES.includes(lane.status)) {
    fail(
      "RECORD_SHAPE",
      `${path}.status must be one of ${LANE_STATUSES.join(", ")} (received ${describeValue(lane.status)})`
    )
  }
  const failures = Array.isArray(lane.failures)
    ? lane.failures.map((entry, failureIndex) =>
        normaliseFailure(entry, laneId, failureIndex, `${path}.failures`)
      )
    : []

  return {
    laneId,
    title: typeof lane.title === "string" ? lane.title : laneId,
    status: lane.status,
    durationSeconds:
      typeof lane.durationSeconds === "number" ? lane.durationSeconds : null,
    testsRun: requireCount(lane.testsRun, `${path}.testsRun`),
    testsPassed: requireCount(lane.testsPassed, `${path}.testsPassed`),
    testsFailed: requireCount(lane.testsFailed, `${path}.testsFailed`),
    testsSkipped: requireCount(lane.testsSkipped, `${path}.testsSkipped`),
    flaky:
      lane.flaky === undefined ? 0 : requireCount(lane.flaky, `${path}.flaky`),
    failures,
    ...(typeof lane.countsExpected === "boolean"
      ? { countsExpected: lane.countsExpected }
      : {}),
    ...(typeof lane.countsParsed === "boolean"
      ? { countsParsed: lane.countsParsed }
      : {}),
    ...(typeof lane.blockedByLaneId === "string"
      ? { blockedByLaneId: lane.blockedByLaneId }
      : {}),
  }
}

function normaliseRecord(record, contract) {
  requireObject(record, "record")
  if (!CHECK_CONCLUSIONS.includes(record.conclusion)) {
    fail(
      "RECORD_SHAPE",
      `record.conclusion must be one of ${CHECK_CONCLUSIONS.join(", ")} (received ${describeValue(record.conclusion)})`
    )
  }
  if (typeof record.headSha !== "string" || !COMMIT_SHA.test(record.headSha)) {
    fail(
      "RECORD_SHAPE",
      `record.headSha must be a 40-character hexadecimal commit SHA (received ${describeValue(record.headSha)})`
    )
  }
  if (typeof record.profile !== "string" || record.profile.trim() === "") {
    fail(
      "RECORD_SHAPE",
      `record.profile must be a non-empty string (received ${describeValue(record.profile)})`
    )
  }
  if (!isDigestShaped(record.logDigest)) {
    fail(
      "MISSING_LOG_DIGEST",
      `record.logDigest must be 64 lowercase hexadecimal characters (received ${describeValue(record.logDigest)}); the summary is not publishable without the evidence digest`
    )
  }
  if (!Array.isArray(record.lanes)) {
    fail(
      "RECORD_SHAPE",
      `record.lanes must be an array (received ${describeValue(record.lanes)})`
    )
  }

  const lanes = record.lanes.map((lane, index) => normaliseLane(lane, index))
  const runFailures = Array.isArray(record.failures)
    ? record.failures.map((entry, index) =>
        normaliseFailure(entry, null, index, "record.failures")
      )
    : []

  const hostedOnlyLanes = Array.isArray(record.hostedOnlyLanes)
    ? record.hostedOnlyLanes.map((entry, index) => {
        if (typeof entry === "string") return { laneId: entry, reason: null }
        requireObject(entry, `record.hostedOnlyLanes[${index}]`)
        const laneId = entry.laneId ?? entry.id
        if (typeof laneId !== "string" || laneId.trim() === "") {
          fail(
            "RECORD_SHAPE",
            `record.hostedOnlyLanes[${index}].laneId must be a non-empty string`
          )
        }
        return { laneId, reason: entry.reason ?? null }
      })
    : []

  return {
    schema: contract.evidence.resultSchema,
    plane: record.plane ?? "local",
    profile: record.profile,
    ref: typeof record.ref === "string" ? record.ref : null,
    headSha: record.headSha.toLowerCase(),
    conclusion: record.conclusion,
    deadlineExpired: record.deadlineExpired === true,
    durationSeconds:
      typeof record.durationSeconds === "number"
        ? record.durationSeconds
        : null,
    logDigest: record.logDigest,
    lanes,
    runFailures,
    hostedOnlyLanes,
  }
}

/**
 * The block the shadow-mode comparison reads. Exported so the comparison and
 * the renderer cannot drift: both build it from the same normalised record.
 */
export function buildLaneSummary(record, contract) {
  const normalised = normaliseRecord(record, contract)
  return {
    schema: normalised.schema,
    plane: normalised.plane,
    profile: normalised.profile,
    headSha: normalised.headSha,
    conclusion: normalised.conclusion,
    ...(normalised.deadlineExpired ? { deadlineExpired: true } : {}),
    logDigest: normalised.logDigest,
    lanes: normalised.lanes.map((lane) => ({
      laneId: lane.laneId,
      status: lane.status,
      durationSeconds: lane.durationSeconds,
      testsRun: lane.testsRun,
      testsPassed: lane.testsPassed,
      testsFailed: lane.testsFailed,
      testsSkipped: lane.testsSkipped,
      flaky: lane.flaky,
      ...(typeof lane.countsExpected === "boolean"
        ? { countsExpected: lane.countsExpected }
        : {}),
      ...(typeof lane.countsParsed === "boolean"
        ? { countsParsed: lane.countsParsed }
        : {}),
      ...(lane.blockedByLaneId
        ? { blockedByLaneId: lane.blockedByLaneId }
        : {}),
    })),
    hostedOnlyLanes: normalised.hostedOnlyLanes.map((entry) => entry.laneId),
  }
}

/**
 * Strip anything that must not be published: the host-secret names from the
 * contract, then every credential shape job-env.mjs knows about.
 *
 * Names are redacted, not just values. `contract.hostSecrets` is a list of
 * strings, and the rule this implements is that none of those strings appears
 * in the published output - which is a rule a test can check without knowing
 * any secret value.
 */
export function redactSummaryText(text, contract) {
  if (typeof text !== "string") return text
  let redacted = text
  for (const name of contract.hostSecrets ?? []) {
    if (typeof name !== "string" || name === "") continue
    redacted = redacted.split(name).join(REDACTION_PLACEHOLDER)
  }
  return redactCredentials(redacted, REDACTION_PLACEHOLDER)
}

/**
 * Proof pass. Throws if a host-secret name or a credential shape survived the
 * redaction, so a rendering bug fails the publish rather than the boundary.
 */
export function assertPublishable(parts, contract) {
  for (const [key, text] of Object.entries(parts)) {
    if (typeof text !== "string") continue
    for (const name of contract.hostSecrets ?? []) {
      if (typeof name === "string" && name !== "" && text.includes(name)) {
        fail(
          "HOST_SECRET_IN_SUMMARY",
          `rendered ${key} still contains the host secret name ${JSON.stringify(name)} after redaction`
        )
      }
    }
    const shape = credentialShapeOf(text)
    if (shape !== null) {
      fail(
        "CREDENTIAL_IN_SUMMARY",
        `rendered ${key} still contains a value shaped like a ${shape} after redaction`
      )
    }
  }
  return parts
}

function renderLaneTable(lanes) {
  const header = [
    "| Lane | Status | Duration | Run | Passed | Failed | Skipped | Flaky |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  const rows = lanes.map((lane) => {
    const cells = [
      escapeCell(lane.laneId),
      escapeCell(lane.status),
      formatDuration(lane.durationSeconds),
      String(lane.testsRun),
      String(lane.testsPassed),
      String(lane.testsFailed),
      String(lane.testsSkipped),
      String(lane.flaky),
    ]
    return `| ${cells.join(" | ")} |`
  })
  return [...header, ...rows].join("\n")
}

function renderFailures(failures) {
  if (failures.length === 0) {
    return ["## Failures", "", "None."].join("\n")
  }
  const shown = failures.slice(0, FAILURE_LIST_CAP)
  const lines = shown.map((entry) => {
    const where = entry.laneId ? `${codeSpan(entry.laneId)} — ` : ""
    const detail = entry.message ? `: ${escapeInline(entry.message)}` : ""
    return `- ${where}${escapeInline(entry.title)}${detail}`
  })
  if (failures.length > shown.length) {
    // Announced, never silent. Someone reading a capped list has to know the
    // list was capped, and by how much.
    lines.push(
      `- … and ${failures.length - shown.length} more failures not listed (${failures.length} total).`
    )
  }
  return ["## Failures", "", ...lines].join("\n")
}

function renderHostedOnly(hostedOnlyLanes) {
  if (hostedOnlyLanes.length === 0) return null
  const lines = hostedOnlyLanes.map((entry) =>
    entry.reason
      ? `- ${codeSpan(entry.laneId)} — ${escapeInline(entry.reason)}`
      : `- ${codeSpan(entry.laneId)}`
  )
  return [
    "## Lanes left to the GitHub-hosted plane",
    "",
    "These lanes did not run here and are covered hosted. They are listed so",
    "the absence of a result is a stated fact rather than a missing row.",
    "",
    ...lines,
  ].join("\n")
}

/**
 * Render the GitHub check output for a completed run.
 *
 * `record` is the run document: `{ profile, ref?, headSha, conclusion,
 * durationSeconds?, logDigest, lanes[], failures?[], hostedOnlyLanes?[] }`,
 * where each lane carries `{ laneId, title?, status, durationSeconds?,
 * testsRun, testsPassed, testsFailed, testsSkipped, flaky?, failures?[] }`.
 *
 * Returns `{ title, summary, text }`. The last line of `text` is always
 * `Log digest: <64 hex>`, which is what the runbook's `tail -n 1` reads.
 */
export function renderCheckSummary(record, contract) {
  requireObject(contract, "contract")
  requireObject(contract.evidence, "contract.evidence")
  const normalised = normaliseRecord(record, contract)
  const laneSummary = buildLaneSummary(record, contract)

  const totals = normalised.lanes.reduce(
    (accumulator, lane) => ({
      run: accumulator.run + lane.testsRun,
      passed: accumulator.passed + lane.testsPassed,
      failed: accumulator.failed + lane.testsFailed,
      skipped: accumulator.skipped + lane.testsSkipped,
      flaky: accumulator.flaky + lane.flaky,
    }),
    { run: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 }
  )
  const lanesPassed = normalised.lanes.filter(
    (lane) => lane.status === "success"
  ).length

  const failures = [
    ...normalised.runFailures,
    ...normalised.lanes.flatMap((lane) => lane.failures),
  ]

  const rawTitle = `${normalised.conclusion} — ${lanesPassed}/${normalised.lanes.length} lanes, ${totals.passed}/${totals.run} tests`
  const title =
    rawTitle.length > TITLE_MAX_LENGTH
      ? `${rawTitle.slice(0, TITLE_MAX_LENGTH - 1)}…`
      : rawTitle

  // The conclusion and the head SHA are validated shapes, but the profile and
  // the ref are whatever the run was started with, and a ref carrying a line
  // break or a backtick would restructure the block a reviewer reads. One rule
  // for all four, so no future field arrives unescaped by omission.
  const summaryLines = [
    `**Conclusion:** ${codeSpan(normalised.conclusion)}`,
    `**Profile:** ${codeSpan(normalised.profile)}`,
    `**Head SHA:** ${codeSpan(normalised.headSha)}`,
  ]
  if (normalised.ref) summaryLines.push(`**Ref:** ${codeSpan(normalised.ref)}`)
  summaryLines.push(
    `**Duration:** ${formatDuration(normalised.durationSeconds)}`,
    "",
    `Tests: ${totals.run} run · ${totals.passed} passed · ${totals.failed} failed · ${totals.skipped} skipped · ${totals.flaky} flaky.`
  )

  const hostedOnly = renderHostedOnly(normalised.hostedOnlyLanes)
  const sections = [
    "## Lanes",
    "",
    renderLaneTable(normalised.lanes),
    "",
    ...(hostedOnly === null ? [] : [hostedOnly, ""]),
    renderFailures(failures),
    "",
    `## ${LANE_SUMMARY_HEADING}`,
    "",
    "```" + LANE_SUMMARY_FENCE,
    JSON.stringify(laneSummary, null, 2),
    "```",
    "",
    // Last line, always. The runbook verifies evidence with `tail -n 1`.
    formatDigestLine(normalised.logDigest),
  ]

  const parts = {
    title: redactSummaryText(title, contract),
    summary: redactSummaryText(summaryLines.join("\n"), contract),
    text: redactSummaryText(sections.join("\n"), contract),
  }
  assertPublishable(parts, contract)
  return Object.freeze(parts)
}

/**
 * Recover the machine-readable block from a rendered `text`. Returns null when
 * the block is absent or unparseable, so a caller can distinguish "this check
 * predates the block" from "this check is corrupt".
 */
export function extractLaneSummary(text) {
  if (typeof text !== "string") return null
  const heading = `## ${LANE_SUMMARY_HEADING}`
  const headingIndex = text.indexOf(heading)
  if (headingIndex === -1) return null
  const fenceOpen = text.indexOf("```" + LANE_SUMMARY_FENCE, headingIndex)
  if (fenceOpen === -1) return null
  const bodyStart = text.indexOf("\n", fenceOpen)
  if (bodyStart === -1) return null
  const fenceClose = text.indexOf("\n```", bodyStart)
  if (fenceClose === -1) return null
  try {
    return JSON.parse(text.slice(bodyStart + 1, fenceClose))
  } catch {
    return null
  }
}
