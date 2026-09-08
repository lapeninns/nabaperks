import test from "node:test"
import assert from "node:assert/strict"
import { verifyMigrationPrefix } from "../../scripts/release/pre-apply-migrations.mjs"
import { bindExecution } from "../../scripts/release/qualify-runtime.mjs"

const migration = (version, contents = "select 1;") => ({
  name: `${version}_proof.sql`,
  contents,
})
const baseline = [migration("20260101000000"), migration("20260102000000")]
const candidate = [...baseline, migration("20260103000000")]

test("production admission accepts only contiguous qualified baseline-through-candidate states", () => {
  assert.deepEqual(
    verifyMigrationPrefix(baseline, candidate, [
      "20260101000000",
      "20260102000000",
    ]),
    { applied: 2, pending: 1 }
  )
  assert.deepEqual(
    verifyMigrationPrefix(
      baseline,
      candidate,
      candidate.map((x) => x.name.slice(0, 14))
    ),
    { applied: 3, pending: 0 }
  )
  for (const remote of [
    [],
    ["20260101000000"],
    ["20260101000000", "20260103000000"],
    ["20260101000000", "20260102000000", "20260104000000"],
  ])
    assert.throws(() => verifyMigrationPrefix(baseline, candidate, remote))
  assert.throws(
    () =>
      verifyMigrationPrefix(
        baseline,
        [migration("20260101000000", "select 2;"), ...candidate.slice(1)],
        ["20260101000000", "20260102000000"]
      ),
    /bytes changed/
  )
})

test("release envelope refuses missing, failed or mismatched execution proof", () => {
  const identity = {
    releaseId: "123-1",
    runId: "123",
    attempt: 1,
    revision: "b".repeat(40),
    baselineRevision: "a".repeat(40),
    rollbackRevision: "a".repeat(40),
    sourceDigest: "c".repeat(64),
    migrationDigest: "d".repeat(64),
  }
  const execution = {
    schema: "nabaperks.populated-upgrade.v1",
    targetKind: "disposable",
    candidateRevision: identity.revision,
    baselineRevision: identity.baselineRevision,
    rollbackRevision: identity.rollbackRevision,
    migrationDigest: identity.migrationDigest,
    fixtureRows: 18,
    fixtureDigest: "e".repeat(64),
    checks: [
      "populated-upgrade",
      "baseline-app-upgraded-schema",
      "candidate-app-upgraded-schema",
      "rollback-app-upgraded-schema",
    ].map((name) => ({
      name,
      revision:
        name.startsWith("baseline") || name.startsWith("rollback")
          ? identity.baselineRevision
          : identity.revision,
      migrationDigest: identity.migrationDigest,
      evidenceDigest: "f".repeat(64),
      result: "success",
    })),
  }
  assert.equal(bindExecution(execution, identity).identity, identity)
  for (const mutation of [
    { fixtureRows: 0 },
    { candidateRevision: identity.baselineRevision },
    { migrationDigest: "0".repeat(64) },
    { checks: execution.checks.slice(1) },
    { checks: execution.checks.map((x) => ({ ...x, result: "failure" })) },
  ])
    assert.throws(() => bindExecution({ ...execution, ...mutation }, identity))
})
