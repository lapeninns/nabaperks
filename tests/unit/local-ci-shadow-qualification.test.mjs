import assert from "node:assert/strict"
import { withCheckoutProof } from "../helpers/checkout-proof.mjs"
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
    provider: {
      repository: "lapeninns/nabaperks",
      headRepository: "lapeninns/nabaperks",
      workflow: ".github/workflows/ci.yml",
      headSha: HEAD,
      event: "pull_request",
      headBranch: "codex/test",
    },
    lanes: Object.entries(contract.shadowMode.qualification.lanes).map(
      ([laneId, limit]) => ({
        schema: "nabaperks.lane-result.v1",
        plane,
        profile: "pr",
        headSha: HEAD,
        laneId,
        status: "success",
        // Synthetic supervisor evidence; historical counts alone do not qualify.
        executionStarted: true,
        executionVerified: true,
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
    hosted: withCheckoutProof(evidence("hosted")),
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
  input.hosted.provider.event = "push"
  input.hosted.provider.headBranch = "main"
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
  const unverified = compareShadowEvidence(input)
  assert.equal(unverified.verdict, "incomplete")
  assert.match(unverified.reasons.join(" "), /Unverified local validation/)
  // Isolate tally admission with hypothetical supervisor evidence. The actual
  // runner publication above supplies none and cannot reach qualification.
  Object.assign(input.local.lanes[0], {
    executionStarted: true,
    executionVerified: true,
  })
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
        executionStarted: false,
        executionVerified: false,
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

/**
 * The complete, successful main-profile run this contract's floors and ceilings
 * were refreshed from: ~/.nabaperks-local-ci/runs/<sha>/main-20260908T234905Z-
 * dec709/lane-result.json, conclusion success, 947s. Pinning the real counts
 * here keeps the contract falsifiable against evidence rather than against
 * itself.
 */
const OBSERVED_HEAD = "d5f5c36417efd114117ca75eb5e7866b9a7ac06d"
const OBSERVED_RUN = {
  durationSeconds: 947,
  lanes: {
    fast: { testsRun: 2351, testsSkipped: 0 },
    quality: { testsRun: 0, testsSkipped: 0 },
    "print-kit": { testsRun: 0, testsSkipped: 0 },
    "e2e-chromium": { testsRun: 245, testsSkipped: 26 },
    "e2e-mobile-safari": { testsRun: 288, testsSkipped: 43 },
    "e2e-desktop-firefox": { testsRun: 242, testsSkipped: 42 },
    "e2e-desktop-safari": { testsRun: 242, testsSkipped: 42 },
    "a11y-chromium": { testsRun: 71, testsSkipped: 1 },
    "a11y-mobile-safari": { testsRun: 74, testsSkipped: 2 },
    db: { testsRun: 576, testsSkipped: 0 },
  },
}

function observedFixture(profile = "pr") {
  const contract = structuredClone(CONTRACT)
  const evidence = (plane) => ({
    schema: "nabaperks.lane-result.v1",
    plane,
    profile,
    headSha: OBSERVED_HEAD,
    conclusion: "success",
    provider: {
      repository: "lapeninns/nabaperks",
      headRepository: "lapeninns/nabaperks",
      workflow: ".github/workflows/ci.yml",
      headSha: OBSERVED_HEAD,
      event: profile === "pr" ? "pull_request" : "push",
      headBranch: profile === "pr" ? "codex/test" : "main",
    },
    lanes: Object.entries(OBSERVED_RUN.lanes).map(
      ([laneId, { testsRun, testsSkipped }]) => ({
        schema: "nabaperks.lane-result.v1",
        plane,
        profile,
        headSha: OBSERVED_HEAD,
        laneId,
        status: "success",
        // Synthetic supervisor evidence; historical counts alone do not qualify.
        executionStarted: true,
        executionVerified: true,
        testsRun,
        testsPassed: testsRun - testsSkipped,
        testsFailed: 0,
        testsSkipped,
        flaky: 0,
        countsParsed: testsRun > 0,
        countsExpected: testsRun > 0,
      })
    ),
  })
  return {
    contract,
    headSha: OBSERVED_HEAD,
    profile,
    local: evidence("local"),
    hosted: withCheckoutProof(evidence("hosted")),
    publishedDurationSeconds: OBSERVED_RUN.durationSeconds,
  }
}

test("observed main counts satisfy floors with separate synthetic execution and checkout proof", () => {
  const result = compareShadowEvidence(observedFixture("main"))
  assert.deepEqual(result.reasons, [])
  assert.equal(result.verdict, "equivalent")
  assert.equal(result.budget.satisfied, true)
})

test("observed counts on a PR head qualify only with separate synthetic execution proof", () => {
  const result = compareShadowEvidence(observedFixture())
  assert.equal(result.verdict, "equivalent")
  assert.equal(result.eligibleForStreak, true)
})

function reasonsFor(result, laneId) {
  return result.lanes.find((lane) => lane.laneId === laneId)?.reasons ?? []
}

for (const laneId of Object.keys(OBSERVED_RUN.lanes)) {
  const observed = OBSERVED_RUN.lanes[laneId]
  if (observed.testsRun === 0) continue
  test(`one test fewer than the ${laneId} floor still diverges`, () => {
    const input = observedFixture()
    for (const record of [input.local, input.hosted]) {
      const lane = record.lanes.find((entry) => entry.laneId === laneId)
      lane.testsRun -= 1
      lane.testsPassed -= 1
    }
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "divergent")
    // Assert on the lane's own reasons: a joined-string match would accept an
    // identical complaint raised against a different lane.
    assert.deepEqual(reasonsFor(result, laneId), [
      "local below floor",
      "hosted below floor",
    ])
    assert.equal(result.eligibleForStreak, false)
  })
  test(`one skip more than the ${laneId} ceiling still diverges`, () => {
    const input = observedFixture()
    for (const record of [input.local, input.hosted]) {
      const lane = record.lanes.find((entry) => entry.laneId === laneId)
      lane.testsSkipped += 1
      lane.testsPassed -= 1
    }
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "divergent")
    assert.deepEqual(reasonsFor(result, laneId), [
      "local exceeds skip ceiling",
      "hosted exceeds skip ceiling",
    ])
    assert.equal(result.eligibleForStreak, false)
  })
}

test("streakProfiles, not the compared profiles, decides what feeds the streak", () => {
  const qualification = CONTRACT.shadowMode.qualification
  assert.deepEqual(qualification.streakProfiles, ["pr"])
  assert.ok(qualification.profiles.includes("main"))
  const main = compareShadowEvidence(observedFixture("main"))
  assert.equal(main.verdict, "equivalent")
  assert.equal(main.eligibleForStreak, false)
  assert.equal(
    shadowEquivalenceStreak(
      [
        { ...main, headSha: "a".repeat(40), eligibleForStreak: true },
        { ...main, headSha: "b".repeat(40), eligibleForStreak: true },
        { ...main, headSha: "c".repeat(40), eligibleForStreak: true },
      ],
      3,
      CONTRACT
    ).length,
    0,
    "a forged eligibility flag cannot smuggle a main proof into the streak"
  )
})

test("configuration cannot widen the streak beyond the code-owned policy", () => {
  const input = observedFixture("main")
  input.contract.shadowMode.qualification.streakProfiles = ["pr", "main"]
  const result = compareShadowEvidence(input)
  assert.equal(
    result.verdict,
    "incomplete",
    "admitting main to the streak is a policy change that must be reviewed as code"
  )
  assert.match(result.reasons.join(" "), /may only narrow/)
  assert.equal(result.eligibleForStreak, false)
  assert.throws(
    () => shadowEquivalenceStreak([result], 1, input.contract),
    /may only narrow/,
    "a contract edit alone must never satisfy the cutover streak"
  )
})

test("configuration may still narrow the streak", () => {
  const input = observedFixture()
  input.contract.shadowMode.qualification.streakProfiles = ["pr"]
  const result = compareShadowEvidence(input)
  assert.equal(result.verdict, "equivalent")
  assert.equal(result.eligibleForStreak, true)
})

test("streakProfiles cannot name a profile that is never compared", () => {
  const input = observedFixture()
  input.contract.shadowMode.qualification.streakProfiles = ["pr", "nightly"]
  const result = compareShadowEvidence(input)
  assert.equal(result.verdict, "incomplete")
  assert.match(result.reasons.join(" "), /streakProfiles/)
})

test("stored evidence cannot relabel main pushes or fork runs as eligible PR proof", () => {
  for (const change of [
    (p) => {
      p.event = "push"
    },
    (p) => {
      p.repository = "someone/fork"
    },
    (p) => {
      p.headRepository = "someone/fork"
    },
    (p) => {
      p.headSha = "b".repeat(40)
    },
  ]) {
    const input = fixture()
    change(input.hosted.provider)
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "incomplete")
    assert.equal(result.eligibleForStreak, false)
  }
})

test("saved comparison uses the evidence SHA's limits and the verifier's App identity", async () => {
  const { compareSavedEvidence } =
    await import("../../ops/local-ci/compare-shadow.mjs")
  const input = fixture()
  const candidate = structuredClone(input.contract)
  candidate.shadowMode.qualification.lanes.fast.minimumTests += 1
  candidate.githubApp.appId = 999999
  const check = {
    status: "completed",
    head_sha: HEAD,
    conclusion: "success",
    app: { id: CONTRACT.githubApp.appId },
    name: CONTRACT.checkName,
    started_at: "2026-09-10T00:00:00Z",
    completed_at: "2026-09-10T00:10:00Z",
    output: {
      text: renderCheckSummary(
        { ...input.local, logDigest: "f".repeat(64) },
        CONTRACT
      ).text,
    },
  }
  const reads = []
  const deps = {
    readAtShaImpl: async (request) => {
      reads.push(request)
      return JSON.stringify(candidate)
    },
    readJsonImpl: async (path) =>
      path instanceof URL ? CONTRACT : path === "local" ? check : input.hosted,
  }
  const options = {
    sha: HEAD,
    profile: "pr",
    localCheckPath: "local",
    hostedEvidencePath: "hosted",
  }
  const result = await compareSavedEvidence(options, deps)
  assert.deepEqual(reads, [
    { sha: HEAD, path: "config/local-ci-contract.json" },
  ])
  assert.equal(result.verdict, "divergent")
  assert.match(result.reasons.join(" "), /below floor/)
  check.app.id = candidate.githubApp.appId
  await assert.rejects(compareSavedEvidence(options, deps), /pinned App/)
})

test("matching counts cannot qualify a different synthetic merge tree or missing checkout proof", () => {
  for (const change of [
    (x) => {
      x.hosted.provider.checkoutProof.checkouts[0].treeSha = "d".repeat(40)
    },
    (x) => {
      delete x.hosted.provider.checkoutProof
    },
  ]) {
    const input = fixture()
    change(input)
    const result = compareShadowEvidence(input)
    assert.equal(result.verdict, "incomplete")
    assert.equal(result.eligibleForStreak, false)
    assert.match(result.reasons.join(" "), /checkout|tree/)
  }
})

for (const field of ["executionStarted", "executionVerified"]) {
  for (const value of [undefined, null, false, "true"]) {
    test(`qualification rejects ${field}=${String(value)} even with matching counts and checkout trees`, () => {
      for (const laneIndex of [0, 1]) {
        const input = fixture()
        input.local.lanes[laneIndex][field] = value
        input.local.rootCoverage = {
          complete: true,
          coveredRoots: ["fast", "quality", "e2e", "a11y", "db"],
        }
        const result = compareShadowEvidence(input)
        assert.equal(result.verdict, "incomplete")
        assert.equal(result.eligibleForStreak, false)
        assert.match(
          result.reasons.join(" "),
          /Unverified local validation execution/
        )
      }
    })
  }
}

test("three distinct unverified heads cannot satisfy the qualification streak", () => {
  const results = ["a", "b", "c"].map((letter) => {
    const input = fixture()
    input.headSha = letter.repeat(40)
    for (const evidence of [input.local, input.hosted]) {
      evidence.headSha = input.headSha
      evidence.provider.headSha = input.headSha
      for (const lane of evidence.lanes) lane.headSha = input.headSha
    }
    withCheckoutProof(input.hosted)
    for (const lane of input.local.lanes) {
      lane.executionStarted = null
      delete lane.executionVerified
    }
    return compareShadowEvidence(input)
  })
  assert.ok(
    results.every(
      (result) => result.verdict === "incomplete" && !result.eligibleForStreak
    )
  )
  assert.equal(shadowEquivalenceStreak(results, 3).satisfied, false)
  assert.equal(shadowEquivalenceStreak(results, 3).length, 0)
})

test("saved comparison reports without verified execution cannot replay into a streak", () => {
  const verified = compareShadowEvidence(fixture())
  assert.equal(verified.localExecutionVerified, true)
  for (const value of [undefined, null, false, "true"]) {
    const reports = ["a", "b", "c"].map((letter) => ({
      ...verified,
      headSha: letter.repeat(40),
      localExecutionVerified: value,
    }))
    assert.equal(shadowEquivalenceStreak(reports, 3).length, 0)
    assert.equal(shadowEquivalenceStreak(reports, 3).satisfied, false)
  }
})
