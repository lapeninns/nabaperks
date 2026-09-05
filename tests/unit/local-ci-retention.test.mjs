import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  RetentionError,
  isExpired,
  partitionLogs,
  retentionCutoff,
  selectExpiredLogs,
} from "../../ops/local-ci/core/retention.mjs"

/**
 * local CI — which logs may be deleted.
 *
 * The run evidence on the Mac is the only copy of what the local plane did.
 * Two properties matter more than the arithmetic: the age comparison is
 * strict, so an entry exactly on the boundary is kept; and a log belonging to
 * a job that is still queued or running is never selected, whatever its age,
 * because a long run started before the cutoff would otherwise have its own
 * log deleted out from under it mid-write.
 */

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  fileURLToPath(new URL("../../config/local-ci-contract.json", import.meta.url))
)

const NOW = Date.parse("2026-09-04T09:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_DAYS = contract.agent.logRetentionDays

const at = (daysAgo) => new Date(NOW - daysAgo * DAY_MS).toISOString()

test("the cutoff is agent.logRetentionDays before now, to the millisecond", () => {
  assert.equal(RETENTION_DAYS, 30)
  assert.equal(retentionCutoff(NOW, contract), NOW - RETENTION_DAYS * DAY_MS)
  assert.equal(
    retentionCutoff(new Date(NOW).toISOString(), contract),
    NOW - RETENTION_DAYS * DAY_MS
  )
})

test("retention selects only entries older than the window", () => {
  const entries = [
    { path: "runs/2026-08-01/fast.log", createdAt: at(34) },
    { path: "runs/2026-08-04/fast.log", createdAt: at(31) },
    { path: "runs/2026-08-05/fast.log", createdAt: at(29) },
    { path: "runs/2026-09-03/fast.log", createdAt: at(1) },
  ]
  assert.deepEqual(
    selectExpiredLogs(entries, NOW, contract).map((entry) => entry.path),
    ["runs/2026-08-01/fast.log", "runs/2026-08-04/fast.log"]
  )

  const partition = partitionLogs(entries, NOW, contract)
  assert.equal(partition.expired.length, 2)
  assert.equal(partition.retained.length, 2)
  assert.deepEqual(partition.protectedByRun, [])
  assert.equal(partition.cutoff, NOW - RETENTION_DAYS * DAY_MS)
  // The caller's own objects come back, in input order.
  assert.equal(partition.expired[0], entries[0])
})

test("an entry exactly on the boundary is retained, not deleted a millisecond early", () => {
  const cutoff = retentionCutoff(NOW, contract)
  const onBoundary = { id: "boundary", createdAt: cutoff }
  const justInside = { id: "just-inside", createdAt: cutoff - 1 }

  assert.equal(isExpired(onBoundary, NOW, contract), false)
  assert.equal(isExpired(justInside, NOW, contract), true)
  assert.deepEqual(
    selectExpiredLogs([onBoundary, justInside], NOW, contract).map(
      (entry) => entry.id
    ),
    ["just-inside"]
  )
})

test("a running or queued job's log is never selected, however old it is", () => {
  const ancient = at(400)
  const entries = [
    { id: "running-flag", createdAt: ancient, running: true },
    { id: "running-status", createdAt: ancient, status: "running" },
    { id: "queued-status", createdAt: ancient, status: "queued" },
    { id: "completed-status", createdAt: ancient, status: "completed" },
  ]

  const partition = partitionLogs(entries, NOW, contract)
  assert.deepEqual(
    partition.expired.map((entry) => entry.id),
    ["completed-status"]
  )
  assert.deepEqual(
    partition.protectedByRun.map((entry) => entry.id),
    ["running-flag", "running-status", "queued-status"]
  )
  for (const entry of entries.slice(0, 3)) {
    assert.equal(isExpired(entry, NOW, contract), false)
  }
})

test("a log is also protected by the id of a job the caller says is running", () => {
  const entries = [
    { id: "a", jobId: "job-000007", createdAt: at(90) },
    { id: "b", jobId: "job-000008", createdAt: at(90) },
  ]
  assert.deepEqual(
    selectExpiredLogs(entries, NOW, contract, {
      runningJobIds: ["job-000007"],
    }).map((entry) => entry.id),
    ["b"]
  )
  assert.deepEqual(
    selectExpiredLogs(entries, NOW, contract, {
      runningJobIds: ["job-000007", "job-000008"],
    }),
    []
  )
  assert.equal(selectExpiredLogs(entries, NOW, contract).length, 2)
})

test("an entry with no timestamp is refused rather than aged out on a guess", () => {
  assert.throws(
    () => selectExpiredLogs([{ path: "orphan.log" }], NOW, contract),
    (error) => {
      assert.ok(error instanceof RetentionError)
      assert.equal(error.code, "MISSING_TIMESTAMP")
      assert.match(error.message, /orphan\.log/)
      return true
    }
  )
  assert.throws(
    () => selectExpiredLogs([{ createdAt: "not a date" }], NOW, contract),
    (error) => error.code === "INVALID_TIMESTAMP"
  )
})

test("retention refuses malformed inputs instead of deleting on a partial answer", () => {
  assert.throws(
    () => selectExpiredLogs("runs/", NOW, contract),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => selectExpiredLogs([null], NOW, contract),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () =>
      selectExpiredLogs([{ createdAt: at(90) }], NOW, contract, {
        runningJobIds: "job-000007",
      }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => selectExpiredLogs([], NOW, { agent: { logRetentionDays: 0 } }),
    (error) => error.code === "INVALID_CONTRACT"
  )
})

test("nothing expires when nothing is old enough", () => {
  const entries = [
    { id: "a", createdAt: at(0) },
    { id: "b", createdAt: at(RETENTION_DAYS - 1) },
  ]
  assert.deepEqual(selectExpiredLogs(entries, NOW, contract), [])
  assert.equal(partitionLogs(entries, NOW, contract).retained.length, 2)
})
