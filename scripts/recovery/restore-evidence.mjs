import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const COUNT_KEYS = [
  "auth_users",
  "memberships",
  "merchants",
  "rewards",
  "stamps",
]

export function readPinnedEvidence(file, digest) {
  assert.match(digest, /^[a-f0-9]{64}$/, "evidence digest must be SHA-256")
  const bytes = readFileSync(file)
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    digest,
    "evidence does not match the protected digest"
  )
  return JSON.parse(bytes.toString("utf8"))
}

function timestamp(value, label) {
  assert.equal(typeof value, "string", `${label} is required`)
  const result = new Date(value)
  assert.ok(Number.isFinite(result.getTime()), `${label} is invalid`)
  assert.equal(result.toISOString(), value, `${label} must be canonical UTC`)
  return result
}

export function verifyRestoreLineage(config, backupAt, targetCreatedAt, now) {
  const lineage = readPinnedEvidence(config.lineageFile, config.lineageSha256)
  const manifest = readPinnedEvidence(
    config.manifestFile,
    config.manifestSha256
  )
  assert.equal(lineage.schema, "nabaperks.restore-lineage.v1")
  assert.equal(manifest.schema, "nabaperks.backup-source-manifest.v1")
  for (const evidence of [lineage, manifest]) {
    assert.equal(
      evidence.sourceProjectRef,
      config.sourceProjectRef,
      "wrong source project"
    )
    assert.equal(evidence.backupId, config.backupId, "wrong backup ID")
    assert.equal(
      evidence.backupAt,
      backupAt.toISOString(),
      "wrong backup recovery point"
    )
  }
  assert.equal(
    lineage.restoreProjectRef,
    config.projectRef,
    "wrong restore target"
  )
  assert.equal(
    lineage.sourceManifestSha256,
    config.manifestSha256,
    "wrong source manifest"
  )
  assert.equal(lineage.status, "COMPLETED", "restore operation is incomplete")
  assert.equal(typeof lineage.providerOperationId, "string")
  assert.match(
    lineage.providerOperationId,
    /^[a-zA-Z0-9_-]{1,128}$/,
    "provider operation ID required"
  )
  const startedAt = timestamp(config.recoveryStartedAt, "recovery start")
  const operationStartedAt = timestamp(
    lineage.startedAt,
    "restore operation start"
  )
  const operationCompletedAt = timestamp(
    lineage.completedAt,
    "restore operation completion"
  )
  assert.ok(
    startedAt <= operationStartedAt,
    "recovery start follows restore operation"
  )
  assert.ok(
    operationStartedAt <= targetCreatedAt,
    "target predates restore operation"
  )
  assert.ok(
    targetCreatedAt <= operationCompletedAt,
    "target created after restore completion"
  )
  assert.ok(
    operationCompletedAt <= now,
    "restore operation completion is in the future"
  )
  assert.ok(backupAt <= operationStartedAt, "restore operation predates backup")
  assert.ok(
    Array.isArray(manifest.migrations) && manifest.migrations.length > 0,
    "source migration manifest is required"
  )
  assert.ok(
    manifest.migrations.every(
      (version) => typeof version === "string" && /^\d{14}$/.test(version)
    ),
    "source migration versions are invalid"
  )
  assert.deepEqual(
    manifest.migrations,
    [...new Set(manifest.migrations)].sort(),
    "source migrations must be unique and sorted"
  )
  assert.deepEqual(
    Object.keys(manifest.counts ?? {}).sort(),
    COUNT_KEYS,
    "source aggregate count baseline is incomplete"
  )
  assert.ok(
    Object.values(manifest.counts).every(
      (count) => typeof count === "string" && /^(0|[1-9]\d*)$/.test(count)
    ),
    "source counts must be canonical non-negative integers"
  )
  assert.equal(
    manifest.invariants?.activeCronJobs,
    0,
    "isolated baseline must disable cron"
  )
  return {
    expectedMigrations: manifest.migrations,
    manifest,
    providerOperationId: lineage.providerOperationId,
    startedAt,
    operationCompletedAt,
  }
}

export function completeRestoreEvidence(
  config,
  lineage,
  databaseEvidence,
  completedAt
) {
  assert.ok(
    completedAt instanceof Date && Number.isFinite(completedAt.getTime()),
    "verification completion is invalid"
  )
  assert.ok(
    completedAt >= lineage.operationCompletedAt,
    "verification predates restore completion"
  )
  const elapsedMinutes = (completedAt - lineage.startedAt) / 60_000
  assert.ok(
    elapsedMinutes >= 0 && elapsedMinutes <= config.rtoMinutes,
    `restore verification exceeded the ${config.rtoMinutes}-minute RTO`
  )
  assert.deepEqual(
    databaseEvidence.counts,
    lineage.manifest.counts,
    "restored counts differ from source baseline"
  )
  assert.equal(
    databaseEvidence.activeCronJobs,
    lineage.manifest.invariants.activeCronJobs,
    "restored isolation invariant differs"
  )
  return {
    elapsedMinutes: Number(elapsedMinutes.toFixed(2)),
    verifiedAt: completedAt.toISOString(),
    recoveryStartedAt: lineage.startedAt.toISOString(),
    providerOperationId: lineage.providerOperationId,
    lineageSha256: config.lineageSha256,
    sourceManifestSha256: config.manifestSha256,
  }
}
