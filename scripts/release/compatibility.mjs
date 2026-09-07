import assert from "node:assert/strict"
import { validateStageManifest } from "./manifest.mjs"

// Evidence must come from disposable service-backed executions. This only
// validates their admission contract; it cannot manufacture execution proof.
export function validateCompatibilityEvidence(evidence, expected, clock) {
  validateStageManifest(evidence, expected.identity, clock)
  assert.equal(
    evidence.stage,
    "qualified",
    "compatibility belongs to qualification"
  )
  assert.match(
    expected.baselineRevision ?? "",
    /^[a-f0-9]{40}$/,
    "baseline revision must be a full SHA"
  )
  assert.match(
    expected.rollbackRevision ?? "",
    /^[a-f0-9]{40}$/,
    "rollback revision must be a full SHA"
  )
  assert.equal(
    evidence.baselineRevision,
    expected.baselineRevision,
    "baseline revision mismatch"
  )
  assert.equal(
    evidence.rollbackRevision,
    expected.rollbackRevision,
    "rollback revision mismatch"
  )
  assert.match(
    evidence.fixtureDigest ?? "",
    /^[a-f0-9]{64}$/,
    "populated fixture digest is required"
  )
  assert.ok(
    Number.isSafeInteger(evidence.fixtureRows) && evidence.fixtureRows > 0,
    "upgrade proof must start populated"
  )
  assert.equal(
    evidence.targetKind,
    "disposable",
    "compatibility proof must use a disposable target"
  )
  const required = [
    "populated-upgrade",
    "baseline-app-upgraded-schema",
    "candidate-app-upgraded-schema",
    "rollback-app-upgraded-schema",
  ]
  assert.ok(Array.isArray(evidence.checks), "compatibility checks are required")
  assert.deepEqual(
    evidence.checks.map((check) => check.name).sort(),
    [...required].sort(),
    "compatibility checks must be complete and unique"
  )
  for (const check of evidence.checks) {
    assert.equal(
      check.result,
      "success",
      `compatibility check ${check.name} failed`
    )
    assert.equal(
      check.migrationDigest,
      expected.identity.migrationDigest,
      "compatibility schema digest mismatch"
    )
    const revision =
      check.name === "baseline-app-upgraded-schema"
        ? expected.baselineRevision
        : check.name === "rollback-app-upgraded-schema"
          ? expected.rollbackRevision
          : expected.identity.revision
    assert.equal(
      check.revision,
      revision,
      "compatibility application revision mismatch"
    )
    assert.match(
      check.evidenceDigest ?? "",
      /^[a-f0-9]{64}$/,
      "compatibility execution evidence is required"
    )
  }
  return evidence
}
