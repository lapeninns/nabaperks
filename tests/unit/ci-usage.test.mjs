import assert from "node:assert/strict"
import { test } from "node:test"
import { summariseJobs, collectUsage } from "../../scripts/ci/collect-usage.mjs"

test("usage keeps missing timing separate from measured aggregate execution", () => {
  assert.deepEqual(
    summariseJobs([
      {
        started_at: "2026-09-08T12:00:00Z",
        completed_at: "2026-09-08T12:02:00Z",
        conclusion: "success",
      },
      { status: "queued", conclusion: null },
      {
        started_at: "2026-09-08T12:04:00Z",
        completed_at: "2026-09-08T12:03:00Z",
        conclusion: "cancelled",
      },
    ]),
    {
      jobCount: 3,
      timedJobs: 1,
      aggregateExecutionMinutes: 2,
      outcomes: { success: 1, queued: 1, cancelled: 1 },
    }
  )
})

test("usage reads every attempt and every artifact page without deleting anything", () => {
  const paths = []
  const result = collectUsage({
    count: 1,
    read: (args) => {
      const path = args.at(-1)
      paths.push(path)
      assert.equal(args[0], "api")
      assert.ok(!args.includes("--method"))
      if (path.includes("workflows/"))
        return {
          workflow_runs: [
            {
              id: 1,
              run_attempt: 2,
              head_sha: "a".repeat(40),
              status: "completed",
              conclusion: "success",
            },
          ],
        }
      if (path.includes("/jobs?"))
        return [
          { jobs: [{ id: 1, status: "completed", conclusion: "success" }] },
        ]
      if (path.includes("/artifacts?"))
        return [
          { artifacts: [{ expired: false, size_in_bytes: 10 }] },
          { artifacts: [{ expired: true, size_in_bytes: 20 }] },
        ]
      return { active_caches_count: 1, active_caches_size_in_bytes: 30 }
    },
  })
  assert.equal(result.samples[0].attempts.length, 2)
  assert.equal(result.samples[0].attempts[1].priorAttemptJobs, 1)
  assert.equal(result.samples[0].attempts[1].jobCount, 0)
  assert.ok(paths.some((path) => path.includes("attempts/2/jobs")))
  assert.equal(result.artifacts.unexpiredBytes, 10)
  assert.equal(result.artifacts.historicalCount, 2)
  assert.throws(() => collectUsage({ count: 100 }), /one to twenty/)
})
