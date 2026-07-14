import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import {
  ensureMigrationLedger,
  parseMigrationVersion,
  planMigrationApply,
  readAppliedVersions,
  recordAppliedMigration,
} from "../../scripts/run-supabase-sql.mjs"
import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db migration ledger apply — the live-ledger half.
 *
 * The apply path is now ledger-aware: it reads applied versions from
 * supabase_migrations.schema_migrations, skips those files, and records the
 * ones it runs. These tests prove the audit's core guarantee against the real
 * ledger — a second apply is a no-op — plus the read/schedule/record
 * round-trip, all inside rolled-back transactions so the shared local DB is
 * never mutated.
 */

after(closeDb)

function localMigrationFiles() {
  const dir = join(process.cwd(), "supabase/migrations")
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, version: parseMigrationVersion(name) }))
}

test("a second apply against the fully-migrated database schedules no re-runs", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await ensureMigrationLedger(db())
  const appliedVersions = await readAppliedVersions(db())
  const applied = new Set(appliedVersions)
  const files = localMigrationFiles()

  const plan = planMigrationApply({
    files,
    appliedVersions,
    schemaProvisioned: true,
    force: false,
  })

  assert.equal(plan.blocked, false)

  // No file whose version is already recorded may be scheduled to re-run —
  // this is the audit's core guarantee regardless of exact ledger alignment.
  const reRuns = plan.toApply.filter((f) => f.version && applied.has(f.version))
  assert.deepEqual(reRuns, [], "already-applied migrations must not be re-applied")

  // The live local DB is provisioned CLI-first, so when every local version is
  // recorded the plan is empty — the literal no-op the audit asked for.
  const allRecorded = files.every((f) => f.version && applied.has(f.version))
  if (allRecorded) {
    assert.deepEqual(plan.toApply, [], "fully-migrated DB must schedule zero applies")
  }
})

test("a forgotten version is scheduled, and recording it makes the re-plan a no-op", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await inRolledBackTxn(async (tx) => {
    await ensureMigrationLedger(tx)

    // Reconstruct the "one migration not yet applied" state by forgetting a
    // real recorded version inside this rolled-back txn.
    const [{ version }] = await tx`
      select version from supabase_migrations.schema_migrations
      order by version desc limit 1`
    await tx`delete from supabase_migrations.schema_migrations where version = ${version}`

    const forgotten = await readAppliedVersions(tx)
    assert.ok(!forgotten.includes(version), "version should be forgotten")

    const files = localMigrationFiles()
    const plan = planMigrationApply({
      files,
      appliedVersions: forgotten,
      schemaProvisioned: true,
      force: false,
    })
    assert.ok(
      plan.toApply.some((f) => f.version === version),
      "the forgotten version must be scheduled to apply"
    )

    // Recording it (as the apply path does after running the file) returns the
    // ledger to a no-op.
    await recordAppliedMigration(tx, {
      version,
      name: "reconstructed",
      source: "-- reconstructed",
    })
    const restored = await readAppliedVersions(tx)
    assert.ok(restored.includes(version), "recording must re-add the version")

    const rePlan = planMigrationApply({
      files,
      appliedVersions: restored,
      schemaProvisioned: true,
      force: false,
    })
    assert.ok(
      !rePlan.toApply.some((f) => f.version === version),
      "the now-recorded version must be skipped"
    )
  })
})

test("recordAppliedMigration is a no-op on version conflict", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await inRolledBackTxn(async (tx) => {
    await ensureMigrationLedger(tx)
    const version = "20000101000000"
    await tx`delete from supabase_migrations.schema_migrations where version = ${version}`

    await recordAppliedMigration(tx, { version, name: "first", source: "-- first" })
    await recordAppliedMigration(tx, { version, name: "second", source: "-- second" })

    const [{ n }] = await tx`
      select count(*)::int as n from supabase_migrations.schema_migrations
      where version = ${version}`
    assert.equal(n, 1, "conflict must not insert a duplicate row")

    const [{ name }] = await tx`
      select name from supabase_migrations.schema_migrations where version = ${version}`
    assert.equal(name, "first", "on conflict do nothing keeps the first row")
  })
})
