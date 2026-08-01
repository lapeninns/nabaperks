import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

const ready = await isDeliveryPilotReady()
const skip = ready
  ? false
  : "delivery-pilot migration is not applied to a reachable DB"

after(async () => {
  await closeDb()
})

test(
  "fulfilment ledger enforces RLS, private worker leases, and cron registration",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [table] = await tx`
        select
          relrowsecurity,
          relforcerowsecurity,
          has_table_privilege('authenticated', oid, 'select') as merchant_read,
          has_table_privilege('authenticated', oid, 'insert, update, delete') as merchant_write,
          has_table_privilege('service_role', oid, 'select, insert, update') as worker_access
        from pg_class
        where oid = 'public.merchant_launch_fulfilments'::regclass`

      assert.deepEqual(table, {
        relrowsecurity: true,
        relforcerowsecurity: true,
        merchant_read: true,
        merchant_write: false,
        worker_access: true,
      })

      const functions = await tx`
        select
          proname,
          prosecdef,
          has_function_privilege('authenticated', oid, 'execute') as authenticated_execute,
          has_function_privilege('service_role', oid, 'execute') as service_execute
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in (
            'admin_mark_merchant_launch_dispatched',
            'admin_confirm_merchant_launch_delivered',
            'admin_set_merchant_launch_pilot_extension',
            'claim_merchant_launch_trial_sync',
            'confirm_merchant_launch_trial_sync',
            'fail_merchant_launch_trial_sync'
          )
        order by proname`

      assert.equal(functions.length, 6)
      for (const fn of functions) {
        assert.equal(fn.prosecdef, true, `${fn.proname}: SECURITY DEFINER`)
        assert.equal(
          fn.service_execute,
          true,
          `${fn.proname}: service role executes`
        )
        assert.equal(
          fn.authenticated_execute,
          fn.proname.startsWith("admin_"),
          `${fn.proname}: least-privilege caller`
        )
      }

      const [cron] = await tx`
        select maximum_gap
        from public.operational_cron_jobs
        where job_name = 'billing-trial-sync'`
      assert.equal(cron.maximum_gap, "00:30:00")
    })
  }
)

test(
  "delivery starts a full pilot, leases the Stripe change once, and preserves audit evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createFixture(tx)
      await actAsAdmin(tx, fixture.adminId)

      const [dispatch] = await tx`
        select (public.admin_mark_merchant_launch_dispatched(
          ${fixture.merchantId}::uuid, null
        )).*`
      const [replayedDispatch] = await tx`
        select (public.admin_mark_merchant_launch_dispatched(
          ${fixture.merchantId}::uuid, null
        )).*`
      assert.equal(dispatch.fulfilment_status, "dispatched")
      assert.equal(
        replayedDispatch.dispatched_at.toISOString(),
        dispatch.dispatched_at.toISOString()
      )

      const [delivery] = await tx`
        select (public.admin_confirm_merchant_launch_delivered(
          ${fixture.merchantId}::uuid, null
        )).*`
      assert.equal(delivery.fulfilment_status, "delivered")
      assert.equal(delivery.sync_status, "pending")
      assert.equal(
        delivery.base_pilot_ends_at.getTime() -
          delivery.pilot_starts_at.getTime(),
        28 * 24 * 60 * 60 * 1_000
      )
      assert.ok(
        delivery.desired_stripe_trial_end > delivery.confirmed_stripe_trial_end,
        "delivery moves recurring billing later without shortening the provisional trial"
      )

      await actAsService(tx)
      const [claim] =
        await tx`select * from public.claim_merchant_launch_trial_sync()`
      assert.equal(claim.merchant_id, fixture.merchantId)
      assert.equal(claim.stripe_subscription_id, fixture.subscriptionId)
      assert.equal(claim.sync_reason, "delivery_confirmed")
      assert.deepEqual(
        await tx`select * from public.claim_merchant_launch_trial_sync()`,
        [],
        "an active lease prevents a duplicate worker claim"
      )

      const [{ confirmed }] = await tx`
        select public.confirm_merchant_launch_trial_sync(
          ${claim.fulfilment_id}::uuid,
          ${claim.lease_id}::uuid,
          ${claim.stripe_subscription_id},
          ${claim.desired_trial_end}
        ) as confirmed`
      assert.equal(confirmed, true)

      const [settled] = await tx`
        select sync_status, confirmed_stripe_trial_end, worker_lease_id
        from public.merchant_launch_fulfilments
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(settled.sync_status, "synchronised")
      assert.equal(settled.worker_lease_id, null)
      assert.equal(
        settled.confirmed_stripe_trial_end.toISOString(),
        claim.desired_trial_end.toISOString()
      )

      const [audit] = await tx`
        select
          count(*) filter (where action = 'merchant_launch_dispatched')::int as dispatches,
          count(*) filter (where action = 'merchant_launch_delivered')::int as deliveries
        from public.audit_logs
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.deepEqual(audit, { dispatches: 1, deliveries: 1 })
    })
  }
)

async function isDeliveryPilotReady() {
  if (!dbUrl()) return false
  try {
    const [result] = await db()`
      select
        to_regclass('public.merchant_launch_fulfilments') is not null as has_table,
        to_regprocedure('public.claim_merchant_launch_trial_sync()') is not null as has_worker`
    return result?.has_table === true && result?.has_worker === true
  } catch {
    return false
  }
}

async function createFixture(tx) {
  const ownerId = randomUUID()
  const adminId = randomUUID()
  const merchantId = randomUUID()
  const short = merchantId.slice(0, 8)
  const subscriptionId = `sub_delivery_${short}`

  await tx`insert into auth.users (id) values (${ownerId}::uuid), (${adminId}::uuid)`
  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (${adminId}::uuid, ${`admin-${short}@example.test`}, true)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email, status
    ) values (
      ${merchantId}::uuid,
      ${ownerId}::uuid,
      ${`Delivery pilot ${short}`},
      ${`delivery-pilot-${short}`},
      'pub',
      ${`merchant-${short}@example.test`},
      'trial'
    )`
  await tx`
    insert into public.billing_customers (
      merchant_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      current_period_end,
      stripe_subscription_status,
      stripe_subscription_created_at,
      stripe_price_id,
      billing_interval,
      unit_amount,
      currency,
      cancel_at_period_end,
      cancel_at,
      launch_fee_status,
      launch_fee_satisfied_at,
      launch_fee_subscription_id
    ) values (
      ${merchantId}::uuid,
      ${`cus_delivery_${short}`},
      ${subscriptionId},
      'growth',
      'trialing',
      transaction_timestamp() + interval '22 days',
      'trialing',
      transaction_timestamp() - interval '20 days',
      'price_growth_28_day',
      'day',
      6999,
      'gbp',
      false,
      null,
      'paid',
      transaction_timestamp(),
      ${subscriptionId}
    )`

  return { adminId, merchantId, subscriptionId }
}

async function actAsAdmin(tx, adminId) {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`
}

async function actAsService(tx) {
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
  await tx`select set_config('request.jwt.claim.sub', '', true)`
}
