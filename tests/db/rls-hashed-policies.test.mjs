import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db rls hashed select policies — live-DB proof.
 *
 * The seven ledger SELECT policies must resolve tenant ownership once per
 * query (uncorrelated subplan over the owned_*_ids() definer helpers), not
 * once per row, while keeping row visibility byte-identical for customer,
 * merchant owner, cross-tenant outsider, and anon identities.
 */

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710090000_rls_hashed_select_policies.sql"
)

const REWRITTEN_POLICIES = [
  ["customer_memberships", "customer_memberships_select_scoped"],
  ["stamp_events", "stamp_events_select_scoped"],
  ["product_events", "product_events_select_scoped"],
  ["reward_events", "reward_events_select_scoped"],
  ["consent_records", "consent_records_select_scoped"],
  ["audit_logs", "audit_logs_select_scoped"],
  ["notification_preferences", "notification_preferences_select_customer_or_admin"],
]

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "owned-id helper functions exist with the definer/stable/acl contract",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const rows = await tx`
        select
          proname,
          prosecdef,
          provolatile,
          proretset,
          has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
          has_function_privilege('anon', oid, 'execute') as anon_can_execute
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('owned_customer_ids', 'owned_merchant_ids')
        order by proname
      `

      assert.equal(
        rows.length,
        2,
        "owned_customer_ids() and owned_merchant_ids() must exist (RED until the migration lands)"
      )
      for (const row of rows) {
        assert.equal(row.prosecdef, true, `${row.proname} must be SECURITY DEFINER`)
        assert.equal(row.provolatile, "s", `${row.proname} must be STABLE`)
        assert.equal(row.proretset, true, `${row.proname} must return a set`)
        assert.equal(
          row.authenticated_can_execute,
          true,
          `${row.proname} must be executable by authenticated`
        )
        assert.equal(
          row.anon_can_execute,
          false,
          `${row.proname} must not be executable by anon`
        )
      }
    })
  }
)

test(
  "merchant full-scan executes owner subplans once per query, not per row",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createTenantFixture(tx)
      await seedPlanShapeMemberships(tx, fixture, 25)

      const plan = await asUser(tx, fixture.ownerAUserId, async (sp) => {
        const [row] = await sp.unsafe(
          `explain (analyze, format json)
           select count(*) from public.customer_memberships
           where merchant_id = '${fixture.merchantAId}'`
        )
        return row["QUERY PLAN"] ?? row["query plan"]
      })

      const subplans = []
      collectSubplanNodes(plan[0].Plan, subplans)

      const perRow = subplans.filter((node) => (node["Actual Loops"] ?? 0) > 1)
      assert.deepEqual(
        perRow.map((node) => `${node["Subplan Name"]} loops=${node["Actual Loops"]}`),
        [],
        "every owner subplan must execute at most once per query (RED while policies are row-correlated)"
      )
    })
  }
)

test(
  "row visibility parity holds across all seven rewritten tables",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createTenantFixture(tx)

      // [table, customer-A sees, owner-A sees, outsider sees]
      const matrix = [
        ["customer_memberships", 1, 1, 0],
        ["stamp_events", 1, 1, 0],
        ["product_events", 1, 1, 0],
        ["reward_events", 1, 1, 0],
        ["consent_records", 1, 1, 0],
        ["audit_logs", 0, 1, 0], // merchant/admin only — no customer clause
        ["notification_preferences", 1, 0, 0], // customer/admin only — no merchant clause
      ]

      for (const [table, customerSees, ownerSees, outsiderSees] of matrix) {
        const customerRows = await asUser(tx, fixture.customerAUserId, (sp) =>
          countTenantRows(sp, table, fixture)
        )
        assert.equal(
          customerRows,
          customerSees,
          `${table}: customer A must see ${customerSees} tenant-A row(s)`
        )

        const ownerRows = await asUser(tx, fixture.ownerAUserId, (sp) =>
          countTenantRows(sp, table, fixture)
        )
        assert.equal(
          ownerRows,
          ownerSees,
          `${table}: merchant owner A must see ${ownerSees} tenant-A row(s)`
        )

        const outsiderRows = await asUser(tx, fixture.outsiderUserId, (sp) =>
          countTenantRows(sp, table, fixture)
        )
        assert.equal(
          outsiderRows,
          outsiderSees,
          `${table}: outsider must see ${outsiderSees} tenant-A row(s)`
        )

        const crossTenantRows = await asUser(tx, fixture.ownerBUserId, (sp) =>
          countTenantRows(sp, table, fixture)
        )
        assert.equal(
          crossTenantRows,
          0,
          `${table}: tenant-B owner must see 0 tenant-A rows`
        )

        const anonRows = await anonRowCountOrDenied(tx, table, fixture)
        assert.ok(
          anonRows <= 0,
          `${table}: anon must see no rows (or be denied outright)`
        )
      }
    })
  }
)

test(
  "migration file replays idempotently and leaves the seven policies in place",
  { skip },
  async () => {
    assert.ok(
      existsSync(MIGRATION_PATH),
      "migration 20260710090000_rls_hashed_select_policies.sql must exist (RED until implemented)"
    )
    const migrationSql = readFileSync(MIGRATION_PATH, "utf8")

    await inRolledBackTxn(async (tx) => {
      // The policy swap takes AccessExclusive locks on seven hot tables.
      // Other db-test files run in parallel and hold row locks on the same
      // tables (e.g. the referral award races), so a lock cycle is possible.
      // Pin THIS transaction as the deadlock victim (it detects first) and
      // retry — the concurrent race tests must never be aborted on our
      // account.
      await tx`set local deadlock_timeout = '50ms'`
      for (let attempt = 1; ; attempt += 1) {
        try {
          await tx.savepoint(async (sp) => {
            await sp.unsafe(migrationSql)
            await sp.unsafe(migrationSql) // replay must be a no-op, not an error
          })
          break
        } catch (error) {
          if (error?.code !== "40P01" || attempt >= 5) throw error
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
        }
      }

      const policies = await tx`
        select tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and policyname = any(${REWRITTEN_POLICIES.map(([, policy]) => policy)})
        order by policyname
      `
      assert.equal(
        policies.length,
        REWRITTEN_POLICIES.length,
        "each rewritten policy must exist exactly once after replay"
      )

      const [helpers] = await tx`
        select count(*)::int as n
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('owned_customer_ids', 'owned_merchant_ids')
      `
      assert.equal(helpers.n, 2, "both owner-id helpers must exist after replay")

      // The rewritten quals must not re-introduce the row-correlated helpers.
      const quals = await tx`
        select policyname, qual
        from pg_policies
        where schemaname = 'public'
          and policyname = any(${REWRITTEN_POLICIES.map(([, policy]) => policy)})
      `
      for (const { policyname, qual } of quals) {
        assert.ok(
          !/is_customer_owner\(|is_merchant_owner\(/.test(qual ?? ""),
          `${policyname} must not call the per-row owner helpers after the rewrite`
        )
        assert.ok(
          /owned_customer_ids|owned_merchant_ids/.test(qual ?? ""),
          `${policyname} must resolve ownership via the owned_*_ids helpers`
        )
      }
    })
  }
)

async function asUser(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

async function anonRowCountOrDenied(tx, table, fixture) {
  try {
    return await tx.savepoint(async (sp) => {
      await sp`set local role anon`
      await sp`select set_config('request.jwt.claim.role', 'anon', true)`
      await sp`select set_config('request.jwt.claim.sub', '', true)`
      try {
        return await countTenantRows(sp, table, fixture)
      } finally {
        await sp`reset role`
        await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
      }
    })
  } catch (error) {
    if (/permission denied/i.test(String(error.message))) return -1
    throw error
  }
}

async function countTenantRows(sp, table, fixture) {
  const filters = {
    customer_memberships: sp`
      select count(*)::int as n from public.customer_memberships
      where merchant_id = ${fixture.merchantAId}::uuid`,
    stamp_events: sp`
      select count(*)::int as n from public.stamp_events
      where merchant_id = ${fixture.merchantAId}::uuid`,
    product_events: sp`
      select count(*)::int as n from public.product_events
      where merchant_id = ${fixture.merchantAId}::uuid`,
    reward_events: sp`
      select count(*)::int as n from public.reward_events
      where merchant_id = ${fixture.merchantAId}::uuid`,
    consent_records: sp`
      select count(*)::int as n from public.consent_records
      where merchant_id = ${fixture.merchantAId}::uuid`,
    audit_logs: sp`
      select count(*)::int as n from public.audit_logs
      where merchant_id = ${fixture.merchantAId}::uuid`,
    notification_preferences: sp`
      select count(*)::int as n from public.notification_preferences
      where customer_id = ${fixture.customerAId}::uuid`,
  }
  const rows = await filters[table]
  return rows[0].n
}

function collectSubplanNodes(node, out) {
  if (!node || typeof node !== "object") return
  if (node["Subplan Name"]) out.push(node)
  for (const child of node.Plans ?? []) collectSubplanNodes(child, out)
}

async function seedPlanShapeMemberships(tx, fixture, count) {
  await tx`
    insert into public.customers (id, email)
    select
      ('e0000000-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid,
      'plan-shape-' || i || '@example.test'
    from generate_series(1, ${count}) i
  `
  await tx`
    insert into public.customer_memberships (
      merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number
    )
    select
      ${fixture.merchantAId}::uuid,
      ('e0000000-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid,
      0, 0, 1
    from generate_series(1, ${count}) i
  `
}

async function createTenantFixture(tx) {
  const fixture = {
    customerAId: randomUUID(),
    customerAUserId: randomUUID(),
    customerBId: randomUUID(),
    customerBUserId: randomUUID(),
    membershipAId: randomUUID(),
    membershipBId: randomUUID(),
    merchantAId: randomUUID(),
    merchantBId: randomUUID(),
    locationAId: randomUUID(),
    locationBId: randomUUID(),
    cardAId: randomUUID(),
    cardBId: randomUUID(),
    outsiderUserId: randomUUID(),
    ownerAUserId: randomUUID(),
    ownerBUserId: randomUUID(),
  }

  await tx`
    insert into auth.users (id)
    values (${fixture.ownerAUserId}::uuid), (${fixture.ownerBUserId}::uuid),
      (${fixture.outsiderUserId}::uuid), (${fixture.customerAUserId}::uuid),
      (${fixture.customerBUserId}::uuid)
  `

  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email,
      status, requires_billing
    )
    values
      (
        ${fixture.merchantAId}::uuid, ${fixture.ownerAUserId}::uuid,
        'Hashed A', ${`hp-a-${fixture.merchantAId.slice(0, 8)}`}, 'pub',
        ${`hp-a-${fixture.merchantAId.slice(0, 8)}@example.test`}, 'active',
        false
      ),
      (
        ${fixture.merchantBId}::uuid, ${fixture.ownerBUserId}::uuid,
        'Hashed B', ${`hp-b-${fixture.merchantBId.slice(0, 8)}`}, 'pub',
        ${`hp-b-${fixture.merchantBId.slice(0, 8)}@example.test`}, 'active',
        false
      )
  `

  await tx`
    insert into public.merchant_locations (id, merchant_id, name)
    values
      (${fixture.locationAId}::uuid, ${fixture.merchantAId}::uuid, 'Hashed A Bar'),
      (${fixture.locationBId}::uuid, ${fixture.merchantBId}::uuid, 'Hashed B Bar')
  `

  await tx`
    insert into public.loyalty_cards (
      id, merchant_id, location_id, card_name, reward_terms, stamps_required,
      is_active
    )
    values
      (
        ${fixture.cardAId}::uuid, ${fixture.merchantAId}::uuid,
        ${fixture.locationAId}::uuid, 'Hashed A Card', 'One free pint', 3, true
      ),
      (
        ${fixture.cardBId}::uuid, ${fixture.merchantBId}::uuid,
        ${fixture.locationBId}::uuid, 'Hashed B Card', 'One free pint', 3, true
      )
  `

  await tx`
    insert into public.customers (
      id, auth_user_id, email, phone_last4, full_name, date_of_birth,
      email_verified_at
    )
    values
      (
        ${fixture.customerAId}::uuid, ${fixture.customerAUserId}::uuid,
        'hashed-a@example.test', '1001', 'Alice Hashed',
        date '1991-01-01', now()
      ),
      (
        ${fixture.customerBId}::uuid, ${fixture.customerBUserId}::uuid,
        'hashed-b@example.test', '2002', 'Bob Hashed',
        date '1992-02-02', now()
      )
  `

  await tx`
    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number
    )
    values
      (
        ${fixture.membershipAId}::uuid, ${fixture.merchantAId}::uuid,
        ${fixture.customerAId}::uuid, 1, 1, 1
      ),
      (
        ${fixture.membershipBId}::uuid, ${fixture.merchantBId}::uuid,
        ${fixture.customerBId}::uuid, 1, 1, 1
      )
  `

  await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, cycle_number
    )
    values
      (
        ${fixture.merchantAId}::uuid, ${fixture.customerAId}::uuid,
        ${fixture.membershipAId}::uuid, ${fixture.cardAId}::uuid,
        ${fixture.locationAId}::uuid, 'earned', 1, 1
      ),
      (
        ${fixture.merchantBId}::uuid, ${fixture.customerBId}::uuid,
        ${fixture.membershipBId}::uuid, ${fixture.cardBId}::uuid,
        ${fixture.locationBId}::uuid, 'earned', 1, 1
      )
  `

  await tx`
    insert into public.product_events (event_name, merchant_id, customer_id, membership_id)
    values
      ('stamp_issued', ${fixture.merchantAId}::uuid, ${fixture.customerAId}::uuid, ${fixture.membershipAId}::uuid),
      ('stamp_issued', ${fixture.merchantBId}::uuid, ${fixture.customerBId}::uuid, ${fixture.membershipBId}::uuid)
  `

  await tx`
    insert into public.reward_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, status,
      reward_name, reward_terms, source, cycle_number
    )
    values
      (
        ${fixture.merchantAId}::uuid, ${fixture.customerAId}::uuid,
        ${fixture.membershipAId}::uuid, ${fixture.cardAId}::uuid, 'unlocked',
        'Hashed Reward A', 'One free pint', 'stamp_cycle', 1
      ),
      (
        ${fixture.merchantBId}::uuid, ${fixture.customerBId}::uuid,
        ${fixture.membershipBId}::uuid, ${fixture.cardBId}::uuid, 'unlocked',
        'Hashed Reward B', 'One free pint', 'stamp_cycle', 1
      )
  `

  await tx`
    insert into public.consent_records (
      merchant_id, customer_id, channel, consent_status, source, policy_version
    )
    values
      (
        ${fixture.merchantAId}::uuid, ${fixture.customerAId}::uuid,
        'email', 'opted_in', 'join_flow', 'v1'
      ),
      (
        ${fixture.merchantBId}::uuid, ${fixture.customerBId}::uuid,
        'email', 'opted_in', 'join_flow', 'v1'
      )
  `

  await tx`
    insert into public.audit_logs (merchant_id, customer_id, actor_type, action)
    values
      (${fixture.merchantAId}::uuid, ${fixture.customerAId}::uuid, 'system', 'hashed_policy_fixture'),
      (${fixture.merchantBId}::uuid, ${fixture.customerBId}::uuid, 'system', 'hashed_policy_fixture')
  `

  await tx`
    insert into public.notification_preferences (customer_id)
    values (${fixture.customerAId}::uuid), (${fixture.customerBId}::uuid)
  `

  return fixture
}
