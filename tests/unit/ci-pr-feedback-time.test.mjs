import assert from "node:assert/strict"
import { test } from "node:test"
import {
  FEEDBACK_THRESHOLD_MINUTES,
  checkWindow,
  collectFeedback,
  renderFeedback,
  summariseFeedback,
} from "../../scripts/ci/pr-feedback-time.mjs"

const check = (name, startedAt, completedAt, extra = {}) => ({
  __typename: "CheckRun",
  workflowName: "CI",
  name,
  status: "COMPLETED",
  conclusion: "SUCCESS",
  startedAt,
  completedAt,
  ...extra,
})

test("the feedback window runs from the first check start to the last check end", () => {
  const window = checkWindow([
    check("Fast lane", "2026-09-12T10:00:30Z", "2026-09-12T10:03:00Z"),
    check("Release gate", "2026-09-12T10:08:00Z", "2026-09-12T10:08:30Z"),
    check(
      "Select required checks",
      "2026-09-12T10:00:00Z",
      "2026-09-12T10:00:30Z"
    ),
    check("CodeQL", "2026-09-12T10:00:10Z", "2026-09-12T10:02:00Z", {
      workflowName: "CodeQL",
    }),
  ])
  assert.deepEqual(window, {
    startedAt: "2026-09-12T10:00:00.000Z",
    completedAt: "2026-09-12T10:08:30.000Z",
    minutes: 8.5,
    firstCheck: "CI / Select required checks",
    lastCheck: "CI / Release gate",
  })
})

test("a re-run's later completion lengthens the window; queued checks fall back to updatedAt", () => {
  // A flaky shard failed on the first attempt and the failed jobs were re-run
  // twelve minutes later: the contributor waited for the re-run, so the
  // window must include it even though every individual job stayed short.
  const rerun = checkWindow([
    check(
      "E2E (desktop-firefox, pack 2)",
      "2026-09-12T12:38:54Z",
      "2026-09-12T12:43:22Z"
    ),
    check(
      "E2E (desktop-firefox, pack 2)",
      "2026-09-12T12:49:33Z",
      "2026-09-12T12:54:30Z"
    ),
    check("Release gate", "2026-09-12T12:54:35Z", "2026-09-12T12:55:15Z"),
  ])
  assert.equal(rerun.minutes.toFixed(2), "16.35")
  assert.equal(rerun.lastCheck, "CI / Release gate")

  // Legacy commit statuses carry `context` rather than `name`, and a check
  // still in flight has no completedAt: its last update stands in, so an
  // unfinished pull request cannot look faster than it is.
  const inFlight = checkWindow([
    {
      __typename: "StatusContext",
      context: "Vercel",
      startedAt: "2026-09-12T10:00:00Z",
    },
    check("E2E (mobile-safari, pack 1)", "2026-09-12T10:00:30Z", null, {
      status: "IN_PROGRESS",
      conclusion: null,
      updatedAt: "2026-09-12T10:06:00Z",
    }),
  ])
  assert.deepEqual(inFlight, {
    startedAt: "2026-09-12T10:00:30.000Z",
    completedAt: "2026-09-12T10:06:00.000Z",
    minutes: 5.5,
    firstCheck: "CI / E2E (mobile-safari, pack 1)",
    lastCheck: "CI / E2E (mobile-safari, pack 1)",
  })

  assert.equal(checkWindow([]), null)
  assert.equal(
    checkWindow([{ __typename: "StatusContext", context: "x" }]),
    null
  )
  assert.throws(() => checkWindow(undefined))
})

test("the sample statistics are the readiness signal's: mean of measured windows against ten minutes", () => {
  const pullRequests = [
    {
      number: 1,
      title: "eight minutes",
      statusCheckRollup: [
        check("a", "2026-09-12T10:00:00Z", "2026-09-12T10:08:00Z"),
      ],
    },
    {
      number: 2,
      title: "re-run",
      statusCheckRollup: [
        check("a", "2026-09-12T11:00:00Z", "2026-09-12T11:18:00Z"),
      ],
    },
    {
      number: 3,
      title: "nine minutes",
      statusCheckRollup: [
        check("a", "2026-09-12T12:00:00Z", "2026-09-12T12:09:00Z"),
      ],
    },
    // Documentation-only: no started check. Listed, never counted as zero.
    { number: 4, title: "docs", statusCheckRollup: [] },
  ]
  const summary = summariseFeedback(pullRequests)
  assert.equal(summary.threshold, FEEDBACK_THRESHOLD_MINUTES)
  assert.equal(FEEDBACK_THRESHOLD_MINUTES, 10)
  assert.equal(summary.sampleSize, 4)
  assert.equal(summary.measured, 3)
  assert.equal(summary.meanMinutes.toFixed(4), (35 / 3).toFixed(4))
  assert.equal(summary.medianMinutes, 9)
  assert.equal(summary.maxMinutes, 18)
  assert.equal(summary.overThreshold, 1)
  assert.equal(summary.withinThreshold, false)
  assert.equal(summary.samples[3].window, null)

  // Without the re-run the same sample clears the bar; this is the whole
  // reason a single flaky shard matters to the signal.
  const fixed = summariseFeedback(pullRequests.filter((pr) => pr.number !== 2))
  assert.equal(fixed.meanMinutes, 8.5)
  assert.equal(fixed.withinThreshold, true)

  const rendered = renderFeedback(summary)
  assert.match(rendered, /^#2 +18\.00m ! re-run  last: CI \/ a$/m)
  assert.match(rendered, /^#4 +n\/a +docs$/m)
  assert.match(rendered, /Merged pull requests: 4 \(3 with checks\)/)
  assert.match(
    rendered,
    /1 at or over 10 minutes; mean is not under the 10-minute bar/
  )

  assert.throws(() => summariseFeedback(pullRequests, { threshold: 0 }))
  assert.throws(() => summariseFeedback([{ title: "no number" }]))
  assert.throws(() => summariseFeedback(null))
})

test("collection asks gh for merged pull requests with their status checks and nothing else", () => {
  const calls = []
  const summary = collectFeedback({
    count: 7,
    read: (args) => {
      calls.push(args)
      return [
        {
          number: 9,
          title: "t",
          mergedAt: "2026-09-12T10:10:00Z",
          statusCheckRollup: [
            check("a", "2026-09-12T10:00:00Z", "2026-09-12T10:04:00Z"),
          ],
        },
      ]
    },
  })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].slice(0, 2), ["pr", "list"])
  assert.ok(calls[0].includes("--state") && calls[0].includes("merged"))
  assert.deepEqual(
    calls[0].slice(
      calls[0].indexOf("--limit"),
      calls[0].indexOf("--limit") + 2
    ),
    ["--limit", "7"]
  )
  assert.equal(calls[0].at(-1), "number,title,mergedAt,statusCheckRollup")
  assert.ok(!calls[0].includes("--method"), "collection is read-only")
  assert.equal(summary.meanMinutes, 4)
  assert.equal(summary.samples[0].mergedAt, "2026-09-12T10:10:00Z")

  for (const count of [0, 51, 2.5, "20"])
    assert.throws(() => collectFeedback({ count, read: () => [] }))
})
