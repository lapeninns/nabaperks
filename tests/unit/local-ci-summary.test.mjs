import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { logDigest, parseDigestLine } from "../../ops/local-ci/core/digest.mjs"
import {
  FAILURE_LIST_CAP,
  REDACTION_PLACEHOLDER,
  SummaryError,
  assertPublishable,
  buildLaneSummary,
  escapeCell,
  extractLaneSummary,
  formatDuration,
  redactSummaryText,
  renderCheckSummary,
} from "../../ops/local-ci/core/summary.mjs"

/**
 * local CI — the check output. It is the only artifact of a local run that
 * leaves the machine, so two rules are absolute: truncation is always
 * announced, because a failure list that silently stops at twenty reads as
 * twenty failures when it was four hundred and someone merges; and nothing
 * named in contract.hostSecrets, and nothing credential-shaped, survives into
 * the published text.
 */

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  fileURLToPath(new URL("../../config/local-ci-contract.json", import.meta.url))
)

const HEAD_SHA = "b".repeat(40)
const DIGEST = logDigest("lane output")

const lane = (overrides = {}) => ({
  laneId: "fast",
  title: "Fast checks",
  status: "success",
  durationSeconds: 754,
  testsRun: 120,
  testsPassed: 118,
  testsFailed: 0,
  testsSkipped: 2,
  ...overrides,
})

const record = (overrides = {}) => ({
  profile: "pr",
  ref: "refs/pull/41/head",
  headSha: HEAD_SHA,
  conclusion: "success",
  durationSeconds: 3600,
  logDigest: DIGEST,
  lanes: [lane()],
  ...overrides,
})

test("the summary ends with the evidence digest and carries the machine-readable block", () => {
  const rendered = renderCheckSummary(record(), contract)

  assert.equal(rendered.text.split("\n").at(-1), `Log digest: ${DIGEST}`)
  assert.equal(parseDigestLine(rendered.text), DIGEST)

  const parsed = extractLaneSummary(rendered.text)
  assert.equal(parsed.schema, contract.evidence.resultSchema)
  assert.equal(parsed.headSha, HEAD_SHA)
  assert.equal(parsed.conclusion, "success")
  assert.equal(parsed.logDigest, DIGEST)
  assert.deepEqual(parsed.lanes, [
    {
      laneId: "fast",
      status: "success",
      durationSeconds: 754,
      testsRun: 120,
      testsPassed: 118,
      testsFailed: 0,
      testsSkipped: 2,
      flaky: 0,
    },
  ])

  // The table and the JSON come from the same normalised record, so they
  // cannot disagree about what happened.
  assert.deepEqual(parsed, buildLaneSummary(record(), contract))
  assert.match(
    rendered.text,
    /\| fast \| success \| 12m 34s \| 120 \| 118 \| 0 \| 2 \| 0 \|/
  )
  assert.equal(rendered.title, "success — 1/1 lanes, 118/120 tests")
})

/**
 * The cells of a rendered table row, split the way a markdown reader splits
 * them: a backslash escapes whatever follows it, every other `|` is a column
 * boundary. An eight-column row yields ten entries - the empty strings outside
 * the leading and trailing pipes.
 */
function markdownCells(row) {
  const cells = []
  let cell = ""
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    if (char === "\\" && index + 1 < row.length) {
      cell += row[index + 1]
      index += 1
    } else if (char === "|") {
      cells.push(cell)
      cell = ""
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

test("a table cell cannot forge a column, whatever the value ends in", () => {
  // A value ending in a backslash, immediately followed by a pipe. Escaping
  // the pipe before the backslash emits `evidence\\|999`, where the backslash
  // escapes the backslash and the pipe is left bare to open a ninth column -
  // so a crafted lane id could file counts under a heading they did not earn,
  // on the one surface a reviewer reads before merging.
  assert.equal(escapeCell("evidence\\|999"), "evidence\\\\\\|999")

  // A carriage return ends a row exactly as a newline does, and a CRLF pair is
  // one break, not two.
  assert.equal(
    escapeCell("first\r\nsecond\rthird\nfourth"),
    "first second third fourth"
  )

  const laneId = "evidence\\| 9 | 9 | 9"
  const rendered = renderCheckSummary(
    record({ lanes: [lane({ laneId })] }),
    contract
  )
  const row = rendered.text
    .split("\n")
    .find((line) => line.startsWith("| evidence"))
  assert.ok(row, "the lane row must be published")

  const cells = markdownCells(row)
  assert.equal(cells.length, 10, "the row still has exactly eight columns")
  assert.equal(cells[1].trim(), laneId, "and the lane id survives intact")
  assert.equal(cells[2].trim(), "success")
  assert.equal(cells[4].trim(), "120")
})

test("a backtick in a value cannot restructure the markdown around it", () => {
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      ref: "refs/heads/`whoami`",
      lanes: [
        lane({
          laneId: "fa`st",
          status: "failure",
          testsFailed: 1,
          failures: [
            {
              title: "spec `a` failed",
              message: "<!-- the rest of the section would vanish",
            },
          ],
        }),
      ],
    }),
    contract
  )

  // The code span is fenced wider than the run it carries, because a code span
  // has no escape character; the running text is backslash-escaped, because it
  // does. An HTML comment opener is escaped for the same reason a backtick is:
  // unescaped it hides everything after it from the reader.
  const failureLine = rendered.text
    .split("\n")
    .find((line) => line.startsWith("- ``"))
  assert.equal(
    failureLine,
    "- ``fa`st`` — spec \\`a\\` failed: \\<!-- the rest of the section would vanish"
  )
  assert.ok(rendered.summary.includes("**Ref:** `` refs/heads/`whoami` ``"))
  assert.equal(extractLaneSummary(rendered.text).lanes[0].laneId, "fa`st")
})

test("a capped failure list announces the cap; it never silently truncates", () => {
  const failures = Array.from({ length: 25 }, (_, index) => ({
    title: `failing spec ${index + 1}`,
    message: "expected true to be false",
  }))
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      lanes: [lane({ status: "failure", testsFailed: 25, failures })],
    }),
    contract
  )

  const listed = rendered.text
    .split("\n")
    .filter((line) => line.startsWith("- `fast`"))
  assert.equal(listed.length, FAILURE_LIST_CAP)
  assert.ok(rendered.text.includes("failing spec 20"))
  assert.equal(rendered.text.includes("failing spec 21"), false)
  assert.ok(
    rendered.text.includes(
      `- … and ${25 - FAILURE_LIST_CAP} more failures not listed (25 total).`
    ),
    "the reader has to be told the list was capped, and by how much"
  )
})

test("a failure list inside the cap is rendered in full with no cap notice", () => {
  const failures = ["first failure", "second failure"]
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      lanes: [lane({ status: "failure", testsFailed: 2, failures })],
    }),
    contract
  )
  assert.ok(rendered.text.includes("- `fast` — first failure"))
  assert.ok(rendered.text.includes("- `fast` — second failure"))
  assert.equal(rendered.text.includes("more failures not listed"), false)
})

test("run-level failures are published alongside the lane failures", () => {
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      failures: [
        {
          title: "lane db printed no test tally",
          message: "the lane ran a test runner but no counts could be parsed",
        },
      ],
      lanes: [lane({ status: "failure", testsFailed: 1, failures: ["boom"] })],
    }),
    contract
  )
  assert.ok(rendered.text.includes("lane db printed no test tally"))
  assert.ok(rendered.text.includes("- `fast` — boom"))
})

test("no lane runs, no failures: the summary says so rather than leaving the section blank", () => {
  const rendered = renderCheckSummary(record(), contract)
  assert.ok(rendered.text.includes("## Failures\n\nNone."))
})

test("the summary redacts every host-secret name from title, summary and text", () => {
  const secretName = contract.hostSecrets[1]
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      ref: `refs/heads/${secretName}`,
      lanes: [
        lane({
          laneId: "fast",
          status: "failure",
          testsFailed: 1,
          failures: [
            {
              title: `env ${secretName} was not set`,
              message: `expected ${secretName} in the job environment`,
            },
          ],
        }),
      ],
    }),
    contract
  )

  for (const name of contract.hostSecrets) {
    assert.equal(
      rendered.text.includes(name),
      false,
      `${name} leaked into text`
    )
    assert.equal(rendered.summary.includes(name), false)
    assert.equal(rendered.title.includes(name), false)
  }
  assert.ok(rendered.text.includes(REDACTION_PLACEHOLDER))
})

test("the summary redacts credential shapes that reached it by another route", () => {
  const token = `ghp_${"A1b2C3d4E5f6G7h8I9j0".repeat(2)}`
  const webhook = `whsec_${"Z9y8X7w6V5u4T3s2R1q0".repeat(2)}`
  const rendered = renderCheckSummary(
    record({
      conclusion: "failure",
      lanes: [
        lane({
          status: "failure",
          testsFailed: 1,
          failures: [
            { title: "auth failed", message: `used ${token} and ${webhook}` },
          ],
        }),
      ],
    }),
    contract
  )
  assert.equal(rendered.text.includes(token), false)
  assert.equal(rendered.text.includes(webhook), false)
  assert.ok(rendered.text.includes(REDACTION_PLACEHOLDER))
})

test("assertPublishable is a proof pass, not a second opinion", () => {
  const name = contract.hostSecrets[0]
  assert.throws(
    () => assertPublishable({ text: `carries ${name}` }, contract),
    (error) =>
      error instanceof SummaryError && error.code === "HOST_SECRET_IN_SUMMARY"
  )
  assert.throws(
    () => assertPublishable({ summary: `sk_live_${"9".repeat(24)}` }, contract),
    (error) => error.code === "CREDENTIAL_IN_SUMMARY"
  )
  assert.deepEqual(assertPublishable({ text: "nothing to hide" }, contract), {
    text: "nothing to hide",
  })
  assert.equal(
    redactSummaryText(`before ${name} after`, contract),
    `before ${REDACTION_PLACEHOLDER} after`
  )
})

test("lanes left to the hosted plane are listed, so a missing row is never a missing fact", () => {
  const rendered = renderCheckSummary(
    record({
      hostedOnlyLanes: [
        { laneId: "zap-full", reason: "lane declares arch x64-only" },
      ],
    }),
    contract
  )
  assert.ok(rendered.text.includes("## Lanes left to the GitHub-hosted plane"))
  assert.ok(
    rendered.text.includes("- `zap-full` — lane declares arch x64-only")
  )
  assert.deepEqual(extractLaneSummary(rendered.text).hostedOnlyLanes, [
    "zap-full",
  ])

  const none = renderCheckSummary(record(), contract)
  assert.equal(
    none.text.includes("## Lanes left to the GitHub-hosted plane"),
    false
  )
})

test("a record with no digest, or a missing count, is refused rather than published", () => {
  assert.throws(
    () => renderCheckSummary(record({ logDigest: undefined }), contract),
    (error) => error.code === "MISSING_LOG_DIGEST"
  )
  assert.throws(
    () =>
      renderCheckSummary(
        record({ lanes: [lane({ testsRun: undefined })] }),
        contract
      ),
    (error) => {
      assert.equal(error.code, "RECORD_SHAPE")
      assert.match(error.message, /a missing count and a zero count/)
      return true
    }
  )
  assert.throws(
    () => renderCheckSummary(record({ headSha: "cafebabe" }), contract),
    (error) => error.code === "RECORD_SHAPE"
  )
  assert.throws(
    () => renderCheckSummary(record({ conclusion: "green" }), contract),
    (error) => error.code === "RECORD_SHAPE"
  )
})

test("formatDuration distinguishes an unrecorded duration from a zero one", () => {
  assert.equal(formatDuration(0), "0s")
  assert.equal(formatDuration(45), "45s")
  assert.equal(formatDuration(723), "12m 03s")
  assert.equal(formatDuration(null), "—")
  assert.equal(formatDuration(-1), "—")
})

test("extractLaneSummary distinguishes an absent block from a corrupt one", () => {
  assert.equal(extractLaneSummary("## Lanes\n\nno block here"), null)
  assert.equal(extractLaneSummary(null), null)
  const corrupt = [
    "## Lane summary (machine-readable)",
    "",
    "```json",
    "{ not json",
    "```",
  ].join("\n")
  assert.equal(extractLaneSummary(corrupt), null)
})
