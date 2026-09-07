import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  assertRestoreDatabaseUrl,
  loadRestoreEvidence,
  resolveRestoreDrillConfig,
} from "../../scripts/check-restored-backup.mjs"

const TARGET_REF = "abcdefghijklmnopqrst"
const ENV = {
  CONFIGURED_RESTORE_DRILL_PROJECT_REF: TARGET_REF,
  PRODUCTION_SUPABASE_PROJECT_REF: "skonlhwstejberyzobep",
  RECOVERY_RTO_MINUTES: "30",
  RESTORE_DRILL_BACKUP_ID: "1178567050",
  RESTORE_DRILL_BACKUPS_FILE: "backups.json",
  RESTORE_DRILL_STARTED_AT: "2026-07-22T10:02:00.000Z",
  RESTORE_DRILL_LINEAGE_FILE: "lineage.json",
  RESTORE_DRILL_LINEAGE_SHA256: "a".repeat(64),
  RESTORE_DRILL_SOURCE_MANIFEST_FILE: "manifest.json",
  RESTORE_DRILL_SOURCE_MANIFEST_SHA256: "b".repeat(64),
  RESTORE_DRILL_CONFIRMATION: "VERIFY_NON_PRODUCTION_RESTORE",
  RESTORE_DRILL_DB_URL: `postgresql://postgres.${TARGET_REF}:password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`,
  RESTORE_DRILL_PROJECT_REF: TARGET_REF,
  RESTORE_DRILL_PROJECTS_FILE: "projects.json",
}

test("restore drill config pins a protected non-production Supabase target", () => {
  const config = resolveRestoreDrillConfig(ENV, "/workspace")
  assert.equal(config.projectRef, TARGET_REF)
  assert.equal(config.sourceProjectRef, "skonlhwstejberyzobep")
  assert.equal(config.rtoMinutes, 30)

  assert.throws(
    () =>
      resolveRestoreDrillConfig({
        ...ENV,
        RESTORE_DRILL_PROJECT_REF: "skonlhwstejberyzobep",
        CONFIGURED_RESTORE_DRILL_PROJECT_REF: "skonlhwstejberyzobep",
      }),
    /never target production/
  )
  assert.throws(
    () =>
      resolveRestoreDrillConfig({
        ...ENV,
        CONFIGURED_RESTORE_DRILL_PROJECT_REF: "zyxwvutsrqponmlkjihg",
      }),
    /protected environment/
  )
})

test("restore provider evidence ties a recent physical backup to a fresh same-region project", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "nabaperks-restore-test-"))
  t.after(() => rmSync(root, { force: true, recursive: true }))
  mkdirSync(path.join(root, "supabase", "migrations"), { recursive: true })
  writeFileSync(
    path.join(root, "supabase", "migrations", "20260722090000_before.sql"),
    "select 1;"
  )
  writeFileSync(
    path.join(root, "supabase", "migrations", "20260722110000_after.sql"),
    "select 1;"
  )

  const now = new Date("2026-07-22T10:30:00.000Z")
  writeFileSync(
    path.join(root, "backups.json"),
    JSON.stringify({
      backups: [
        {
          id: 1178567050,
          inserted_at: "2026-07-22T10:00:00.000Z",
          is_physical_backup: true,
          status: "COMPLETED",
        },
      ],
      region: "eu-west-2",
      walg_enabled: true,
    })
  )
  writeFileSync(
    path.join(root, "projects.json"),
    JSON.stringify([
      {
        ref: "skonlhwstejberyzobep",
        organization_id: "org-production",
        region: "eu-west-2",
      },
      {
        ref: TARGET_REF,
        name: "nabaperks-restore-drill-20260722",
        organization_id: "org-production",
        region: "eu-west-2",
        status: "ACTIVE_HEALTHY",
        created_at: "2026-07-22T10:05:00.000Z",
        database: { host: `db.${TARGET_REF}.supabase.co` },
      },
    ])
  )

  const manifest = {
    schema: "nabaperks.backup-source-manifest.v1",
    sourceProjectRef: ENV.PRODUCTION_SUPABASE_PROJECT_REF,
    backupId: ENV.RESTORE_DRILL_BACKUP_ID,
    backupAt: "2026-07-22T10:00:00.000Z",
    migrations: ["20260722110000"],
    counts: {
      auth_users: "1",
      memberships: "1",
      merchants: "1",
      rewards: "0",
      stamps: "1",
    },
    invariants: { activeCronJobs: 0 },
  }
  const manifestBytes = JSON.stringify(manifest)
  const manifestSha256 = createHash("sha256")
    .update(manifestBytes)
    .digest("hex")
  writeFileSync(path.join(root, "manifest.json"), manifestBytes)
  const lineageBytes = JSON.stringify({
    schema: "nabaperks.restore-lineage.v1",
    sourceProjectRef: manifest.sourceProjectRef,
    backupId: manifest.backupId,
    backupAt: manifest.backupAt,
    restoreProjectRef: TARGET_REF,
    sourceManifestSha256: manifestSha256,
    providerOperationId: "restore-123",
    status: "COMPLETED",
    startedAt: "2026-07-22T10:03:00.000Z",
    completedAt: "2026-07-22T10:15:00.000Z",
  })
  writeFileSync(path.join(root, "lineage.json"), lineageBytes)
  const config = resolveRestoreDrillConfig(
    {
      ...ENV,
      RESTORE_DRILL_SOURCE_MANIFEST_SHA256: manifestSha256,
      RESTORE_DRILL_LINEAGE_SHA256: createHash("sha256")
        .update(lineageBytes)
        .digest("hex"),
    },
    root
  )
  const evidence = loadRestoreEvidence(config, now)
  assert.deepEqual(evidence.expectedMigrations, ["20260722110000"])
  assert.equal(evidence.startedAt.toISOString(), ENV.RESTORE_DRILL_STARTED_AT)
})

test("restore drill database URL must identify the disposable target", () => {
  assert.doesNotThrow(() =>
    assertRestoreDatabaseUrl(
      `postgresql://postgres:password@db.${TARGET_REF}.supabase.co:5432/postgres`,
      TARGET_REF
    )
  )
  assert.throws(
    () =>
      assertRestoreDatabaseUrl(
        "postgresql://postgres:password@db.skonlhwstejberyzobep.supabase.co:5432/postgres",
        TARGET_REF
      ),
    /restore project/
  )
  assert.throws(
    () =>
      assertRestoreDatabaseUrl(
        `postgresql://postgres.${TARGET_REF}:password@localhost:5432/postgres`,
        TARGET_REF
      ),
    /restore project/
  )
})
