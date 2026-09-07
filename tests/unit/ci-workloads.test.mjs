import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runWorkload, workloads } from "../../scripts/ci/run-workload.mjs"
import {
  browserArguments,
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
      assert.equal(commands.length, 8)
      for (const [index, command] of commands.entries()) {
        const args = command.replaceAll('"', "").split(" ").slice(2)
        const generated = parseBrowserRequest(args)
        assert.ok(generated.includes("--ignore-snapshots"))
        assert.ok(generated.includes("--grep-invert"))
        assert.ok(generated.includes(`--shard=${index + 1}/8`))
        count++
      }
    }
    assert.equal(count, 48)
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
