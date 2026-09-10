import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runWorkload, workloads } from "../../scripts/ci/run-workload.mjs"
import {
  browserArguments,
  browserExitCode,
  parseBrowserRequest,
} from "../../scripts/ci/browser-workload.mjs"
import {
  compareInventory,
  compareBrowserEvidence,
  inventoryFromPlaywright,
} from "../../scripts/ci/browser-parity.mjs"

test("shared commands propagate failure and do not execute later commands", () => {
  const calls = []
  assert.equal(
    runWorkload("fast", {
      spawn: (...args) => {
        calls.push(args)
        return { status: 7 }
      },
      report: () => {},
    }),
    7
  )
  assert.equal(calls.length, 1)
  assert.throws(() => runWorkload("__proto__"), /Unknown/)
  assert.equal(
    runWorkload("coverage", {
      spawn: () => ({ status: null, signal: "SIGTERM" }),
      report: () => {},
    }),
    1
  )
})

test("every local browser command resolves to all original shards with snapshot guards", () => {
  for (const name of ["pr", "main", "nightly"]) {
    const profile = JSON.parse(
      readFileSync(
        new URL(`../../ops/local-ci/profiles/${name}.json`, import.meta.url)
      )
    )
    let count = 0
    for (const lane of profile.lanes.filter((lane) =>
      /^(e2e|a11y)-/.test(lane.id)
    )) {
      assert.equal(lane.env.PLAYWRIGHT_WORKERS, "1")
      const commands = lane.commands.slice(1)
      // The denominator is read from the reviewed workload rather than
      // written here twice: a profile that lost or gained a shard command
      // must fail this, and a profile that merely tracks an approved
      // denominator must not need this file edited to say so.
      const suite = /browser-workload\.mjs local (\S+) /.exec(commands[0])?.[1]
      const shards = workloads.browsers[suite]?.localShards
      assert.ok(shards, `lane ${lane.id} names a known browser suite`)
      assert.equal(
        commands.length,
        shards,
        `lane ${lane.id} must carry every one of its ${shards} shards`
      )
      for (const [index, command] of commands.entries()) {
        const args = command.replaceAll('"', "").split(" ").slice(2)
        const generated = parseBrowserRequest(args)
        assert.ok(generated.includes("--ignore-snapshots"))
        assert.ok(generated.includes("--grep-invert"))
        assert.ok(generated.includes(`--shard=${index + 1}/${shards}`))
        count++
      }
    }
    // Four e2e projects at /32 and four a11y projects at /8, per profile.
    assert.equal(count, 4 * 32 + 4 * 8)
  }
})

test("hosted workload preserves projects and denominators and refuses unqualified packing", () => {
  for (const [suite, definition] of Object.entries(workloads.browsers)) {
    for (const project of definition.projects) {
      const args = browserArguments({
        plane: "hosted",
        suite,
        project,
        shard: `1/${definition.hostedShards}`,
      })
      assert.ok(!args.includes("--ignore-snapshots"))
    }
  }
  assert.throws(
    () =>
      browserArguments({
        plane: "local",
        suite: "test:visual",
        project: "chromium",
        shard: "1/4",
      }),
    /Invalid/
  )
  assert.throws(
    () =>
      browserArguments({
        plane: "hosted",
        suite: "test:e2e",
        project: "chromium",
        shard: "1/8",
      }),
    /Invalid/
  )
})

const identity = {
  project: "chromium",
  file: "tests/e2e/a.spec.ts",
  title: ["suite", "test"],
}
const evidence = () => ({
  execution: { exitCode: 0, complete: true, globalErrors: [] },
  tests: [
    { ...identity, status: "passed", retries: 0, skipReason: "", flaky: false },
  ],
  policy: {
    workers: 1,
    retries: 1,
    failOnFlakyTests: true,
    forbidOnly: true,
    browserVersion: "1.62.1",
    platform: "linux",
    architecture: "x64",
    heapMb: 8192,
  },
  resources: {
    maxRssMb: 1000,
    durationMs: 2000,
    serverStarts: 1,
    serverRestarts: 0,
  },
})
const budget = { maxRssMb: 2000, durationMs: 3000 }
test("inventory is a multiset and refuses missing/duplicate identities", () => {
  assert.equal(
    compareInventory([identity], [identity, identity]).equivalent,
    false
  )
  assert.throws(() => compareInventory([], []), /non-empty/)
  assert.equal(
    compareInventory([identity], [{ ...identity, title: ["other"] }])
      .equivalent,
    false
  )
})
test("grouping parity requires runtime skips flakes and measured resources", () => {
  assert.equal(
    compareBrowserEvidence(evidence(), evidence(), budget).equivalent,
    true
  )
  const skipped = evidence()
  skipped.tests[0].status = "skipped"
  skipped.tests[0].skipReason = "No database"
  assert.equal(
    compareBrowserEvidence(evidence(), skipped, budget).equivalent,
    false
  )
  const flaky = evidence()
  flaky.tests[0].flaky = true
  assert.throws(
    () => compareBrowserEvidence(evidence(), flaky, budget),
    /Flaky/
  )
  const missing = evidence()
  delete missing.resources.maxRssMb
  assert.equal(
    compareBrowserEvidence(evidence(), missing, budget).equivalent,
    false
  )
  const larger = evidence()
  larger.resources.maxRssMb = 3000
  assert.equal(
    compareBrowserEvidence(evidence(), larger, budget).equivalent,
    false
  )
})

test("Playwright listing preserves identities without inventing runtime proof", () => {
  const records = inventoryFromPlaywright({
    suites: [
      {
        title: "a.spec.ts",
        file: "a.spec.ts",
        specs: [
          {
            title: "works",
            file: "a.spec.ts",
            tests: [{ projectName: "chromium", results: [] }],
          },
        ],
      },
    ],
  })
  assert.deepEqual(records, [
    { project: "chromium", file: "a.spec.ts", title: ["a.spec.ts", "works"] },
  ])
  assert.throws(
    () =>
      compareBrowserEvidence(
        { ...evidence(), tests: records },
        { ...evidence(), tests: records },
        budget
      ),
    /runtime/
  )
})

test("shared command manifest retains each hosted safety command in order", () => {
  assert.deepEqual(workloads.commands.fast, [
    ["pnpm", "env:check:production"],
    ["pnpm", "security:audit", "--ignore-registry-errors"],
    ["pnpm", "lint"],
    ["pnpm", "typecheck"],
    ["pnpm", "test:contracts"],
  ])
  assert.deepEqual(workloads.commands.coverage, [["pnpm", "test:coverage"]])
  assert.deepEqual(
    workloads.commands.quality.map((argv) => argv.join(" ")),
    [
      "pnpm deadcode:check",
      "pnpm duplicates:check",
      "pnpm debt:check",
      "pnpm docs:check",
      "pnpm agents:check",
      "pnpm tokens:check",
      "pnpm claims:check",
    ]
  )
  assert.deepEqual(workloads.commands.build, [
    ["pnpm", "build"],
    ["pnpm", "bundle:check"],
    ["pnpm", "jsonld:check"],
  ])
})

test("the browser manifest pins every tier's projects, selection and denominators", () => {
  // Accessibility moves as a complete four-project union in this change.
  // Read as a whole rather than field by field: this is the file a future
  // "let us just make CI cheaper" edit reaches for, and the cheap edits all
  // look like small numbers - one fewer project, a narrower grep, a smaller
  // hosted denominator. Any of those changes the set of tests executed, which
  // is the one thing the packing work was not allowed to touch.
  //
  // test:e2e keeps hostedShards 32 because the regrouping moved job count,
  // not the denominator: packs group existing /32 shards. test:a11y drops
  // from eight hosted shards to four, which is a different split of the same
  // union - eight jobs' worth of repeated setup for eleven minutes of actual
  // test work did not pay for itself. test:visual is the pixel-baseline
  // authority and stays exactly as it was.
  //
  // test:e2e's localShards moved 8 -> 32 to match hostedShards. That is the
  // denominator change already reviewed, because it raises the split
  // rather than lowering it: the executed union is identical and every server
  // carries fewer tests. It is a memory fix with kernel evidence behind it.
  // At /8 a mobile-safari shard is 37 tests - all of them a11y-sweep axe
  // scans against one `next dev` - and the VM recorded twelve containers in
  // which the memory cgroup killed `next-server` at 6.06-6.43 GiB anon-RSS
  // against an 8 GiB lane and a 6144 MiB heap ceiling, taking WPEWebProcess
  // with it. The surviving tests then failed on ECONNREFUSED and read as
  // ordinary assertion failures. /32 is ~10 tests per server, which is what
  // the hosted tier already runs green.
  assert.deepEqual(workloads.browsers, {
    "test:e2e": {
      projects: [
        "chromium",
        "mobile-safari",
        "desktop-firefox",
        "desktop-safari",
      ],
      hostedShards: 32,
      localShards: 32,
      grepInvert: "@visual|@a11y",
    },
    "test:a11y": {
      projects: [
        "chromium",
        "mobile-safari",
        "desktop-firefox",
        "desktop-safari",
      ],
      hostedShards: 4,
      localShards: 8,
      grep: "@a11y",
    },
    "test:visual": {
      projects: ["chromium", "mobile-safari"],
      hostedShards: 4,
      grep: "@visual",
    },
  })
})

test("global teardown failures and incomplete processes cannot qualify grouping", () => {
  const report = { errors: [{ message: "global teardown failed" }], suites: [] }
  assert.throws(() => inventoryFromPlaywright(report), /global errors/)
  assert.throws(
    () => inventoryFromPlaywright({ suites: [], stats: { unexpected: 1 } }),
    /unexpected/
  )
  for (const execution of [
    undefined,
    { exitCode: 1, complete: true, globalErrors: [] },
    { exitCode: 0, complete: false, globalErrors: [] },
    { exitCode: 0, complete: true, globalErrors: ["teardown failure"] },
  ]) {
    assert.equal(
      compareBrowserEvidence(evidence(), { ...evidence(), execution }, budget)
        .equivalent,
      false
    )
  }
})

test("a signalled browser shard is not reported as a failed test suite", () => {
  // The memory cgroup killing `next-server` mid-shard used to reach the lane
  // record as exit 1 - the same code Playwright returns for a red suite - and
  // the surviving tests' ECONNREFUSED was the only trace. The kill now carries
  // its own code so the lane result can tell an infrastructure failure from a
  // test failure without a reader inferring it from the log.
  assert.equal(browserExitCode({ status: null, signal: "SIGKILL" }), 137)
  assert.equal(browserExitCode({ status: null, signal: "SIGTERM" }), 143)
  assert.notEqual(browserExitCode({ status: null, signal: "SIGKILL" }), 1)

  // An ordinary red suite and a clean pass are untouched.
  assert.equal(browserExitCode({ status: 1, signal: null }), 1)
  assert.equal(browserExitCode({ status: 0, signal: null }), 0)

  // A spawn that produced neither is a failure, never a silent success.
  assert.equal(browserExitCode({}), 1)
  assert.equal(browserExitCode(), 1)
})
