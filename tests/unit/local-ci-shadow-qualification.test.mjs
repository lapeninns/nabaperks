import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  buildLaneResult,
  toSummaryLane,
} from "../../ops/local-ci/agent/runner.mjs"
import {
  extractLaneSummary,
  renderCheckSummary,
} from "../../ops/local-ci/core/summary.mjs"

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
  statusInput.hosted.conclusion = "failure"
  assert.equal(compareShadowEvidence(statusInput).verdict, "divergent")
})

test("matching failure totals alone cannot establish a common cause", () => {
  const input = fixture()
  for (const record of [input.local, input.hosted]) {
    record.conclusion = "failure"
    Object.assign(record.lanes[0], { status: "failure", testsFailed: 1 })
    record.lanes[0].testsPassed -= 1
  }
  assert.equal(compareShadowEvidence(input).verdict, "incomplete")
  assert.equal(compareShadowEvidence(input).eligibleForStreak, false)
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

test("a missing tally survives the actual runner-to-published-summary round trip", () => {
  const input = fixture()
  const raw = buildLaneResult({
    lane: { id: "fast", commands: ["pnpm test:unit"] },
    contract: CONTRACT,
    profile: "pr",
    headSha: HEAD,
    exitCode: 0,
    output: "no tally was printed\n",
  })
  assert.equal(raw.testsRun, null)
  const output = renderCheckSummary(
    {
      profile: "pr",
      headSha: HEAD,
      conclusion: "success",
      logDigest: "b".repeat(64),
      lanes: [toSummaryLane(raw)],
    },
    CONTRACT
  )
  const published = extractLaneSummary(output.text).lanes[0]
  assert.equal(published.countsExpected, true)
  assert.equal(published.countsParsed, false)
  Object.assign(input.local.lanes[0], published)
  const result = compareShadowEvidence(input)
  assert.equal(result.verdict, "incomplete")
  assert.match(result.lanes[0].reasons.join(" "), /missing machine-readable/)
  assert.doesNotMatch(result.lanes[0].reasons.join(" "), /below floor/)
})

test("command lanes do not need a test tally", () => {
  const input = fixture()
  for (const record of [input.local, input.hosted]) {
    Object.assign(record.lanes[1], {
      countsExpected: false,
      countsParsed: false,
    })
  }
  assert.equal(compareShadowEvidence(input).verdict, "equivalent")
})

for (const plane of ["local", "hosted"]) {
  for (const conclusion of ["failure", "timed_out"]) {
    test(`${plane} ${conclusion} envelope cannot describe all successful lanes`, () => {
      const input = fixture()
      input[plane].conclusion = conclusion
      const result = compareShadowEvidence(input)
      assert.equal(result.verdict, "incomplete")
      assert.match(result.reasons.join(" "), /conclusion disagrees/)
    })
  }
}

for (const failedIndex of [0, 3, 8]) {
  test(`executed divergence at lane ${failedIndex} survives downstream runner skips`, () => {
    const input = fixture()
    input.local.conclusion = "failure"
    const failed = input.local.lanes[failedIndex]
    failed.status = "failure"
    failed.testsPassed -= 1
    failed.testsFailed += 1
    for (const lane of input.local.lanes.slice(failedIndex + 1)) {
      Object.assign(lane, {
        status: "skipped",
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        testsSkipped: 0,
        flaky: 0,
        countsParsed: false,
        blockedByLaneId: failed.laneId,
      })
    }
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "divergent")
    assert.equal(result.eligibleForStreak, false)
    assert.equal(result.lanes[failedIndex].verdict, "divergent")
    assert.match(result.lanes[failedIndex].reasons.join(" "), /status mismatch/)
    assert.ok(
      result.lanes.slice(failedIndex + 1).every((lane) => lane.blockedSkip)
    )
    delete input.local.lanes.at(-1).blockedByLaneId
    assert.equal(compareShadowEvidence(input).verdict, "incomplete")
  })
}

test("an infrastructure failure retains status divergence even without a tally", () => {
  const input = fixture()
  input.local.conclusion = "failure"
  Object.assign(input.local.lanes[0], {
    status: "failure",
    testsRun: 0,
    testsPassed: 0,
    countsParsed: false,
  })
  const result = compareShadowEvidence(input)
  assert.equal(result.verdict, "divergent")
  assert.match(result.lanes[0].reasons.join(" "), /status mismatch/)
  assert.doesNotMatch(result.lanes[0].reasons.join(" "), /below floor/)
})
