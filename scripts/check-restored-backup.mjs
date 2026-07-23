import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import postgres from "postgres"

const PRODUCTION_PROJECT_REF = "skonlhwstejberyzobep"
const REQUIRED_TABLES = [
  "customer_memberships",
  "loyalty_cards",
  "merchants",
  "notification_events",
  "reward_events",
  "stamp_events",
  "stripe_webhook_events",
]
const REQUIRED_FUNCTIONS = [
  "issue_self_service_stamp",
  "join_customer_membership_with_first_stamp",
  "production_readiness_probe",
]

function required(env, name) {
  const value = env[name]?.trim()
  assert.ok(value, `${name} is required`)
  return value
}

export function resolveRestoreDrillConfig(
  env = process.env,
  root = process.cwd()
) {
  const sourceProjectRef = required(env, "PRODUCTION_SUPABASE_PROJECT_REF")
  assert.equal(
    sourceProjectRef,
    PRODUCTION_PROJECT_REF,
    "unexpected production Supabase project ref"
  )

  const projectRef = required(env, "RESTORE_DRILL_PROJECT_REF")
  const configuredProjectRef = required(
    env,
    "CONFIGURED_RESTORE_DRILL_PROJECT_REF"
  )
  assert.match(projectRef, /^[a-z\d]{20}$/, "invalid restore project ref")
  assert.equal(
    projectRef,
    configuredProjectRef,
    "restore project ref does not match the protected environment"
  )
  assert.notEqual(
    projectRef,
    sourceProjectRef,
    "restore drill must never target production"
  )

  assert.equal(
    required(env, "RESTORE_DRILL_CONFIRMATION"),
    "VERIFY_NON_PRODUCTION_RESTORE",
    "restore drill confirmation is invalid"
  )

  const backupId = required(env, "RESTORE_DRILL_BACKUP_ID")
  assert.match(backupId, /^\d+$/, "backup ID must be numeric")

  const dbUrl = required(env, "RESTORE_DRILL_DB_URL")
  assertRestoreDatabaseUrl(dbUrl, projectRef)

  const rtoMinutes = Number(required(env, "RECOVERY_RTO_MINUTES"))
  assert.ok(
    Number.isInteger(rtoMinutes) && rtoMinutes >= 5 && rtoMinutes <= 240,
    "RECOVERY_RTO_MINUTES must be between 5 and 240"
  )

  return {
    backupId,
    backupsFile: path.resolve(
      root,
      required(env, "RESTORE_DRILL_BACKUPS_FILE")
    ),
    dbUrl,
    projectRef,
    projectsFile: path.resolve(
      root,
      required(env, "RESTORE_DRILL_PROJECTS_FILE")
    ),
    root,
    rtoMinutes,
    sourceProjectRef,
  }
}

export function assertRestoreDatabaseUrl(rawUrl, projectRef) {
  const url = new URL(rawUrl)
  assert.match(
    url.protocol,
    /^postgres(?:ql)?:$/,
    "restore DB URL must use PostgreSQL"
  )
  assert.ok(url.password, "restore DB URL must include a password")
  assert.equal(url.pathname, "/postgres", "restore DB URL must target postgres")
  assert.equal(
    url.search,
    "",
    "restore DB URL must not include query parameters"
  )
  assert.equal(url.hash, "", "restore DB URL must not include a fragment")

  const direct =
    url.hostname === `db.${projectRef}.supabase.co` &&
    url.username === "postgres"
  const pooler =
    /^[a-z\d-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
    url.username === `postgres.${projectRef}`
  assert.ok(
    direct || pooler,
    "restore DB URL must identify the restore project"
  )
}

export function loadRestoreEvidence(config, now = new Date()) {
  const backupDocument = JSON.parse(readFileSync(config.backupsFile, "utf8"))
  const projects = JSON.parse(readFileSync(config.projectsFile, "utf8"))
  assert.ok(
    Array.isArray(backupDocument.backups),
    "backup evidence is malformed"
  )
  assert.ok(Array.isArray(projects), "project evidence is malformed")
  assert.equal(
    backupDocument.region,
    "eu-west-2",
    "backup region is not EU West 2"
  )
  assert.equal(
    backupDocument.walg_enabled,
    true,
    "WAL-G backups are not enabled"
  )

  const backup = backupDocument.backups.find(
    ({ id }) => String(id) === config.backupId
  )
  assert.ok(backup, "selected backup is not available")
  assert.equal(backup.status, "COMPLETED", "selected backup is incomplete")
  assert.equal(
    backup.is_physical_backup,
    true,
    "selected backup is not physical"
  )

  const backupAt = new Date(backup.inserted_at)
  assert.ok(Number.isFinite(backupAt.getTime()), "backup timestamp is invalid")
  const backupAgeMs = now.getTime() - backupAt.getTime()
  assert.ok(backupAgeMs >= 0, "backup timestamp is in the future")
  assert.ok(
    backupAgeMs <= 8 * 86_400_000,
    "selected backup is older than eight days"
  )

  const source = projects.find(({ ref }) => ref === config.sourceProjectRef)
  const target = projects.find(({ ref }) => ref === config.projectRef)
  assert.ok(source, "production project is missing from provider evidence")
  assert.ok(target, "restore project is missing from provider evidence")
  assert.equal(
    target.status,
    "ACTIVE_HEALTHY",
    "restore project is not healthy"
  )
  assert.equal(
    target.region,
    backupDocument.region,
    "restore region does not match backup"
  )
  assert.equal(
    target.organization_id,
    source.organization_id,
    "restore project is outside the production organisation"
  )
  assert.match(
    target.name,
    /^nabaperks-restore-drill-/,
    "restore project name must use the recovery-drill prefix"
  )
  assert.equal(
    target.database?.host,
    `db.${config.projectRef}.supabase.co`,
    "restore database host does not match its project ref"
  )

  const targetCreatedAt = new Date(target.created_at)
  assert.ok(
    targetCreatedAt.getTime() >= backupAt.getTime(),
    "restore project predates the selected backup"
  )
  const elapsedMinutes = (now.getTime() - targetCreatedAt.getTime()) / 60_000
  assert.ok(elapsedMinutes >= 0, "restore project timestamp is in the future")
  assert.ok(
    elapsedMinutes <= config.rtoMinutes,
    `restore verification exceeded the ${config.rtoMinutes}-minute RTO`
  )

  return {
    backup,
    backupAt,
    elapsedMinutes,
    expectedMigrations: migrationVersionsAt(config.root, backupAt),
    target,
  }
}

export function migrationVersionsAt(root, cutoff) {
  const cutoffVersion = cutoff
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14)
  return readdirSync(path.join(root, "supabase", "migrations"))
    .map((filename) => filename.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter((version) => version && version <= cutoffVersion)
    .sort()
}

export async function verifyRestoredDatabase(sql, expectedMigrations) {
  return sql.begin(async (tx) => {
    await tx`set transaction read only`
    const [{ transaction_read_only: readOnly }] =
      await tx`show transaction_read_only`
    assert.equal(readOnly, "on", "restore verification transaction is writable")

    const migrations = await tx`
      select version from supabase_migrations.schema_migrations order by version
    `
    assert.deepEqual(
      migrations.map(({ version }) => version),
      expectedMigrations,
      "restored migration ledger does not match the selected backup time"
    )

    const tables = await tx`
      select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any(${REQUIRED_TABLES})
      order by c.relname
    `
    assert.deepEqual(
      tables.map(({ name }) => name),
      [...REQUIRED_TABLES].sort(),
      "restored core tables are incomplete"
    )
    assert.ok(
      tables.every(({ rls, force_rls: forceRls }) => rls && forceRls),
      "restored core tables must retain forced RLS"
    )

    const functions = await tx`
      select distinct p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any(${REQUIRED_FUNCTIONS})
      order by p.proname
    `
    assert.deepEqual(
      functions.map(({ name }) => name),
      [...REQUIRED_FUNCTIONS].sort(),
      "restored core RPCs are incomplete"
    )

    const [{ invalid_constraints: invalidConstraints }] = await tx`
      select count(*)::integer as invalid_constraints
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and not c.convalidated
    `
    assert.equal(
      invalidConstraints,
      0,
      "restored public constraints are invalid"
    )

    const [{ invalid_indexes: invalidIndexes }] = await tx`
      select count(*)::integer as invalid_indexes
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not i.indisvalid
    `
    assert.equal(invalidIndexes, 0, "restored public indexes are invalid")

    const [{ has_cron: hasCron }] =
      await tx`select to_regclass('cron.job') is not null as has_cron`
    let activeCronJobs = 0
    if (hasCron) {
      const [{ active_cron_jobs: activeCount }] =
        await tx`select count(*)::integer as active_cron_jobs from cron.job where active`
      activeCronJobs = activeCount
    }
    assert.equal(
      activeCronJobs,
      0,
      "restored project still has active database cron jobs"
    )

    const [counts] = await tx`
      select
        (select count(*) from public.merchants)::text as merchants,
        (select count(*) from public.customer_memberships)::text as memberships,
        (select count(*) from public.stamp_events)::text as stamps,
        (select count(*) from public.reward_events)::text as rewards,
        (select count(*) from auth.users)::text as auth_users
    `

    return { activeCronJobs, counts, migrationCount: migrations.length }
  })
}

export async function runRestoreDrill({
  env = process.env,
  now = new Date(),
} = {}) {
  const config = resolveRestoreDrillConfig(env)
  const providerEvidence = loadRestoreEvidence(config, now)
  const sql = postgres(config.dbUrl, {
    max: 1,
    ssl: "require",
    connect_timeout: 10,
    idle_timeout: 2,
    prepare: false,
  })

  try {
    const databaseEvidence = await verifyRestoredDatabase(
      sql,
      providerEvidence.expectedMigrations
    )
    return {
      schema: "nabaperks.restore-drill-evidence.v1",
      sourceProjectRef: config.sourceProjectRef,
      restoreProjectRef: config.projectRef,
      backupId: config.backupId,
      backupAt: providerEvidence.backupAt.toISOString(),
      verifiedAt: now.toISOString(),
      elapsedMinutes: Number(providerEvidence.elapsedMinutes.toFixed(2)),
      region: providerEvidence.target.region,
      ...databaseEvidence,
    }
  } finally {
    await sql.end({ timeout: 2 })
  }
}

async function main() {
  console.log(JSON.stringify(await runRestoreDrill(), null, 2))
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "restore drill failed"
    )
    process.exitCode = 1
  })
}
