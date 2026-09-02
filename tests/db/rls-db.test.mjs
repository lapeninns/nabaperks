import assert from "node:assert/strict"
import { test } from "node:test"

import postgres from "postgres"

import { dbUrl as configuredDbUrl } from "./helpers/db.mjs"

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

const prohibitedApiRolePrivileges = Object.freeze([
  "MAINTAIN",
  "REFERENCES",
  "TRIGGER",
  "TRUNCATE",
])

const apiRoles = Object.freeze(["anon", "authenticated", "service_role"])

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

test("all public application tables force RLS and deny API-role schema-management privileges", async () => {
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
    const unforcedTables = await sql`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and (not c.relrowsecurity or not c.relforcerowsecurity)
      order by c.relname
    `
    assert.equal(
      unforcedTables.length,
      0,
      `every public table must enable and force RLS; found: ${unforcedTables
        .map((row) => row.relname)
        .join(", ")}`
    )

    const unsafeGrants = await sql`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee = any(${apiRoles})
        and privilege_type = any(${prohibitedApiRolePrivileges})
      order by grantee, table_name, privilege_type
    `
    assert.equal(
      unsafeGrants.length,
      0,
      `API roles must not hold RLS-bypassing or schema-management table grants; found: ${unsafeGrants
        .map((row) => `${row.grantee}:${row.table_name}:${row.privilege_type}`)
        .join(", ")}`
    )

    const unsafeDefaultGrants = await sql`
      select owner.rolname as owner, grantee.rolname as grantee, acl.privilege_type
      from pg_default_acl defaults
      join pg_namespace namespace
        on namespace.oid = defaults.defaclnamespace
      join pg_roles owner
        on owner.oid = defaults.defaclrole
      cross join lateral aclexplode(defaults.defaclacl) acl
      join pg_roles grantee
        on grantee.oid = acl.grantee
      where namespace.nspname = 'public'
        and defaults.defaclobjtype = 'r'
        and owner.rolname = 'postgres'
        and grantee.rolname = any(${apiRoles})
        and acl.privilege_type = any(${prohibitedApiRolePrivileges})
      order by owner.rolname, grantee.rolname, acl.privilege_type
    `
    assert.equal(
      unsafeDefaultGrants.length,
      0,
      `public-table default ACLs must not grant prohibited privileges to API roles; found: ${unsafeDefaultGrants
        .map((row) => `${row.owner}:${row.grantee}:${row.privilege_type}`)
        .join(", ")}`
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
})

function resolveDbUrl() {
  return configuredDbUrl() ?? ""
}

function shouldRequireSsl() {
  return false
}
