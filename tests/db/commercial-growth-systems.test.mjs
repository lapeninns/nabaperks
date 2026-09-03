import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "commercial growth proof requires current Supabase"

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001"
const MERCHANT_ID = "10000000-0000-0000-0000-000000000001"
const MERCHANT_OWNER_ID = "00000000-0000-0000-0000-000000000101"

after(closeDb)

test(
  "commercial growth tables force RLS and expose only the required privileges",
  { skip },
  async () => {
    const tables = await db()`
      select
        relname,
        relrowsecurity,
        relforcerowsecurity,
        has_table_privilege('service_role', oid, 'select') as service_select,
        has_table_privilege('authenticated', oid, 'select') as authenticated_select,
        has_table_privilege('anon', oid, 'select') as anon_select
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in (
          'commercial_evidence_cases',
          'merchant_cancellation_interviews'
        )
      order by relname`

    assert.equal(tables.length, 2)
    for (const table of tables) {
      assert.equal(table.relrowsecurity, true, `${table.relname}: RLS enabled`)
      assert.equal(
        table.relforcerowsecurity,
        true,
        `${table.relname}: RLS forced`
      )
      assert.equal(table.service_select, true, `${table.relname}: service read`)
      assert.equal(
        table.authenticated_select,
        true,
        `${table.relname}: policy-gated authenticated read`
      )
      assert.equal(table.anon_select, false, `${table.relname}: anon denied`)
    }

    const functions = await db()`
      select
        proname,
        prosecdef,
        coalesce(array_to_string(proconfig, ','), '') as function_config,
        has_function_privilege('service_role', oid, 'execute') as service_execute,
        has_function_privilege('authenticated', oid, 'execute') as authenticated_execute,
        has_function_privilege('anon', oid, 'execute') as anon_execute,
        has_function_privilege('public', oid, 'execute') as public_execute
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'admin_capture_commercial_evidence_case',
          'record_merchant_cancellation_interview'
        )
      order by proname`

    assert.equal(functions.length, 2)
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true, `${fn.proname}: SECURITY DEFINER`)
      assert.match(fn.function_config, /search_path=/)
      assert.equal(fn.service_execute, true, `${fn.proname}: service executes`)
      assert.equal(
        fn.authenticated_execute,
        true,
        `${fn.proname}: guarded user execution`
      )
      assert.equal(fn.anon_execute, false, `${fn.proname}: anon denied`)
      assert.equal(fn.public_execute, false, `${fn.proname}: PUBLIC denied`)
    }
  }
)

test(
  "admin evidence capture snapshots the ledger, gates publication and writes audit proof",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await actAsActivatedInternalAdmin(tx, ADMIN_USER_ID)
      const [{ admin_capture_commercial_evidence_case: evidenceId }] = await tx`
        select public.admin_capture_commercial_evidence_case(
          ${MERCHANT_ID}::uuid,
          'dashboard_win',
          'The venue wanted a reproducible retention baseline.',
          'The loyalty ledger recorded repeat visits during the measured window.',
          'The ledger made the result easy to verify.',
          'Old Crown Girton',
          current_date - 30,
          current_date,
          'support-case:test-evidence-source',
          'storage:test-evidence-asset',
          'email:test-merchant-approval',
          true,
          true
        )`

      assert.match(evidenceId, /^[0-9a-f-]{36}$/i)
      const [evidence] = await tx`
        select
          status,
          new_members,
          normal_visit_stamps,
          verified_return_visits,
          rewards_redeemed,
          metric_definition_version,
          metric_snapshot_hash,
          merchant_approved_at is not null as merchant_approved,
          published_at is not null as published
        from public.commercial_evidence_cases
        where id = ${evidenceId}::uuid`

      assert.equal(evidence.status, "published")
      assert.ok(evidence.new_members >= 1)
      assert.ok(evidence.normal_visit_stamps >= 2)
      assert.ok(evidence.verified_return_visits >= 1)
      assert.ok(evidence.rewards_redeemed >= 0)
      assert.equal(
        evidence.metric_definition_version,
        "normal-return-visits-v1"
      )
      assert.match(evidence.metric_snapshot_hash, /^[0-9a-f]{64}$/)
      assert.equal(evidence.merchant_approved, true)
      assert.equal(evidence.published, true)

      const [audit] = await tx`
        select metadata
        from public.audit_logs
        where target_id = ${evidenceId}::uuid
          and action = 'commercial_evidence_published'`
      assert.equal(
        audit.metadata.metric_snapshot_hash,
        evidence.metric_snapshot_hash
      )

      await tx.unsafe("set local role authenticated")
      const adminRows = await tx`
        select id from public.commercial_evidence_cases
        where id = ${evidenceId}::uuid`
      assert.equal(
        adminRows.length,
        1,
        "admin policy exposes approved evidence"
      )
      await tx.unsafe("reset role")

      await actAsAuthenticated(tx, MERCHANT_OWNER_ID)
      await tx.unsafe("set local role authenticated")
      const merchantRows = await tx`
        select id from public.commercial_evidence_cases
        where id = ${evidenceId}::uuid`
      assert.equal(
        merchantRows.length,
        0,
        "merchant cannot read the internal ledger"
      )
      await tx.unsafe("reset role")

      await assert.rejects(
        tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, MERCHANT_OWNER_ID)
          await sp`
            select public.admin_capture_commercial_evidence_case(
              ${MERCHANT_ID}::uuid,
              'merchant_submission',
              'Before summary',
              'After summary',
              null,
              null,
              current_date - 7,
              current_date,
              'unauthorised-source',
              null,
              null,
              false,
              false
            )`
        }),
        (error) => error?.code === "42501"
      )
    })
  }
)

test(
  "merchant cancellation interview is owner-scoped, auditable and separates support from cancellation",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await actAsAuthenticated(tx, MERCHANT_OWNER_ID)
      const [support] = await tx`
        select * from public.record_merchant_cancellation_interview(
          ${MERCHANT_ID}::uuid,
          'poor_results',
          'The operator wants help understanding the return-visit report.',
          'support_call'
        )`
      assert.equal(support.should_open_portal, false)
      assert.equal(support.stripe_subscription_id, "sub_seed_bean")

      const [cancellation] = await tx`
        select * from public.record_merchant_cancellation_interview(
          ${MERCHANT_ID}::uuid,
          'seasonal_pause',
          'The venue is closing temporarily after the current period.',
          'continue_cancellation'
        )`
      assert.equal(cancellation.should_open_portal, true)

      const interviews = await tx`
        select id, status, portal_opened_at
        from public.merchant_cancellation_interviews
        where id in (${support.interview_id}::uuid, ${cancellation.interview_id}::uuid)
        order by status`
      assert.deepEqual(interviews.map((row) => row.status).sort(), [
        "follow_up_requested",
        "portal_opened",
      ])
      assert.equal(
        interviews.find((row) => row.status === "follow_up_requested")
          ?.portal_opened_at,
        null
      )
      assert.ok(
        interviews.find((row) => row.status === "portal_opened")
          ?.portal_opened_at
      )

      await tx.unsafe("set local role authenticated")
      const ownerRows = await tx`
        select id from public.merchant_cancellation_interviews
        where id in (${support.interview_id}::uuid, ${cancellation.interview_id}::uuid)`
      assert.equal(ownerRows.length, 2, "owner can read their exit interviews")
      await tx.unsafe("reset role")

      const [{ audit_count: auditCount }] = await tx`
        select count(*)::int as audit_count
        from public.audit_logs
        where target_id in (
          ${support.interview_id}::uuid,
          ${cancellation.interview_id}::uuid
        )
          and action = 'merchant_cancellation_interview_recorded'`
      assert.equal(auditCount, 2)

      await assert.rejects(
        tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`
            select * from public.record_merchant_cancellation_interview(
              ${MERCHANT_ID}::uuid,
              'other',
              'Cross-tenant attempt',
              'support_call'
            )`
        }),
        (error) => error?.code === "22023"
      )
    })
  }
)

test(
  "new annual checkout binds the same paid launch fee as 28-day checkout",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createMerchant(tx)
      const [attempt] = await tx`
        select * from public.claim_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          'year',
          'price_growth_annual_test',
          'http://localhost:3000/app/account?checkout=success',
          'http://localhost:3000/app/account?checkout=cancelled',
          transaction_timestamp() + interval '1 day',
          null
        )`
      assert.equal(attempt.claim_status, "claimed")

      const [offer] = await tx`
        select * from public.bind_billing_checkout_offer(
          ${fixture.merchantId}::uuid,
          ${attempt.attempt_id}::uuid,
          ${attempt.worker_lease_id}::uuid,
          'price_launch_29999_test'
        )`
      assert.equal(offer.bind_status, "bound")
      assert.equal(offer.launch_fee_policy, "charged")
      assert.equal(offer.stripe_launch_price_id, "price_launch_29999_test")

      const [stored] = await tx`
        select billing_interval, checkout_offer_bound, launch_fee_policy,
          stripe_launch_price_id
        from public.billing_checkout_attempts
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(stored.billing_interval, "year")
      assert.equal(stored.checkout_offer_bound, true)
      assert.equal(stored.launch_fee_policy, "charged")
      assert.equal(stored.stripe_launch_price_id, "price_launch_29999_test")
    })
  }
)

async function actAsAuthenticated(tx, userId) {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', 'aal1', true)`
}

async function createMerchant(tx) {
  const ownerId = randomUUID()
  const merchantId = randomUUID()
  const short = merchantId.slice(0, 8)
  await tx`insert into auth.users (id) values (${ownerId}::uuid)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email, status
    ) values (
      ${merchantId}::uuid,
      ${ownerId}::uuid,
      'Annual checkout proof',
      ${`annual-checkout-proof-${short}`},
      'pub',
      ${`annual-${short}@example.test`},
      'trial'
    )`
  return { merchantId }
}
