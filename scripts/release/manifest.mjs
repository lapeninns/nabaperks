import assert from "node:assert/strict"
import { createHash } from "node:crypto"

const STAGES = [
  "qualified",
  "database-applied",
  "candidate-ready",
  "promoted",
  "verified",
]
const SHA = /^[a-f0-9]{40}$/
const DIGEST = /^[a-f0-9]{64}$/

// Bind names, order and bytes, not just migration-ledger version membership.
export function migrationDigest(migrations) {
  assert.ok(
    Array.isArray(migrations) && migrations.length > 0,
    "migrations must be non-empty"
  )
  const sorted = [...migrations].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  )
  const versions = new Set()
  const records = sorted.map(({ name, contents }) => {
    assert.match(
      name ?? "",
      /^\d{14}_[a-z0-9_-]+\.sql$/,
      "invalid migration name"
    )
    const version = name.slice(0, 14)
    assert.ok(!versions.has(version), "duplicate migration version")
    versions.add(version)
    assert.ok(
      typeof contents === "string" || Buffer.isBuffer(contents),
      "migration contents are required"
    )
    return [name, createHash("sha256").update(contents).digest("hex")]
  })
  return createHash("sha256").update(JSON.stringify(records)).digest("hex")
}

export function validateReleaseIdentity(identity) {
  assert.ok(
    identity && typeof identity === "object",
    "release identity is required"
  )
  assert.match(
    identity.releaseId ?? "",
    /^[A-Za-z0-9_-]{1,100}$/,
    "release ID is required"
  )
  assert.match(
    identity.revision ?? "",
    SHA,
    "release revision must be a full SHA"
  )
  assert.match(identity.sourceDigest ?? "", DIGEST, "source digest is required")
  assert.match(
    identity.migrationDigest ?? "",
    DIGEST,
    "migration digest is required"
  )
  assert.match(
    identity.runId ?? "",
    /^[1-9]\d*$/,
    "workflow run ID is required"
  )
  assert.ok(
    Number.isSafeInteger(identity.attempt) && identity.attempt > 0,
    "attempt must be positive"
  )
  return identity
}

// Caller must supply identity and clock from the trusted release owner. This
// validator does not authenticate a publisher or acquire a cross-workflow lock.
export function validateStageManifest(
  manifest,
  expected,
  { now = Date.now(), maxAgeMs = 3_600_000 } = {}
) {
  validateReleaseIdentity(expected)
  assert.ok(
    manifest && typeof manifest === "object",
    "stage manifest is required"
  )
  assert.equal(
    manifest.schema,
    "nabaperks.release-stage.v1",
    "unsupported manifest schema"
  )
  validateReleaseIdentity(manifest.identity)
  assert.deepEqual(manifest.identity, expected, "release identity mismatch")
  assert.ok(STAGES.includes(manifest.stage), "unknown release stage")
  assert.equal(manifest.result, "success", "stage did not succeed")
  assert.ok(
    Number.isFinite(now) && Number.isFinite(maxAgeMs) && maxAgeMs > 0,
    "invalid evidence clock policy"
  )
  assert.ok(
    typeof manifest.completedAt === "string",
    "completion timestamp is required"
  )
  const completedAt = Date.parse(manifest.completedAt)
  assert.ok(
    Number.isFinite(completedAt) &&
      new Date(completedAt).toISOString() === manifest.completedAt,
    "invalid completion timestamp"
  )
  assert.ok(
    completedAt <= now && now - completedAt <= maxAgeMs,
    "stage evidence is stale or from the future"
  )
  assert.match(
    manifest.evidenceDigest ?? "",
    DIGEST,
    "stage evidence digest is required"
  )
  return manifest
}

export function validateStageTransition(previous, next, identity, clock) {
  validateStageManifest(previous, identity, clock)
  validateStageManifest(next, identity, clock)
  assert.equal(
    STAGES.indexOf(next.stage),
    STAGES.indexOf(previous.stage) + 1,
    "release stage must advance exactly once"
  )
  assert.ok(
    Date.parse(next.completedAt) >= Date.parse(previous.completedAt),
    "stage completion order is invalid"
  )
  assert.equal(
    next.previousDigest,
    stageManifestDigest(previous),
    "previous stage digest mismatch"
  )
  return next
}

export function stageManifestDigest(manifest) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(manifest)))
    .digest("hex")
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  }
  return value
}
