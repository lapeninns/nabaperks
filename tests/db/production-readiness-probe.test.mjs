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

test("Given operational ledgers When cron outcomes are recorded Then only service role receives data-free health aggregates", async () => {
  const sql = postgres(dbUrl, { max: 1 })
  const startedAt = new Date()
  const firstFailureAt = new Date(startedAt.getTime() + 1)
  const secondFailureAt = new Date(startedAt.getTime() + 2)
  const successAt = new Date(startedAt.getTime() + 3)

  try {
    const [privileges] = await sql`
      select
        has_function_privilege(
          'anon',
          'public.production_operational_signals()',
          'execute'
        ) as anon_can_read,
        has_function_privilege(
          'authenticated',
          'public.production_operational_signals()',
          'execute'
        ) as authenticated_can_read,
        has_function_privilege(
          'service_role',
          'public.production_operational_signals()',
          'execute'
        ) as service_role_can_read,
        has_function_privilege(
          'service_role',
          'public.record_operational_cron_run(text,boolean,timestamp with time zone,timestamp with time zone,integer,text)',
          'execute'
        ) as service_role_can_record
    `
    assert.equal(privileges.anon_can_read, false)
    assert.equal(privileges.authenticated_can_read, false)
    assert.equal(privileges.service_role_can_read, true)
    assert.equal(privileges.service_role_can_record, true)

    await sql`set role service_role`
    await sql`
      select public.record_operational_cron_run(
        'notifications',
        false,
        ${startedAt},
        ${firstFailureAt},
        1,
        'test_failure'
      )
    `
    await sql`
      select public.record_operational_cron_run(
        'notifications',
        false,
        ${firstFailureAt},
        ${secondFailureAt},
        1,
        'test_failure'
      )
    `
    const [{ signals: failedSignals }] = await sql`
      select public.production_operational_signals() as signals
    `
    const failedJob = failedSignals.cronJobs.find(
      ({ name }) => name === "notifications"
    )
    assert.equal(failedJob.state, "failing")
    assert.ok(failedJob.consecutiveFailures >= 2)
    assert.equal(typeof failedSignals.notificationQueueAgeMinutes, "number")
    assert.equal(typeof failedSignals.referralBonusBacklogCount, "number")
    assert.equal(typeof failedSignals.referralBonusBacklogAgeMinutes, "number")
    assert.equal(typeof failedSignals.providerDeliveryFailureRate24h, "number")

    await sql`
      select public.record_operational_cron_run(
        'notifications',
        true,
        ${secondFailureAt},
        ${successAt},
        1,
        null
      )
    `
    const [{ signals: recoveredSignals }] = await sql`
      select public.production_operational_signals() as signals
    `
    const recoveredJob = recoveredSignals.cronJobs.find(
      ({ name }) => name === "notifications"
    )
    assert.equal(recoveredJob.state, "ok")
    assert.equal(recoveredJob.consecutiveFailures, 0)
  } finally {
    await sql`reset role`.catch(() => undefined)
    await sql`
      delete from public.operational_cron_runs
      where started_at in (${startedAt}, ${firstFailureAt}, ${secondFailureAt})
    `.catch(() => undefined)
    await sql.end({ timeout: 5 })
  }
})
