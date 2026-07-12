import assert from "node:assert/strict"
import { test } from "node:test"

import postgres from "postgres"

const dbUrl =
  process.env.SUPABASE_DB_URL ??
  "postgres://postgres:postgres@127.0.0.1:54322/postgres"

test("Given the readiness RPC When roles are inspected Then only service role can execute the data-free probe", async () => {
  const sql = postgres(dbUrl, { max: 1 })

  try {
    const [
      {
        anon_can_execute,
        authenticated_can_execute,
        public_can_execute,
        service_role_can_execute,
      },
    ] = await sql`
      select
        has_function_privilege(
          'anon',
          'public.production_readiness_probe()',
          'execute'
        ) as anon_can_execute,
        has_function_privilege(
          'public',
          'public.production_readiness_probe()',
          'execute'
        ) as public_can_execute,
        has_function_privilege(
          'authenticated',
          'public.production_readiness_probe()',
          'execute'
        ) as authenticated_can_execute,
        has_function_privilege(
          'service_role',
          'public.production_readiness_probe()',
          'execute'
        ) as service_role_can_execute
    `

    assert.equal(anon_can_execute, false)
    assert.equal(authenticated_can_execute, false)
    assert.equal(public_can_execute, false)
    assert.equal(service_role_can_execute, true)

    await sql`set role service_role`
    const [{ ready }] = await sql`
      select public.production_readiness_probe() as ready
    `

    assert.equal(ready, true)
  } finally {
    await sql`reset role`.catch(() => undefined)
    await sql.end({ timeout: 5 })
  }
})
