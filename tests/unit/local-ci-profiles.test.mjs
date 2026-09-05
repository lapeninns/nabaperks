import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  ProfileError,
  X64_ONLY,
  knownLocalGaps,
  laneById,
  loadProfile,
  selectLanes,
  snapshotGuardViolations,
  validateProfile,
} from "../../ops/local-ci/core/profiles.mjs"

/**
 * local CI — profile validation and architecture routing.
 *
 * The routing rule matters as much as the validation: a lane this machine
 * cannot run is never dropped, it is returned in `hostedOnly` with a reason. A
 * silently missing lane and a passing run look identical from the outside, and
 * that is the failure mode this plane must not have. The same rule governs the
 * one spec the local a11y lanes provably do not run — it is declared as a
 * machine-readable gap rather than left for someone to discover.
 */

const repoFile = (relative) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url))

const readRepoFile = (relative) => readFileSync(repoFile(relative), "utf8")

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  repoFile("config/local-ci-contract.json")
)

const PROFILE_NAMES = ["pr", "main", "nightly"]

const profiles = new Map(
  PROFILE_NAMES.map((name) => [
    name,
    loadProfile(name, contract, (path) => readRepoFile(path)),
  ])
)

test("every profile the contract names loads and validates against it", () => {
  for (const name of PROFILE_NAMES) {
    const profile = profiles.get(name)
    assert.equal(profile.profile, name)
    assert.equal(profile.schema, contract.profileSchema)
    assert.ok(profile.lanes.length > 0)
    assert.ok(Object.isFrozen(profile))
  }
  assert.deepEqual(
    profiles.get("pr").lanes.map((lane) => lane.id),
    profiles.get("main").lanes.map((lane) => lane.id),
    "pr and main run the same lanes; only the nightly profile adds to them"
  )
})

test("profile selection: an x64-only lane is excluded from local and reported as hostedOnly", () => {
  const nightly = profiles.get("nightly")
  const x64Only = nightly.lanes.filter((lane) => lane.arch === X64_ONLY)
  assert.ok(
    x64Only.length > 0,
    "the nightly profile pins at least one lane to x64"
  )

  const routed = selectLanes(nightly, { arch: "arm64" })
  const localIds = routed.local.map((lane) => lane.id)
  const hostedIds = routed.hostedOnly.map((lane) => lane.id)

  for (const lane of x64Only) {
    assert.ok(!localIds.includes(lane.id), `${lane.id} must not run locally`)
    assert.ok(hostedIds.includes(lane.id), `${lane.id} must be reported hosted`)
    assert.match(routed.reasons[lane.id], /x64-only/)
    assert.match(routed.reasons[lane.id], /GitHub-hosted/)
  }

  // The partition is exact: nothing is dropped on the way through.
  assert.equal(
    routed.local.length + routed.hostedOnly.length,
    nightly.lanes.length
  )
  assert.deepEqual(
    [...localIds, ...hostedIds].sort(),
    nightly.lanes.map((lane) => lane.id).sort()
  )
})

test("profile selection: the same x64-only lane runs locally on x64 hardware", () => {
  const nightly = profiles.get("nightly")
  const routed = selectLanes(nightly, { arch: "x64" })
  assert.deepEqual(routed.hostedOnly, [])
  assert.equal(routed.local.length, nightly.lanes.length)
  assert.deepEqual(routed.reasons, {})
})

test("profile selection: the pr and main profiles have no hosted-only lanes on either architecture", () => {
  for (const name of ["pr", "main"]) {
    for (const arch of ["arm64", "x64"]) {
      const routed = selectLanes(profiles.get(name), { arch })
      assert.deepEqual(
        routed.hostedOnly.map((lane) => lane.id),
        [],
        `${name} on ${arch}`
      )
    }
  }
})

test("profile selection refuses an unknown host architecture rather than guessing", () => {
  assert.throws(
    () => selectLanes(profiles.get("pr"), { arch: "aarch64" }),
    (error) =>
      error instanceof ProfileError && error.code === "UNKNOWN_HOST_ARCH"
  )
  assert.throws(
    () => selectLanes(profiles.get("pr"), {}),
    (error) => error.code === "UNKNOWN_HOST_ARCH"
  )
})

test("the snapshot guard holds for every profile, in both directions", () => {
  for (const name of PROFILE_NAMES) {
    const profile = profiles.get(name)
    assert.deepEqual(
      snapshotGuardViolations(profile, contract),
      [],
      `${name} must carry both snapshot flags on every Playwright invocation`
    )
    for (const lane of profile.lanes) {
      for (const command of lane.commands) {
        if (!/playwright|test:e2e|test:a11y/.test(command)) continue
        assert.match(command, /--grep-invert @visual/)
        assert.match(command, /--ignore-snapshots/)
      }
    }
  }
})

test("a lane carrying a forbidden snapshot substring is refused at load", () => {
  const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
  raw.lanes[0].commands = ["pnpm test:visual"]
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "SNAPSHOT_GUARD_VIOLATION"
  )
})

test("the local a11y lanes declare the one spec they provably do not run", () => {
  const SPEC = "tests/e2e/customer-join-direct-live-db.spec.ts"

  for (const name of PROFILE_NAMES) {
    const profile = profiles.get(name)
    const gaps = knownLocalGaps(profile)
    assert.ok(
      gaps.length > 0,
      `${name} must declare the a11y coverage gap in machine-readable form`
    )

    const gap = gaps.find((entry) => entry.spec === SPEC)
    assert.ok(gap, `${name} must name ${SPEC} as a known local gap`)

    // Documented, not merely present: every gap says what dropped it, why,
    // and where the spec still runs.
    for (const entry of gaps) {
      assert.equal(typeof entry.laneId, "string")
      assert.ok(entry.reason.length > 40, "a gap reason has to be a reason")
      assert.equal(entry.droppedBy, "--grep-invert @visual")
      assert.ok(Array.isArray(entry.hostedCoverage))
      assert.ok(entry.hostedCoverage.length > 0)
      assert.equal(entry.coverageLostOverall, false)
      for (const covered of entry.hostedCoverage) {
        assert.match(covered, /\.github\/workflows\/ci\.yml/)
      }
    }

    // Every a11y lane carries the flag that drops the spec, so every a11y
    // lane has to declare the gap - not just the first one someone noticed.
    const a11yLanes = profile.lanes.filter((lane) =>
      lane.commands.some((command) => command.includes("test:a11y"))
    )
    assert.ok(a11yLanes.length >= 2)
    for (const lane of a11yLanes) {
      assert.ok(
        (lane.knownLocalGaps ?? []).some((entry) => entry.spec === SPEC),
        `${name}/${lane.id} drops ${SPEC} and must say so`
      )
    }
  }
})

test("the declared a11y gap describes the repository as it actually is", () => {
  const SPEC = "tests/e2e/customer-join-direct-live-db.spec.ts"
  const source = readRepoFile(SPEC)

  // The gap exists because the describe block claims @visual while making no
  // screenshot comparison. If either half of that stops being true, the gap
  // record is stale and this test says so rather than the operator finding out
  // from a missing result.
  assert.match(source, /@a11y/)
  assert.match(source, /@visual/)
  assert.equal(
    source.includes("toHaveScreenshot"),
    false,
    "the spec makes no pixel comparison, which is why the gap is bounded"
  )

  const gap = knownLocalGaps(profiles.get("pr")).find(
    (entry) => entry.spec === SPEC
  )
  for (const tag of gap.describeTags ?? []) {
    assert.ok(
      source.includes(tag),
      `the gap record claims the describe block is tagged ${tag}`
    )
  }
})

test("a gap that claims no other plane covers it is refused", () => {
  const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
  const lane = raw.lanes.find((entry) => entry.id === "a11y-chromium")

  lane.knownLocalGaps[0].coverageLostOverall = true
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "UNCOVERED_LOCAL_GAP"
  )

  lane.knownLocalGaps[0].coverageLostOverall = false
  lane.knownLocalGaps[0].hostedCoverage = []
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "UNCOVERED_LOCAL_GAP"
  )

  lane.knownLocalGaps[0].hostedCoverage = [".github/workflows/ci.yml job a11y"]
  delete lane.knownLocalGaps[0].reason
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "PROFILE_SHAPE"
  )
})

test("laneById names the lanes a profile does have rather than returning undefined", () => {
  const profile = profiles.get("pr")
  assert.equal(laneById(profile, "fast").id, "fast")
  assert.throws(
    () => laneById(profile, "zap-full"),
    (error) => {
      assert.equal(error.code, "UNKNOWN_LANE")
      assert.match(error.message, /fast/)
      return true
    }
  )
})

test("loadProfile refuses a document whose own name is not the one it was loaded as", () => {
  const pr = readRepoFile("ops/local-ci/profiles/pr.json")
  assert.throws(
    () => loadProfile("main", contract, () => pr),
    (error) => error.code === "PROFILE_NAME_MISMATCH"
  )
  assert.throws(
    () => loadProfile("pr", contract, () => "{"),
    (error) => error.code === "PROFILE_UNPARSEABLE"
  )
  assert.throws(
    () => loadProfile("does-not-exist", contract, () => pr),
    (error) => error.code === "UNKNOWN_PROFILE"
  )
})

test("a lane with no commands is refused, because it would report success and prove nothing", () => {
  const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
  raw.lanes[0].commands = []
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "EMPTY_LANE_COMMANDS"
  )
})

test("validateProfile does not mutate the document it was handed", () => {
  const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
  const validated = validateProfile(raw, contract, "pr")
  assert.ok(Object.isFrozen(validated))
  assert.equal(Object.isFrozen(raw), false)
  assert.notEqual(validated, raw)
})
