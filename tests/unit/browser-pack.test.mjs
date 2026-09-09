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
  // A pack is now eight shards rather than four: the same tests, grouped so
  // that per-job setup - checkout, the container pull, browser verification -
  // is paid sixteen times instead of thirty-three. The denominator stays /32
  // precisely because the selection must not move.
  const shards = Array.from({ length: 8 }, (_, index) => `${index + 1}/32`)
  const requests = browserPackRequests({ project: "chromium", shards })
  assert.deepEqual(
    requests.map((request) => request.shard),
    shards
  )
  assert.deepEqual(
    requests.map((request) => request.args),
    shards.map((shard) => [
      "test",
      "--project=chromium",
      "--grep-invert",
      "@visual",
      `--shard=${shard}`,
    ])
  )
  // Bounds and uniqueness still hold at the new size. A duplicate would run
  // one slice twice and, paired with an omission elsewhere, hide the gap; a
  // ninth shard would mean the pack list no longer partitions the suite.
  for (const invalid of [
    [],
    ["1/8"],
    ["1/32", "1/32"],
    ["0/32"],
    ["33/32"],
    Array.from({ length: 9 }, (_, index) => `${index + 1}/32`),
    [...shards.slice(0, 7), "7/32"],
  ])
    assert.throws(() =>
      browserPackRequests({ project: "chromium", shards: invalid })
    )
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
