import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

import {
  isDatabaseConnectionRefused,
  printDatabaseConnectionHelp,
} from "./db-connection-help.mjs"

const projectDir = process.cwd()
const args = new Set(process.argv.slice(2))
const shouldApply = args.has("--apply")
const shouldSeed = args.has("--seed")
const shouldReset = args.has("--reset")
const shouldResetCustomers = args.has("--reset-customers")
const shouldResetTodayStamps = args.has("--reset-today-stamps")
const force = args.has("--force")

if (
  !shouldApply &&
  !shouldSeed &&
  !shouldReset &&
  !shouldResetCustomers &&
  !shouldResetTodayStamps
) {
  console.error(
    "Usage: node scripts/run-supabase-sql.mjs [--apply] [--seed] [--reset] [--reset-customers] [--reset-today-stamps] [--force]"
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

assertWriteTargetIsSafe(dbUrl)

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
    await runFile("supabase/reset.sql", "Database reset")
  }

  if (shouldResetCustomers) {
    await runFile("supabase/reset-customers.sql", "Customer data reset")
  }

  if (shouldResetTodayStamps) {
    await runFile("supabase/reset-today-stamps.sql", "Today stamp reset")
  }

  if (shouldApply) {
    await applyMigration()
  }

  if (shouldSeed) {
    await runFile("supabase/seed.sql", "Seed fixtures")
    await runFile("supabase/seed-activity-demo.sql", "Seed activity demo")
    await runOptionalFile("supabase/seed-user-aman.sql", "Seed user Aman")
    await runOptionalFile(
      "supabase/seed-user-aman-plus32.sql",
      "Seed merchant Aman +32"
    )
    await runFile(
      "supabase/seed-two-of-three-stamps.sql",
      "Seed two of three stamps"
    )
    await runFile(
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

async function applyMigration() {
  const migrationFiles = readdirSync(join(projectDir, "supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()

  const [{ exists }] = await sql`
    select to_regclass('public.product_events') is not null as exists
  `

  for (const file of migrationFiles) {
    const path = `supabase/migrations/${file}`
    const isInitialMigration = file === "20260606142000_initial_schema_rls.sql"

    if (isInitialMigration && exists && !force) {
      console.log(
        "Initial migration appears to be applied already; skipping. Use --force only for disposable databases."
      )
      continue
    }

    await runFile(path, `Migration ${file}`)
  }
}

async function runFile(path, label) {
  const source = readFileSync(join(projectDir, path), "utf8")

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

async function runOptionalFile(path, label) {
  const source = readFileSync(join(projectDir, path), "utf8")

  try {
    await sql.unsafe(source)
    console.log(`${label} passed: ${path}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`${label} skipped: ${path} (${message})`)
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
    return url.hostname.endsWith("supabase.com")
  } catch {
    return false
  }
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
function assertWriteTargetIsSafe(dbUrl) {
  const destructive =
    shouldApply ||
    shouldSeed ||
    shouldReset ||
    shouldResetCustomers ||
    shouldResetTodayStamps
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
