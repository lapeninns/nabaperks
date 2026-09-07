import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import {
  completeRestoreEvidence,
  verifyRestoreLineage,
} from "../../scripts/recovery/restore-evidence.mjs"
import { runRestoreDrill } from "../../scripts/check-restored-backup.mjs"

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "restore-lineage-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const manifest = {
    schema: "nabaperks.backup-source-manifest.v1",
    sourceProjectRef: "source",
    backupId: "123",
    backupAt: "2026-09-01T10:00:00.000Z",
    migrations: ["20260901000100"],
    counts: {
      auth_users: "3",
      memberships: "3",
      merchants: "2",
      rewards: "1",
      stamps: "4",
    },
    invariants: { activeCronJobs: 0 },
  }
  const lineage = {
    schema: "nabaperks.restore-lineage.v1",
    sourceProjectRef: "source",
    backupId: "123",
    backupAt: manifest.backupAt,
    restoreProjectRef: "target",
    providerOperationId: "restore-456",
    status: "COMPLETED",
    startedAt: "2026-09-01T10:03:00.000Z",
    completedAt: "2026-09-01T10:20:00.000Z",
  }
  const config = {
    sourceProjectRef: "source",
    projectRef: "target",
    backupId: "123",
    recoveryStartedAt: "2026-09-01T10:01:00.000Z",
    rtoMinutes: 30,
    lineageFile: path.join(root, "lineage.json"),
    manifestFile: path.join(root, "manifest.json"),
  }
  function save() {
    const bytes = JSON.stringify(manifest)
    config.manifestSha256 = createHash("sha256").update(bytes).digest("hex")
    writeFileSync(config.manifestFile, bytes)
    lineage.sourceManifestSha256 = config.manifestSha256
    const lineageBytes = JSON.stringify(lineage)
    config.lineageSha256 = createHash("sha256")
      .update(lineageBytes)
      .digest("hex")
    writeFileSync(config.lineageFile, lineageBytes)
  }
  save()
  const verify = () =>
    verifyRestoreLineage(
      config,
      new Date(manifest.backupAt),
      new Date("2026-09-01T10:05:00.000Z"),
      new Date("2026-09-01T10:25:00.000Z")
    )
  return { config, lineage, manifest, save, verify }
}

test("restore evidence requires protected exact source, target and backup lineage", (t) => {
  const f = fixture(t)
  assert.deepEqual(f.verify().expectedMigrations, f.manifest.migrations)
  for (const [field, value, pattern] of [
    ["sourceProjectRef", "other", /wrong source/],
    ["restoreProjectRef", "other", /wrong restore/],
    ["backupId", "999", /wrong backup/],
    ["status", "RUNNING", /incomplete/],
    ["providerOperationId", "", /operation ID/],
  ]) {
    const original = f.lineage[field]
    f.lineage[field] = value
    f.save()
    assert.throws(f.verify, pattern)
    f.lineage[field] = original
    f.save()
  }
  writeFileSync(f.config.lineageFile, "{}")
  assert.throws(f.verify, /protected digest/)
})

test("restore evidence rejects absent or malformed source ledger and counts", (t) => {
  const f = fixture(t)
  for (const migrations of [
    undefined,
    [],
    ["not-a-version"],
    ["20260901000100", "20260901000100"],
  ]) {
    f.manifest.migrations = migrations
    f.save()
    assert.throws(f.verify, /migration/)
  }
  f.manifest.migrations = ["20260901000100"]
  delete f.manifest.counts.auth_users
  f.save()
  assert.throws(f.verify, /baseline is incomplete/)
})

test("completed verification includes recovery preparation and database verification in RTO", (t) => {
  const f = fixture(t)
  const lineage = f.verify()
  const db = { counts: f.manifest.counts, activeCronJobs: 0 }
  const result = completeRestoreEvidence(
    f.config,
    lineage,
    db,
    new Date("2026-09-01T10:30:00.000Z")
  )
  assert.equal(result.elapsedMinutes, 29)
  assert.equal(result.verifiedAt, "2026-09-01T10:30:00.000Z")
  assert.throws(
    () =>
      completeRestoreEvidence(
        f.config,
        lineage,
        db,
        new Date("2026-09-01T10:31:01.000Z")
      ),
    /exceeded/
  )
  assert.throws(
    () =>
      completeRestoreEvidence(
        f.config,
        lineage,
        { ...db, counts: { ...db.counts, stamps: "0" } },
        new Date("2026-09-01T10:30:00.000Z")
      ),
    /counts differ/
  )
  assert.throws(
    () =>
      completeRestoreEvidence(
        f.config,
        lineage,
        { ...db, activeCronJobs: 1 },
        new Date("2026-09-01T10:30:00.000Z")
      ),
    /isolation/
  )
})

test("restore evidence rejects backwards, future and shortened recovery timelines", (t) => {
  const f = fixture(t)
  f.config.recoveryStartedAt = "2026-09-01T10:04:00.000Z"
  assert.throws(f.verify, /recovery start follows/)
  f.config.recoveryStartedAt = "2026-09-01T10:01:00.000Z"
  f.lineage.completedAt = "2026-09-01T10:26:00.000Z"
  f.save()
  assert.throws(f.verify, /future/)
  f.lineage.completedAt = "2026-09-01T10:04:00.000Z"
  f.save()
  assert.throws(f.verify, /target created after/)
})

test("restore runner checks completion time after database verification and closes its connection on RTO failure", async (t) => {
  const f = fixture(t)
  const source = "skonlhwstejberyzobep"
  const target = "abcdefghijklmnopqrst"
  f.manifest.sourceProjectRef = source
  f.lineage.sourceProjectRef = source
  f.lineage.restoreProjectRef = target
  f.save()
  const backupsFile = `${f.config.lineageFile}.backups`
  const projectsFile = `${f.config.lineageFile}.projects`
  writeFileSync(
    backupsFile,
    JSON.stringify({
      region: "eu-west-2",
      walg_enabled: true,
      backups: [
        {
          id: 123,
          inserted_at: f.manifest.backupAt,
          status: "COMPLETED",
          is_physical_backup: true,
        },
      ],
    })
  )
  writeFileSync(
    projectsFile,
    JSON.stringify([
      { ref: source, organization_id: "org" },
      {
        ref: target,
        organization_id: "org",
        region: "eu-west-2",
        status: "ACTIVE_HEALTHY",
        name: "nabaperks-restore-drill-fixture",
        created_at: "2026-09-01T10:05:00.000Z",
        database: { host: `db.${target}.supabase.co` },
      },
    ])
  )
  const env = {
    PRODUCTION_SUPABASE_PROJECT_REF: source,
    RESTORE_DRILL_PROJECT_REF: target,
    CONFIGURED_RESTORE_DRILL_PROJECT_REF: target,
    RESTORE_DRILL_CONFIRMATION: "VERIFY_NON_PRODUCTION_RESTORE",
    RESTORE_DRILL_BACKUP_ID: "123",
    RESTORE_DRILL_DB_URL: `postgresql://postgres:fixture@db.${target}.supabase.co/postgres`,
    RECOVERY_RTO_MINUTES: "30",
    RESTORE_DRILL_STARTED_AT: f.config.recoveryStartedAt,
    RESTORE_DRILL_LINEAGE_FILE: f.config.lineageFile,
    RESTORE_DRILL_LINEAGE_SHA256: f.config.lineageSha256,
    RESTORE_DRILL_SOURCE_MANIFEST_FILE: f.config.manifestFile,
    RESTORE_DRILL_SOURCE_MANIFEST_SHA256: f.config.manifestSha256,
    RESTORE_DRILL_BACKUPS_FILE: backupsFile,
    RESTORE_DRILL_PROJECTS_FILE: projectsFile,
  }
  let verified = false
  let closed = false
  await assert.rejects(
    runRestoreDrill({
      env,
      clock: () =>
        new Date(
          verified ? "2026-09-01T10:32:00.000Z" : "2026-09-01T10:25:00.000Z"
        ),
      connect: () => ({
        end: async () => {
          closed = true
        },
      }),
      verifyDatabase: async (_sql, migrations) => {
        assert.deepEqual(migrations, f.manifest.migrations)
        verified = true
        return { counts: f.manifest.counts, activeCronJobs: 0 }
      },
    }),
    /exceeded/
  )
  assert.equal(verified, true)
  assert.equal(closed, true)
})
