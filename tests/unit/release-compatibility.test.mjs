import assert from "node:assert/strict"
import { test } from "node:test"
import { validateCompatibilityEvidence } from "../../scripts/release/compatibility.mjs"

const expected = {
  identity: {
    releaseId: "release-42",
    revision: "a".repeat(40),
    sourceDigest: "b".repeat(64),
    migrationDigest: "c".repeat(64),
    runId: "42",
    attempt: 1,
  },
  baselineRevision: "d".repeat(40),
  rollbackRevision: "e".repeat(40),
}
const clock = { now: Date.parse("2026-09-07T00:10:00.000Z") }
function fixture() {
  return {
    schema: "nabaperks.release-stage.v1",
    identity: expected.identity,
    stage: "qualified",
    result: "success",
    completedAt: "2026-09-07T00:05:00.000Z",
    evidenceDigest: "f".repeat(64),
    baselineRevision: expected.baselineRevision,
    rollbackRevision: expected.rollbackRevision,
    fixtureDigest: "a".repeat(64),
    fixtureRows: 12,
    targetKind: "disposable",
    checks: [
      ["populated-upgrade", expected.identity.revision],
      ["baseline-app-upgraded-schema", expected.baselineRevision],
      ["candidate-app-upgraded-schema", expected.identity.revision],
      ["rollback-app-upgraded-schema", expected.rollbackRevision],
    ].map(([name, revision]) => ({
      name,
      revision,
      result: "success",
      migrationDigest: expected.identity.migrationDigest,
      evidenceDigest: "b".repeat(64),
    })),
  }
}

test("compatibility admission binds populated upgrade, baseline, candidate and rollback execution", () => {
  const evidence = fixture()
  assert.equal(
    validateCompatibilityEvidence(evidence, expected, clock),
    evidence
  )
})

test("compatibility rejects empty data, wrong targets and missing or duplicate proof", () => {
  for (const patch of [
    { fixtureRows: 0 },
    { targetKind: "production" },
    { fixtureDigest: "" },
    { baselineRevision: "f".repeat(40) },
    { rollbackRevision: "f".repeat(40) },
  ]) {
    assert.throws(() =>
      validateCompatibilityEvidence({ ...fixture(), ...patch }, expected, clock)
    )
  }
  const missing = fixture()
  missing.checks.pop()
  assert.throws(() => validateCompatibilityEvidence(missing, expected, clock))
  const duplicate = fixture()
  duplicate.checks[3] = duplicate.checks[0]
  assert.throws(() => validateCompatibilityEvidence(duplicate, expected, clock))
})

test("compatibility rejects failed, mismatched or unsupported application/schema evidence", () => {
  for (const patch of [
    { result: "failure" },
    { revision: "f".repeat(40) },
    { migrationDigest: "f".repeat(64) },
    { evidenceDigest: "" },
  ]) {
    const evidence = fixture()
    evidence.checks[3] = { ...evidence.checks[3], ...patch }
    assert.throws(() =>
      validateCompatibilityEvidence(evidence, expected, clock)
    )
  }
})
