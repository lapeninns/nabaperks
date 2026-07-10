import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import {
  isDatabaseConnectionRefused,
  printDatabaseConnectionHelp,
} from "./db-connection-help.mjs"

const projectDir = process.cwd()

// A migration file is "<14-digit version>_<name>.sql"; the version is the key
// the Supabase migration ledger (supabase_migrations.schema_migrations) tracks.
const MIGRATION_FILE_PATTERN = /^(\d{14})_.*\.sql$/

if (isMain()) {
  await main()
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const shouldApply = args.has("--apply")
  const shouldSeed = args.has("--seed")
  const shouldReset = args.has("--reset")
  const shouldResetCustomers = args.has("--reset-customers")
  const shouldResetTodayStamps = args.has("--reset-today-stamps")
  const shouldSeedPerfOwner = args.has("--seed-perf-owner")
  const force = args.has("--force")

  if (
    !shouldApply &&
    !shouldSeed &&
    !shouldReset &&
    !shouldResetCustomers &&
    !shouldResetTodayStamps
  ) {
    console.error(
      "Usage: node scripts/run-supabase-sql.mjs [--apply] [--seed] [--seed-perf-owner] [--reset] [--reset-customers] [--reset-today-stamps] [--force]"
    )
    process.exit(1)
  }

  const env = {
    ...readEnvFile(join(projectDir, ".env.local")),
    ...readEnvFile(join(projectDir, ".env")),
    ...process.env,
  }
  const dbUrl = resolveDbUrl(env)

  if (!dbUrl) {
    console.error(
      "A Supabase database connection is required for SQL migrations and seed data."
    )
    console.error(
      "Set SUPABASE_DB_URL, or set SUPABASE_DB_PASSWORD with the linked Supabase pooler metadata in supabase/.temp."
    )
    process.exit(1)
  }

  const destructive =
    shouldApply ||
    shouldSeed ||
    shouldReset ||
    shouldResetCustomers ||
    shouldResetTodayStamps
  assertWriteTargetIsSafe(dbUrl, destructive)

  const sql = postgres(dbUrl, {
    max: 1,
    ssl: shouldRequireSsl(dbUrl) ? "require" : undefined,
    transform: postgres.camel,
  })

  try {
    const target = safeDbTarget(dbUrl)
    await sql`select 1 as ok`
    console.log(`Connected to ${target}.`)

    if (shouldReset) {
      await runFile(sql, "supabase/reset.sql", "Database reset")
    }

    if (shouldResetCustomers) {
      await runFile(sql, "supabase/reset-customers.sql", "Customer data reset")
    }

    if (shouldResetTodayStamps) {
      await runFile(sql, "supabase/reset-today-stamps.sql", "Today stamp reset")
    }

    if (shouldApply) {
      await applyMigration(sql, { force })
    }

    if (shouldSeed) {
      await runFile(sql, "supabase/seed.sql", "Seed fixtures")
      await runFile(sql, "supabase/seed-activity-demo.sql", "Seed activity demo")
      await runOptionalFile(sql, "supabase/seed-user-aman.sql", "Seed user Aman")
      if (shouldSeedPerfOwner) {
        await runOptionalFile(
          sql,
          "supabase/seed-user-aman-plus32.sql",
          "Seed merchant Aman +32"
        )
      }
      await runFile(
        sql,
        "supabase/seed-two-of-three-stamps.sql",
        "Seed two of three stamps"
      )
      await runFile(
        sql,
        "supabase/seed-announcement-audience.sql",
        "Seed announcement audience"
      )
    }

    console.log("Supabase SQL workflow completed.")
  } catch (error) {
    if (isDatabaseConnectionRefused(error)) {
      printDatabaseConnectionHelp(
        safeDbTarget(dbUrl),
        "pnpm db:supabase:start && pnpm db:setup"
      )
      process.exit(1)
    }
    throw error
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/**
 * Apply pending migrations, ledger-aware. Reads the versions already recorded
 * in supabase_migrations.schema_migrations, skips those files, and records
 * every file it runs — matching what `supabase db reset`/`db push` do, so a
 * second invocation is a no-op instead of replaying one-shot data transforms.
 */
async function applyMigration(sql, { force = false } = {}) {
  await ensureMigrationLedger(sql)

  const files = readdirSync(join(projectDir, "supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, version: parseMigrationVersion(name) }))

  const appliedVersions = await readAppliedVersions(sql)
  const schemaProvisioned = await isSchemaProvisioned(sql)

  const plan = planMigrationApply({
    files,
    appliedVersions,
    schemaProvisioned,
    force,
  })

  if (plan.blocked) {
    console.error(
      "Refusing to apply: the migration ledger is empty but this database is already provisioned."
    )
    console.error(
      "It was set up outside the ledger. Run `supabase db reset` to rebuild it ledger-first, or pass --force to re-apply every migration (disposable databases only)."
    )
    process.exit(1)
  }

  for (const file of plan.skipped) {
    console.log(`Already applied; skipping: ${file.name}`)
  }

  for (const file of plan.toApply) {
    const path = `supabase/migrations/${file.name}`
    const source = readFileSync(join(projectDir, path), "utf8")
    await applySql(sql, source, `Migration ${file.name}`, path)

    if (file.version) {
      await recordAppliedMigration(sql, {
        version: file.version,
        name: migrationName(file.name),
        source,
      })
    } else {
      console.warn(
        `Applied ${file.name} but it has no 14-digit version prefix; not recording it in the ledger.`
      )
    }
  }
}

/** The 14-digit ledger version of a migration file, or null when it has none. */
export function parseMigrationVersion(fileName) {
  return fileName.match(MIGRATION_FILE_PATTERN)?.[1] ?? null
}

/** The ledger `name` column: the file minus its "<version>_" prefix and ".sql". */
function migrationName(fileName) {
  return fileName.replace(/^\d{14}_/, "").replace(/\.sql$/, "")
}

/**
 * Decide which migration files to run against a database whose ledger already
 * holds `appliedVersions`. Pure — no I/O — so the skip/apply/guard branches are
 * unit-testable. Returns { blocked, reason, toApply, skipped }.
 *
 * - A file whose version is already recorded is skipped (the no-op guarantee).
 * - A file with no parseable version can't be tracked, so it is always applied.
 * - `force` ignores the ledger entirely and re-applies everything.
 * - A provisioned schema with an empty ledger and no `force` is blocked: it was
 *   set up outside the ledger, so re-running one-shot migrations is unsafe.
 */
export function planMigrationApply({
  files,
  appliedVersions,
  schemaProvisioned = false,
  force = false,
}) {
  const applied = new Set(appliedVersions)

  if (!force && schemaProvisioned && applied.size === 0) {
    return {
      blocked: true,
      reason: "schema-without-ledger",
      toApply: [],
      skipped: [],
    }
  }

  const toApply = []
  const skipped = []

  for (const file of files) {
    const alreadyApplied = !force && file.version && applied.has(file.version)
    if (alreadyApplied) skipped.push(file)
    else toApply.push(file)
  }

  return { blocked: false, reason: null, toApply, skipped }
}

/**
 * Create the Supabase migration ledger if it is absent, matching the CLI's
 * shape so a `create table if not exists` never clobbers a CLI-created table.
 * `executor` is the pooled `sql` or a transaction handle.
 */
export async function ensureMigrationLedger(executor) {
  // Skip the DDL when the ledger already exists (the normal case) so the
  // common path emits no "already exists, skipping" notices.
  const [row] = await executor`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists
  `
  if (row?.exists) return

  await executor.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `)
}

/** Versions already recorded in the ledger, as an array of strings. */
export async function readAppliedVersions(executor) {
  const rows = await executor`
    select version from supabase_migrations.schema_migrations
  `
  return rows.map((row) => row.version)
}

/**
 * Record an applied migration in the ledger. `statements` is stored as a
 * single-element array of the file source — enough for fidelity; no consumer
 * parses it, so the CLI's per-statement splitter is not re-implemented. The
 * insert is a no-op when the version is already recorded.
 */
export async function recordAppliedMigration(executor, { version, name, source }) {
  await executor`
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values (${version}, ${name ?? null}, array[${source ?? ""}]::text[])
    on conflict (version) do nothing
  `
}

/** Whether the public schema is already provisioned (proxy: product_events). */
async function isSchemaProvisioned(executor) {
  const [row] = await executor`
    select to_regclass('public.product_events') is not null as exists
  `
  return Boolean(row?.exists)
}

async function runFile(sql, path, label) {
  const source = readFileSync(join(projectDir, path), "utf8")
  await applySql(sql, source, label, path)
}

async function runOptionalFile(sql, path, label) {
  const source = readFileSync(join(projectDir, path), "utf8")

  try {
    await sql.unsafe(source)
    console.log(`${label} passed: ${path}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`${label} skipped: ${path} (${message})`)
  }
}

async function applySql(sql, source, label, path) {
  try {
    await sql.unsafe(source)
    console.log(`${label} passed: ${path}`)
  } catch (error) {
    console.error(`${label} failed: ${path}`)
    if (error instanceof Error) {
      console.error(error.message)
    }
    process.exitCode = 1
    throw error
  }
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const parsed = {}

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")

    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}

function resolveDbUrl(env) {
  const explicitUrl = env.SUPABASE_DB_URL?.trim()

  if (explicitUrl) return explicitUrl

  const password = env.SUPABASE_DB_PASSWORD?.trim()
  const poolerUrlPath = join(projectDir, "supabase/.temp/pooler-url")

  if (!password || !existsSync(poolerUrlPath)) return ""

  try {
    const url = new URL(readFileSync(poolerUrlPath, "utf8").trim())
    url.password = password
    return url.toString()
  } catch {
    return ""
  }
}

function shouldRequireSsl(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return isSupabaseHost(url.hostname)
  } catch {
    return false
  }
}

function isSupabaseHost(hostname) {
  const host = hostname.toLowerCase()
  return host === "supabase.com" || host.endsWith(".supabase.com")
}

function safeDbTarget(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`
  } catch {
    return "configured database"
  }
}

// Fail-safe: refuse write-risk operations (--apply/--seed/--reset*) against a
// non-local database so routine commands can never mutate a hosted project.
function assertWriteTargetIsSafe(dbUrl, destructive) {
  if (!destructive) return
  if (isLocalDbHost(dbUrl)) return

  console.error(
    `Refusing to run write-risk operations (--apply/--seed/--reset*) against non-local host "${dbHostLabel(dbUrl)}".`
  )
  console.error(
    "Point SUPABASE_DB_URL at a local disposable database before running this command."
  )
  process.exit(1)
}

function isLocalDbHost(dbUrl) {
  try {
    const host = new URL(dbUrl).hostname.toLowerCase()
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  } catch {
    return false
  }
}

function dbHostLabel(dbUrl) {
  try {
    return new URL(dbUrl).hostname || "unknown host"
  } catch {
    return "unparseable connection URL"
  }
}

function isMain() {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
}
