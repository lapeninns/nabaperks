import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  compareShadowEvidence,
  shadowEquivalenceStreak,
} from "../../ops/local-ci/core/shadow-qualification.mjs"

const CONTRACT = JSON.parse(
  readFileSync(
    new URL("../../config/local-ci-contract.json", import.meta.url),
    "utf8"
  )
)
const HEAD = "a".repeat(40)

function fixture() {
  const contract = structuredClone(CONTRACT)
  const evidence = (plane) => ({
    schema: "nabaperks.lane-result.v1",
    plane,
    profile: "pr",
    headSha: HEAD,
    conclusion: "success",
    lanes: Object.entries(contract.shadowMode.qualification.lanes).map(
      ([laneId, limit]) => ({
        schema: "nabaperks.lane-result.v1",
        plane,
        profile: "pr",
        headSha: HEAD,
        laneId,
        status: "success",
        testsRun: limit.minimumTests,
        testsPassed: limit.minimumTests - limit.maximumSkipped,
        testsFailed: 0,
        testsSkipped: limit.maximumSkipped,
        flaky: 0,
      })
    ),
  })
  return {
    contract,
    headSha: HEAD,
    profile: "pr",
    local: evidence("local"),
    hosted: evidence("hosted"),
    publishedDurationSeconds: 4500,
  }
}

test("matching complete evidence qualifies at the exact duration and skip boundaries", () => {
  const result = compareShadowEvidence(fixture())
  assert.equal(result.verdict, "equivalent")
  assert.equal(result.eligibleForStreak, true)
  assert.equal(result.lanes.length, 10)
})

for (const [name, change] of [
  ["missing lane", (x) => x.hosted.lanes.pop()],
  ["duplicate lane", (x) => x.hosted.lanes.push(x.hosted.lanes[0])],
  [
    "wrong head",
    (x) => {
      x.local.lanes[0].headSha = "b".repeat(40)
    },
  ],
  [
    "wrong profile",
    (x) => {
      x.hosted.profile = "main"
    },
  ],
  [
    "wrong schema",
    (x) => {
      x.hosted.schema = "unknown"
    },
  ],
  [
    "cancelled run",
    (x) => {
      x.local.conclusion = "cancelled"
    },
  ],
  [
    "cancelled lane",
    (x) => {
      x.local.lanes[0].status = "cancelled"
    },
  ],
  [
    "null count",
    (x) => {
      x.hosted.lanes[0].testsRun = null
    },
  ],
  [
    "missing floor",
    (x) => {
      delete x.contract.shadowMode.qualification.lanes.fast.minimumTests
    },
  ],
  [
    "missing ceiling",
    (x) => {
      delete x.contract.shadowMode.qualification.lanes.fast.maximumSkipped
    },
  ],
  [
    "zero test floor",
    (x) => {
      x.contract.shadowMode.qualification.lanes.fast.minimumTests = 0
    },
  ],
  [
    "negative count",
    (x) => {
      x.hosted.lanes[0].testsFailed = -1
    },
  ],
  [
    "inconsistent counts",
    (x) => {
      x.hosted.lanes[0].testsPassed -= 1
    },
  ],
  [
    "missing duration",
    (x) => {
      delete x.publishedDurationSeconds
    },
  ],
]) {
  test(`${name} is incomplete and cannot enter a streak`, () => {
    const input = fixture()
    change(input)
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "incomplete")
    assert.equal(result.eligibleForStreak, false)
    assert.ok(result.reasons.length)
  })
}

test("equal zero-test results cannot pass a real suite's floor", () => {
  const input = fixture()
  for (const record of [input.local, input.hosted]) {
    Object.assign(record.lanes[0], { testsRun: 0, testsPassed: 0 })
  }
  assert.equal(compareShadowEvidence(input).verdict, "divergent")
})

test("equal unexpected skips on both planes still diverge", () => {
  const input = fixture()
  for (const record of [input.local, input.hosted]) {
    record.lanes[0].testsSkipped += 1
    record.lanes[0].testsPassed -= 1
  }
  assert.equal(compareShadowEvidence(input).verdict, "divergent")
})

test("one-test differences and status differences diverge", () => {
  const input = fixture()
  input.hosted.lanes[0].testsRun += 1
  input.hosted.lanes[0].testsPassed += 1
  assert.equal(compareShadowEvidence(input).verdict, "divergent")
  const statusInput = fixture()
  statusInput.hosted.lanes[0].status = "failure"
  assert.equal(compareShadowEvidence(statusInput).verdict, "divergent")
})

test("matching failures are equivalent, as the runbook requires", () => {
  const input = fixture()
  for (const record of [input.local, input.hosted]) {
    record.conclusion = "failure"
    Object.assign(record.lanes[0], { status: "failure", testsFailed: 1 })
    record.lanes[0].testsPassed -= 1
  }
  assert.equal(compareShadowEvidence(input).verdict, "equivalent")
})

test("duration is not compared across planes but exceeding the local budget blocks the streak", () => {
  const input = fixture()
  input.publishedDurationSeconds = 4500.001
  const result = compareShadowEvidence(input)
  assert.equal(result.verdict, "equivalent")
  assert.equal(result.budget.satisfied, false)
  assert.equal(result.eligibleForStreak, false)
})

test("main proof never counts as a PR head", () => {
  const input = fixture()
  input.profile = "main"
  for (const record of [input.local, input.hosted]) {
    record.profile = "main"
    for (const lane of record.lanes) lane.profile = "main"
  }
  assert.equal(compareShadowEvidence(input).eligibleForStreak, false)
})

test("incomplete attempts reset the streak and repeated heads cannot inflate it", () => {
  const good = compareShadowEvidence(fixture())
  const second = { ...good, headSha: "b".repeat(40) }
  const third = { ...good, headSha: "c".repeat(40) }
  assert.equal(
    shadowEquivalenceStreak([good, good, second], 3).satisfied,
    false
  )
  assert.equal(
    shadowEquivalenceStreak([good, second, third], 3).satisfied,
    true
  )
  assert.equal(
    shadowEquivalenceStreak(
      [good, { eligibleForStreak: false }, second, third],
      3
    ).length,
    2
  )
})
