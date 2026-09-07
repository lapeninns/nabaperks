import assert from "node:assert/strict"
import { test } from "node:test"
import {
  migrationDigest,
  stageManifestDigest,
  validateStageManifest,
  validateStageTransition,
} from "../../scripts/release/manifest.mjs"

const identity = {
  releaseId: "release-42",
  revision: "a".repeat(40),
  sourceDigest: "b".repeat(64),
  migrationDigest: "c".repeat(64),
  runId: "42",
  attempt: 1,
}
const clock = { now: Date.parse("2026-09-07T00:10:00.000Z"), maxAgeMs: 600_000 }
const manifest = {
  schema: "nabaperks.release-stage.v1",
  identity,
  stage: "qualified",
  result: "success",
  completedAt: "2026-09-07T00:05:00.000Z",
  evidenceDigest: "d".repeat(64),
}

test("migration digest binds ordered filenames and exact migration bytes", () => {
  const migrations = [
    { name: "20260101000000_one.sql", contents: "select 1;" },
    { name: "20260102000000_two.sql", contents: "select 2;" },
  ]
  assert.equal(
    migrationDigest(migrations),
    migrationDigest([...migrations].reverse())
  )
  assert.notEqual(
    migrationDigest(migrations),
    migrationDigest([
      { ...migrations[0], contents: "select 3;" },
      migrations[1],
    ])
  )
  assert.notEqual(
    migrationDigest(migrations),
    migrationDigest([
      { ...migrations[0], name: "20260101000000_renamed.sql" },
      migrations[1],
    ])
  )
  assert.throws(
    () =>
      migrationDigest([
        ...migrations,
        { ...migrations[0], name: "20260101000000_duplicate.sql" },
      ]),
    /duplicate/
  )
  assert.throws(() => migrationDigest([]))
})

test("stage evidence binds attempts, source and migration identity and rejects stale evidence", () => {
  assert.equal(validateStageManifest(manifest, identity, clock), manifest)
  for (const patch of [
    { revision: "e".repeat(40) },
    { migrationDigest: "e".repeat(64) },
    { sourceDigest: "e".repeat(64) },
    { attempt: 2 },
    { runId: "43" },
    { releaseId: "superseded" },
  ]) {
    assert.throws(
      () =>
        validateStageManifest(
          { ...manifest, identity: { ...identity, ...patch } },
          identity,
          clock
        ),
      /identity mismatch/
    )
  }
  for (const patch of [
    { completedAt: "2026-09-06T23:00:00.000Z" },
    { completedAt: "2026-09-07T00:11:00.000Z" },
    { completedAt: "yesterday" },
    { completedAt: null },
    { result: "cancelled" },
    { result: "skipped" },
    { stage: "unknown" },
    { evidenceDigest: "" },
  ]) {
    assert.throws(() =>
      validateStageManifest({ ...manifest, ...patch }, identity, clock)
    )
  }
})

test("stage transitions reject replay, skipped stages and broken predecessor binding", () => {
  const next = {
    ...manifest,
    stage: "database-applied",
    completedAt: "2026-09-07T00:06:00.000Z",
    previousDigest: stageManifestDigest(manifest),
  }
  assert.equal(validateStageTransition(manifest, next, identity, clock), next)
  for (const patch of [
    { stage: "qualified" },
    { stage: "promoted" },
    { previousDigest: "e".repeat(64) },
    { completedAt: "2026-09-07T00:04:00.000Z" },
  ]) {
    assert.throws(() =>
      validateStageTransition(manifest, { ...next, ...patch }, identity, clock)
    )
  }
  assert.equal(
    stageManifestDigest(manifest),
    stageManifestDigest(Object.fromEntries(Object.entries(manifest).reverse()))
  )
})
