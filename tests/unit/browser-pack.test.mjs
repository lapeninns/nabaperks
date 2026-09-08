import assert from "node:assert/strict"
import { test } from "node:test"
import {
  browserPackRequests,
  comparePackInventory,
  runBrowserPack,
} from "../../scripts/ci/browser-pack.mjs"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

test("packing preserves the existing shard denominator and selection", () => {
  const requests = browserPackRequests({
    project: "chromium",
    shards: ["1/32", "2/32", "3/32", "4/32"],
  })
  assert.deepEqual(
    requests.map((request) => request.args),
    [1, 2, 3, 4].map((n) => [
      "test",
      "--project=chromium",
      "--grep-invert",
      "@visual",
      `--shard=${n}/32`,
    ])
  )
  for (const shards of [
    [],
    ["1/8"],
    ["1/32", "1/32"],
    ["0/32"],
    ["1/32", "2/32", "3/32", "4/32", "5/32"],
  ])
    assert.throws(() => browserPackRequests({ project: "chromium", shards }))
  assert.throws(() =>
    browserPackRequests({ project: "unknown", shards: ["1/32"] })
  )
})

test("a failed shard stops the pack and cannot turn missing reports into success", async () => {
  const root = mkdtempSync(join(tmpdir(), "pack-test-"))
  let calls = 0
  try {
    await assert.rejects(
      () =>
        runBrowserPack(
          {
            project: "chromium",
            shards: ["1/32", "2/32"],
            output: join(root, "failure"),
          },
          {
            env: {},
            run: () => {
              calls++
              return { status: 1 }
            },
          }
        ),
      /failed in shard/
    )
    assert.equal(calls, 1)
    await assert.rejects(
      () =>
        runBrowserPack(
          {
            project: "chromium",
            shards: ["1/32"],
            output: join(root, "missing"),
          },
          {
            env: {},
            run: () => ({
              status: 0,
              cleanupVerified: true,
              unexpectedSurvivors: false,
            }),
          }
        ),
      /ENOENT/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("pilot comparison detects missing identities and changed partitions", () => {
  const test = { project: "chromium", file: "a.spec.ts", title: ["test"] }
  const evidence = {
    project: "chromium",
    results: [{ shard: "1/32", tests: [test] }],
  }
  assert.equal(comparePackInventory(evidence, evidence).equivalent, true)
  assert.equal(
    comparePackInventory(evidence, {
      ...evidence,
      results: [{ shard: "1/32", tests: [test, test] }],
    }).equivalent,
    false
  )
  assert.throws(
    () =>
      comparePackInventory(evidence, {
        ...evidence,
        results: [{ shard: "2/32", tests: [test] }],
      }),
    /partition/
  )
})
