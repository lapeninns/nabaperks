import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db merchant analytics rpcs — live-DB proof.
 *
 * The merchant dashboard series and activity summary must come from SQL-side
 * aggregation whose results stay exact past PostgREST's 1,000-row response
 * cap, with service-role-only ACL and merchant-ownership defense in depth.
 */

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710091000_merchant_analytics_rpcs.sql"
)

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "both aggregation RPCs exist with service-role-only ACL",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const rows = await tx`
      select
        proname,
        prosecdef,
        provolatile,
        has_function_privilege('service_role', oid, 'execute') as service_role_can_execute,
        has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
        has_function_privilege('anon', oid, 'execute') as anon_can_execute
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in ('get_merchant_dashboard_series', 'get_merchant_activity_event_counts')
      order by proname
    `
      assert.equal(
        rows.length,
        2,
        "get_merchant_dashboard_series and get_merchant_activity_event_counts must exist (RED until the migration lands)"
      )
      for (const row of rows) {
        assert.equal(
          row.prosecdef,
          true,
          `${row.proname} must be SECURITY DEFINER`
        )
        assert.equal(row.provolatile, "s", `${row.proname} must be STABLE`)
        assert.equal(
          row.service_role_can_execute,
          true,
          `${row.proname}: service_role executes`
        )
        assert.equal(
          row.authenticated_can_execute,
          false,
          `${row.proname}: authenticated denied`
        )
        assert.equal(row.anon_can_execute, false, `${row.proname}: anon denied`)
      }
    })
  }
)

test(
  "dashboard series aggregates exact per-London-day counts, past the row cap",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createAnalyticsFixture(tx)

      // Two joins yesterday, one today; 1,050 earned stamps today (past the
      // PostgREST cap); one redeemed reward two days ago, one today.
      await seedJoin(tx, fixture, fixture.dayIso(-1), 2)
      await seedJoin(tx, fixture, fixture.dayIso(0), 1)
      await seedStamps(tx, fixture, fixture.dayIso(0), 1050)
      await seedRedeemedReward(tx, fixture, fixture.dayIso(-2))
      await seedRedeemedReward(tx, fixture, fixture.dayIso(0))

      const rows = await asServiceRole(tx, (sp) =>
        sp.unsafe(`
          select day::text as day, joins::int as joins, stamps::int as stamps, rewards::int as rewards
          from public.get_merchant_dashboard_series('${fixture.merchantId}'::uuid, 14)
          order by day
        `)
      )

      const byDay = new Map(rows.map((row) => [row.day, row]))
      assert.equal(
        byDay.get(fixture.dayKey(-1))?.joins,
        2,
        "two joins yesterday"
      )
      assert.equal(byDay.get(fixture.dayKey(0))?.joins, 1, "one join today")
      assert.equal(
        byDay.get(fixture.dayKey(0))?.stamps,
        1050,
        "stamp count must be exact past the 1,000-row PostgREST cap"
      )
      assert.equal(
        byDay.get(fixture.dayKey(-2))?.rewards,
        1,
        "one redemption two days ago"
      )
      assert.equal(
        byDay.get(fixture.dayKey(0))?.rewards,
        1,
        "one redemption today"
      )
    })
  }
)

test(
  "activity event counts aggregate exactly, past the row cap",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createAnalyticsFixture(tx)

      await seedProductEvents(tx, fixture, "stamp_issued", 1100)
      await seedProductEvents(tx, fixture, "customer_joined", 3)
      await seedProductEvents(tx, fixture, "reward_redeemed", 2)
      // Outside the allowlist passed to the RPC — must not be counted.
      await seedProductEvents(tx, fixture, "qr_created", 5)

      const rows = await asServiceRole(tx, (sp) =>
        sp.unsafe(`
          select event_name, event_count::int as event_count
          from public.get_merchant_activity_event_counts(
            '${fixture.merchantId}'::uuid,
            now() - interval '7 days',
            array['stamp_issued','customer_joined','reward_redeemed']
          )
          order by event_name
        `)
      )

      const byName = Object.fromEntries(
        rows.map((row) => [row.event_name, row.event_count])
      )
      assert.equal(
        byName.stamp_issued,
        1100,
        "must be exact past the 1,000-row cap"
      )
      assert.equal(byName.customer_joined, 3)
      assert.equal(byName.reward_redeemed, 2)
      assert.equal(
        byName.qr_created,
        undefined,
        "names outside the allowlist stay out"
      )

      const emptyAllowlist = await asServiceRole(tx, (sp) =>
        sp.unsafe(`
          select * from public.get_merchant_activity_event_counts(
            '${fixture.merchantId}'::uuid, now() - interval '7 days', array[]::text[]
          )
        `)
      )
      assert.equal(
        emptyAllowlist.length,
        0,
        "an empty allowlist returns zero rows"
      )
    })
  }
)

test(
  "in-body guard refuses non-owner authenticated callers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createAnalyticsFixture(tx)
      const outsider = randomUUID()
      await tx`insert into auth.users (id) values (${outsider}::uuid)`

      // Superuser DB role bypasses the EXECUTE ACL, so this exercises the
      // in-body defense-in-depth guard directly with authenticated claims.
      // The savepoint un-aborts the transaction after the expected raise.
      let refused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
          await sp`select set_config('request.jwt.claim.sub', ${outsider}, true)`
          await sp.unsafe(`
            select * from public.get_merchant_dashboard_series('${fixture.merchantId}'::uuid, 14)
          `)
        })
      } catch (error) {
        refused = /ownership|privilege|denied/i.test(String(error.message))
      }
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`select set_config('request.jwt.claim.sub', '', true)`
      assert.ok(
        refused,
        "a non-owner authenticated caller must be refused in-body"
      )
    })
  }
)

test("migration replays idempotently and clamps p_days", { skip }, async () => {
  assert.ok(
    existsSync(MIGRATION_PATH),
    "migration 20260710091000_merchant_analytics_rpcs.sql must exist (RED until implemented)"
  )
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8")

  await inRolledBackTxn(async (tx) => {
    await tx.unsafe(migrationSql)
    await tx.unsafe(migrationSql) // replay must be a no-op, not an error

    const fixture = await createAnalyticsFixture(tx)
    await seedJoin(tx, fixture, fixture.dayIso(0), 1)

    // p_days far past the clamp must not error and must still include today.
    const rows = await asServiceRole(tx, (sp) =>
      sp.unsafe(`
          select day::text as day from public.get_merchant_dashboard_series('${fixture.merchantId}'::uuid, 5000)
        `)
    )
    assert.ok(
      rows.some((row) => row.day === fixture.dayKey(0)),
      "clamped p_days still returns today's bucket"
    )
  })
})

async function asServiceRole(tx, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role service_role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
    }
  })
}

function londonDayKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

async function createAnalyticsFixture(tx) {
  const fixture = {
    merchantId: randomUUID(),
    ownerUserId: randomUUID(),
    locationId: randomUUID(),
    cardId: randomUUID(),
    customerId: randomUUID(),
    membershipId: randomUUID(),
    // Noon anchors keep every offset inside one London calendar day.
    dayIso(offsetDays) {
      const anchor = new Date()
      anchor.setUTCDate(anchor.getUTCDate() + offsetDays)
      anchor.setUTCHours(12, 0, 0, 0)
      return anchor.toISOString()
    },
    dayKey(offsetDays) {
      return londonDayKey(new Date(fixture.dayIso(offsetDays)))
    },
  }

  await tx`insert into auth.users (id) values (${fixture.ownerUserId}::uuid)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email,
      status, requires_billing
    ) values (
      ${fixture.merchantId}::uuid, ${fixture.ownerUserId}::uuid,
      'Analytics Fixture', ${`an-${fixture.merchantId.slice(0, 8)}`}, 'pub',
      ${`an-${fixture.merchantId.slice(0, 8)}@example.test`}, 'active', false
    )
  `
  await tx`
    insert into public.merchant_locations (id, merchant_id, name)
    values (${fixture.locationId}::uuid, ${fixture.merchantId}::uuid, 'Analytics Bar')
  `
  await tx`
    insert into public.loyalty_cards (
      id, merchant_id, location_id, card_name, reward_terms, stamps_required, is_active
    ) values (
      ${fixture.cardId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid, 'Analytics Card', 'One free pint', 5, true
    )
  `
  await tx`
    insert into public.customers (
      id, email, email_verified_at, full_name, date_of_birth
    )
    values (
      ${fixture.customerId}::uuid,
      ${`an-${fixture.customerId.slice(0, 8)}@example.test`},
      now(), 'Analytics Customer', date '1990-01-01'
    )
  `
  await tx`
    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number, created_at
    ) values (
      ${fixture.membershipId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid, 0, 0, 1, now() - interval '30 days'
    )
  `
  return fixture
}

async function seedJoin(tx, fixture, createdAtIso, count) {
  await tx`
    insert into public.customers (id, email)
    select gen_random_uuid(), 'an-join-' || gen_random_uuid() || '@example.test'
    from generate_series(1, ${count})
  `
  await tx.unsafe(`
    insert into public.customer_memberships (
      merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number, created_at
    )
    select
      '${fixture.merchantId}'::uuid, c.id, 0, 0, 1, '${createdAtIso}'::timestamptz
    from public.customers c
    where c.email like 'an-join-%@example.test'
      and not exists (
        select 1 from public.customer_memberships cm
        where cm.customer_id = c.id and cm.merchant_id = '${fixture.merchantId}'::uuid
      )
    limit ${count}
  `)
}

async function seedStamps(tx, fixture, createdAtIso, count) {
  await tx.unsafe(`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, cycle_number, created_at
    )
    select
      '${fixture.merchantId}'::uuid, '${fixture.customerId}'::uuid,
      '${fixture.membershipId}'::uuid, '${fixture.cardId}'::uuid,
      '${fixture.locationId}'::uuid, 'earned', 1, 1, '${createdAtIso}'::timestamptz
    from generate_series(1, ${count})
  `)
}

async function seedRedeemedReward(tx, fixture, createdAtIso) {
  await tx.unsafe(`
    insert into public.reward_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, status,
      reward_name, reward_terms, source, cycle_number, redeemed_at, created_at
    ) values (
      '${fixture.merchantId}'::uuid, '${fixture.customerId}'::uuid,
      '${fixture.membershipId}'::uuid, '${fixture.cardId}'::uuid, 'redeemed',
      'Analytics Reward', 'One free pint', 'stamp_cycle', 1,
      '${createdAtIso}'::timestamptz, '${createdAtIso}'::timestamptz
    )
  `)
}

async function seedProductEvents(tx, fixture, eventName, count) {
  await tx.unsafe(`
    insert into public.product_events (event_name, merchant_id, customer_id, created_at)
    select
      '${eventName}', '${fixture.merchantId}'::uuid, '${fixture.customerId}'::uuid, now()
    from generate_series(1, ${count})
  `)
}
