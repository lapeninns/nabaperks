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

test("every shipped lane starts coverage at validation, after its setup", () => {
  for (const profile of profiles.values()) {
    for (const lane of profile.lanes) {
      const workload = lane.commands[lane.workloadCommand - 1]
      assert.equal(typeof workload, "string", `${profile.profile}/${lane.id}`)
      assert.doesNotMatch(
        workload,
        /pnpm install|supabase start|pnpm db:seed|pnpm db:reseed/
      )
      if (lane.id === "db") assert.equal(workload, "pnpm test:db")
      if (lane.id === "db-stress") assert.equal(workload, "pnpm perf:stress")
      if (lane.id === "load") assert.match(workload, /^k6 run /)
      if (lane.id === "zap-full") assert.match(workload, /zap-full-scan\.py/)
      assert.ok(
        lane.commands
          .slice(0, lane.workloadCommand - 1)
          .includes("pnpm install --frozen-lockfile")
      )
    }
  }
})

test("invalid workload boundaries are refused before a profile can run", () => {
  for (const boundary of [0, -1, 1.5, "2", null, 999]) {
    const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
    raw.lanes[0].workloadCommand = boundary
    assert.throws(
      () => validateProfile(raw, contract, "pr"),
      (error) => error.code === "INVALID_WORKLOAD_COMMAND"
    )
  }
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
  raw.lanes[0].workloadCommand = 1
  assert.throws(
    () => validateProfile(raw, contract, "pr"),
    (error) => error.code === "SNAPSHOT_GUARD_VIOLATION"
  )
})

test("current profiles have no known local selection gaps", () => {
  for (const name of PROFILE_NAMES) {
    assert.deepEqual(knownLocalGaps(profiles.get(name)), [])
  }
})

test("a gap that claims no other plane covers it is refused", () => {
  const raw = JSON.parse(readRepoFile("ops/local-ci/profiles/pr.json"))
  const lane = raw.lanes.find((entry) => entry.id === "a11y-chromium")

  lane.knownLocalGaps = [
    {
      spec: "tests/e2e/fixture.spec.ts",
      reason: "A fixture-only exclusion with explicit hosted coverage.",
      droppedBy: "--grep-invert @visual",
      hostedCoverage: [".github/workflows/ci.yml job a11y"],
      coverageLostOverall: false,
    },
  ]
  assert.equal(knownLocalGaps(validateProfile(raw, contract, "pr")).length, 1)

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

/* -------------------------------------- requirements and split browser lanes */

const mutableProfile = (name) =>
  JSON.parse(readRepoFile(`ops/local-ci/profiles/${name}.json`))

test("profile selection: on Docker Desktop the daemon lanes are hosted-only, with a reason", () => {
  const requirements = contract.runtime.hostedOnlyRequirements
  assert.deepEqual(requirements, ["privileged-daemon"])
  for (const [name, expected] of [
    ["pr", ["db"]],
    ["main", ["db"]],
    ["nightly", ["db", "db-stress", "zap-full"]],
  ]) {
    const profile = profiles.get(name)
    const routed = selectLanes(profile, {
      arch: "arm64",
      hostedOnlyRequirements: requirements,
    })
    assert.deepEqual(
      routed.hostedOnly.map((lane) => lane.id),
      expected,
      name
    )
    for (const id of expected.filter((lane) => lane !== "zap-full"))
      assert.match(routed.reasons[id], /privileged-daemon.*GitHub-hosted plane/)
    assert.equal(
      routed.local.length + routed.hostedOnly.length,
      profile.lanes.length
    )
    // Lima provides the capability: the same lanes stay local there.
    assert.equal(
      selectLanes(profile, { arch: "arm64" }).hostedOnly.some(
        (lane) => lane.id === "db"
      ),
      false
    )
  }
  assert.throws(
    () =>
      selectLanes(profiles.get("pr"), {
        arch: "arm64",
        hostedOnlyRequirements: "privileged-daemon",
      }),
    { code: "PROFILE_SHAPE" }
  )
})

test("a lane that needs a daemon must declare it, and only known requirements exist", () => {
  const undeclared = mutableProfile("pr")
  delete undeclared.lanes.find((lane) => lane.id === "db").requires
  assert.throws(() => validateProfile(undeclared, contract, "pr"), {
    code: "UNDECLARED_REQUIREMENT",
  })
  const unknown = mutableProfile("pr")
  unknown.lanes[0].requires = ["gpu"]
  assert.throws(() => validateProfile(unknown, contract, "pr"), {
    code: "UNKNOWN_LANE_REQUIREMENT",
  })
})

test("each e2e project runs as an odd and an even lane that together cover all 32 shards", () => {
  for (const name of PROFILE_NAMES) {
    const lanes = profiles.get(name).lanes
    for (const project of [
      "chromium",
      "mobile-safari",
      "desktop-firefox",
      "desktop-safari",
    ]) {
      const halves = ["odd", "even"].map((half) =>
        lanes.find((lane) => lane.id === `e2e-${project}-${half}`)
      )
      assert.ok(halves.every(Boolean), `${name} ${project}`)
      const shards = halves.map((lane) =>
        lane.commands
          .map((command) => /--shard="(\d+)\/32"/.exec(command)?.[1])
          .filter(Boolean)
          .map(Number)
      )
      assert.deepEqual(
        shards[0],
        Array.from({ length: 16 }, (_, i) => i * 2 + 1)
      )
      assert.deepEqual(
        shards[1],
        Array.from({ length: 16 }, (_, i) => i * 2 + 2)
      )
      for (const lane of halves) {
        assert.equal(lane.project, project)
        assert.equal(lane.env.PLAYWRIGHT_WORKERS, "1")
        assert.equal(lane.env.PLAYWRIGHT_NEXT_DIST_DIR, `.next-e2e-${lane.id}`)
      }
    }
  }
})

test("a split lane that runs the wrong project, the wrong half or drops a shard is refused", () => {
  const wrongProject = mutableProfile("pr")
  const even = wrongProject.lanes.find(
    (lane) => lane.id === "e2e-chromium-even"
  )
  even.commands[1] = even.commands[1].replace('"chromium"', '"mobile-safari"')
  assert.throws(() => validateProfile(wrongProject, contract, "pr"), {
    code: "SPLIT_LANE_PROJECT",
  })

  const wrongHalf = mutableProfile("pr")
  const odd = wrongHalf.lanes.find((lane) => lane.id === "e2e-chromium-odd")
  odd.commands[1] = odd.commands[1].replace('"1/32"', '"2/32"')
  assert.throws(() => validateProfile(wrongHalf, contract, "pr"), {
    code: "SPLIT_LANE_SHARD",
  })

  const dropped = mutableProfile("pr")
  dropped.lanes
    .find((lane) => lane.id === "e2e-desktop-safari-even")
    .commands.pop()
  assert.throws(() => validateProfile(dropped, contract, "pr"), {
    code: "SHARD_COVERAGE",
  })

  const resized = mutableProfile("pr")
  const firefox = resized.lanes.find(
    (lane) => lane.id === "e2e-desktop-firefox-odd"
  )
  firefox.commands[1] = firefox.commands[1].replace('"1/32"', '"1/16"')
  assert.throws(() => validateProfile(resized, contract, "pr"), {
    code: "SHARD_COVERAGE",
  })

  const unnamed = mutableProfile("pr")
  delete unnamed.lanes.find((lane) => lane.id === "e2e-chromium-odd").project
  assert.throws(() => validateProfile(unnamed, contract, "pr"), {
    code: "PROFILE_SHAPE",
  })

  const stray = mutableProfile("pr")
  stray.lanes.find((lane) => lane.id === "fast").project = "chromium"
  assert.throws(() => validateProfile(stray, contract, "pr"), {
    code: "SPLIT_LANE_SHAPE",
  })
})
