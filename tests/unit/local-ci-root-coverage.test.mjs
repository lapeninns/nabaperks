import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { logDigest } from "../../ops/local-ci/core/digest.mjs"
import {
  ROOTLESS_LANES,
  computeRootCoverage,
  rootForLane,
} from "../../ops/local-ci/core/root-coverage.mjs"
import { FULL_HOSTED_ROOTS } from "../../ops/local-ci/core/routing.mjs"
import {
  extractLaneSummary,
  renderCheckSummary,
} from "../../ops/local-ci/core/summary.mjs"

/**
 * local CI — what the local plane's lanes actually cover.
 *
 * The published check says `10/10 lanes` and means ten of its own lanes, not
 * ten of anything the merge gate requires. Four required roots have no local
 * lane at all, so the run that reports ten of ten covers five of nine, and the
 * difference has to be readable in the evidence rather than inferable from a
 * workflow file. These tests read the real profiles, so they track what the
 * plane runs rather than a fixture of what it once ran.
 */

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  fileURLToPath(new URL("../../config/local-ci-contract.json", import.meta.url))
)

const laneIdsOf = (profileName) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../ops/local-ci/profiles/${profileName}.json`,
          import.meta.url
        )
      ),
      "utf8"
    )
  ).lanes.map((lane) => lane.id)

test("the pr and main profiles leave four required roots to the hosted plane", () => {
  for (const profileName of ["pr", "main"]) {
    const coverage = computeRootCoverage(laneIdsOf(profileName))

    assert.deepEqual(
      [...coverage.uncoveredRoots],
      ["build", "visual", "lighthouse", "zap-baseline"],
      `${profileName} must name every required root it does not run`
    )
    assert.deepEqual(
      [...coverage.coveredRoots],
      ["fast", "quality", "e2e", "a11y", "db"]
    )
    assert.equal(coverage.complete, false)
    assert.equal(coverage.requiredRoots.length, FULL_HOSTED_ROOTS.length)
  }
})

test("print-kit is reported as covering no required root, not quietly counted", () => {
  const coverage = computeRootCoverage(laneIdsOf("pr"))

  const printKit = coverage.unmappedLanes.find(
    (entry) => entry.laneId === "print-kit"
  )
  assert.ok(printKit, "print-kit must appear in the unmapped lanes")
  assert.equal(printKit.kind, "local-only")
  assert.equal(printKit.reason, ROOTLESS_LANES["print-kit"])
  assert.equal(rootForLane("print-kit").root, null)

  // It is still accounted for: the mapping is total, so the lane has a row
  // whose root is null rather than no row at all.
  assert.equal(coverage.laneRoots.length, laneIdsOf("pr").length)
  assert.deepEqual(
    coverage.laneRoots.find((entry) => entry.laneId === "print-kit"),
    { laneId: "print-kit", root: null }
  )
})

test("the nightly-only lanes never stand in for a required root", () => {
  const coverage = computeRootCoverage(laneIdsOf("nightly"))

  // zap-full is the one that would flatter the numbers most: it is a ZAP scan
  // and zap-baseline is a required root, but it is the longer nightly scan and
  // running it is not running the gate's.
  assert.ok(coverage.uncoveredRoots.includes("zap-baseline"))
  assert.deepEqual(
    coverage.unmappedLanes.map((entry) => entry.laneId),
    ["print-kit", "mutation", "load", "db-stress", "zap-full"]
  )
  for (const entry of coverage.unmappedLanes) {
    assert.equal(entry.kind, "local-only")
  }
})

test("a profile covering all nine required roots reports nothing uncovered", () => {
  const coverage = computeRootCoverage([
    "fast",
    "quality",
    "build",
    "e2e-chromium",
    "e2e-desktop-firefox",
    "a11y-chromium",
    "visual",
    "lighthouse",
    "zap-baseline",
    "db",
  ])

  assert.deepEqual([...coverage.uncoveredRoots], [])
  assert.deepEqual([...coverage.coveredRoots], [...FULL_HOSTED_ROOTS])
  assert.equal(coverage.complete, true)
  assert.deepEqual([...coverage.unmappedLanes], [])
})

test("a lane id no rule accounts for is reported, never ignored", () => {
  const coverage = computeRootCoverage(["fast", "e2e-webkit-next", "sparkle"])

  // A prefix rule is a rule: a new browser project joins the e2e root without
  // anyone editing this module.
  assert.equal(rootForLane("e2e-webkit-next").root, "e2e")

  const unknown = coverage.unmappedLanes.find(
    (entry) => entry.laneId === "sparkle"
  )
  assert.ok(unknown, "an unrecognised lane must reach the published evidence")
  assert.equal(unknown.kind, "unknown")
  assert.equal(rootForLane("sparkle").known, false)
  assert.equal(
    coverage.coveredRoots.includes("fast"),
    true,
    "and the lanes around it still count"
  )
})

test("a root outside the required list is reported rather than counted as coverage", () => {
  const coverage = computeRootCoverage(
    ["fast", "lighthouse"],
    ["fast", "build"]
  )

  assert.deepEqual([...coverage.coveredRoots], ["fast"])
  assert.deepEqual([...coverage.uncoveredRoots], ["build"])
  assert.deepEqual(
    [...coverage.unmappedLanes],
    [
      {
        laneId: "lighthouse",
        kind: "not-required",
        reason:
          "covers lighthouse, which this run's required-root list does not name",
      },
    ]
  )
})

test("the published check states its coverage instead of leaving 10/10 to imply it", () => {
  const laneIds = laneIdsOf("pr")
  const rendered = renderCheckSummary(
    {
      profile: "pr",
      headSha: "c".repeat(40),
      conclusion: "success",
      logDigest: logDigest("lane output"),
      lanes: laneIds.map((laneId) => ({
        laneId,
        status: "success",
        testsRun: 10,
        testsPassed: 10,
        testsFailed: 0,
        testsSkipped: 0,
      })),
    },
    contract
  )

  // The lane count survives - it is true of the lanes that ran - but it no
  // longer stands alone as the run's only headline number.
  assert.ok(
    rendered.title.includes(`${laneIds.length}/${laneIds.length} lanes`)
  )
  assert.ok(
    rendered.title.includes("5/9 required roots local"),
    `the title must state root coverage (was ${JSON.stringify(rendered.title)})`
  )
  assert.match(rendered.summary, /Required roots:\s*5 of 9/)

  assert.ok(rendered.text.includes("## Required-root coverage"))
  for (const root of ["build", "visual", "lighthouse", "zap-baseline"]) {
    assert.ok(
      rendered.text.includes(`\`${root}\``),
      `${root} must be named as not run locally`
    )
  }
  assert.ok(rendered.text.includes("`print-kit` covers no required root"))

  const parsed = extractLaneSummary(rendered.text)
  assert.deepEqual(parsed.rootCoverage.uncoveredRoots, [
    "build",
    "visual",
    "lighthouse",
    "zap-baseline",
  ])
  assert.deepEqual(parsed.rootCoverage.coveredRoots, [
    "fast",
    "quality",
    "e2e",
    "a11y",
    "db",
  ])
  assert.deepEqual(parsed.rootCoverage.unmappedLanes, [
    { laneId: "print-kit", kind: "local-only" },
  ])

  // Additive only: the fields compare-shadow.mjs and extractLaneSummary
  // already read are untouched.
  assert.equal(parsed.schema, contract.evidence.resultSchema)
  assert.equal(parsed.conclusion, "success")
  assert.equal(parsed.lanes.length, laneIds.length)
  assert.deepEqual(parsed.hostedOnlyLanes, [])
})
