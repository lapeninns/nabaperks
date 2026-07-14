import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const requiredRlsTables = Object.freeze([
  "audit_logs",
  "billing_customers",
  "customer_memberships",
  "customers",
  "loyalty_cards",
  "merchants",
  "product_events",
  "qr_codes",
  "reward_events",
  "stamp_events",
])

test("Given a live Supabase database When the RLS proof runs Then core tables enforce RLS", async () => {
  const dbUrl = resolveDbUrl()

  assert.notEqual(
    dbUrl,
    "",
    "SUPABASE_DB_URL is required for pnpm test:db; this gate is live DB proof, not a static SQL check."
  )

  const sql = postgres(dbUrl, {
    max: 1,
    ssl: shouldRequireSsl(dbUrl) ? "require" : undefined,
  })

  try {
    const tableRows = await sql`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname = any(${requiredRlsTables})
      order by c.relname
    `

    const tableState = new Map(
      tableRows.map((row) => [
        row.relname,
        {
          forceRls: row.relforcerowsecurity,
          rls: row.relrowsecurity,
        },
      ])
    )

    assert.deepEqual(
      [...tableState.keys()],
      [...requiredRlsTables].sort(),
      "The live database must contain the core RLS-governed tables."
    )

    for (const table of requiredRlsTables) {
      const state = tableState.get(table)

      assert.equal(state?.rls, true, `${table} must enable row-level security.`)
      assert.equal(
        state?.forceRls,
        true,
        `${table} must force row-level security.`
      )
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
})

function resolveDbUrl() {
  const env = {
    ...readEnvFile(path.join(projectRoot, ".env.local")),
    ...readEnvFile(path.join(projectRoot, ".env")),
    ...process.env,
  }

  return env.SUPABASE_DB_URL?.trim() ?? ""
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const values = {}

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

    values[key] = value
  }

  return values
}

function shouldRequireSsl(dbUrl) {
  try {
    const url = new URL(dbUrl)

    const hostname = url.hostname.toLowerCase()

    return hostname === "supabase.com" || hostname.endsWith(".supabase.com")
  } catch {
    return false
  }
}
