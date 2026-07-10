import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { after, test } from "node:test"

import postgres from "postgres"

const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1"])
const localDbUrl = resolveLocalDbUrl()
const skip = localDbUrl
  ? false
  : "billing durability proof requires local Supabase Postgres"
const sql = localDbUrl ? postgres(localDbUrl, { max: 6 }) : null

after(async () => {
  if (sql) await sql.end({ timeout: 5 })
})

test(
  "billing durability schema pins constraints, FORCE RLS, ACLs, and exact service-only RPCs",
  { skip },
  async () => {
    await rolledBack(async (tx) => {
      const columns = await tx`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'billing_customers'
          and column_name in (
            'stripe_subscription_status',
            'stripe_subscription_created_at',
            'stripe_price_id',
            'billing_interval',
            'unit_amount',
            'currency',
            'cancel_at_period_end',
            'cancel_at',
            'stripe_state_event_created_at',
            'stripe_state_event_id'
          )
        order by column_name`
      assert.equal(columns.length, 10, "all authoritative plan/cursor columns exist")

      const functions = await tx`
        select
          proname,
          pg_get_function_identity_arguments(oid) as identity_arguments,
          prosecdef,
          coalesce(array_to_string(proconfig, ','), '') as function_config,
          has_function_privilege('service_role', oid, 'execute') as service_role_execute,
          has_function_privilege('authenticated', oid, 'execute') as authenticated_execute,
          has_function_privilege('anon', oid, 'execute') as anon_execute,
          not exists (
            select 1
            from aclexplode(coalesce(pg_proc.proacl, acldefault('f', pg_proc.proowner))) acl
            where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
          ) as public_denied
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in (
            'claim_billing_checkout_attempt',
            'bind_billing_checkout_customer',
            'finalize_billing_checkout_session',
            'release_billing_checkout_attempt',
            'rotate_billing_checkout_attempt',
            'claim_stripe_webhook_event',
            'fail_stripe_webhook_event',
            'complete_stripe_webhook_event',
            'apply_stripe_subscription_event',
            'apply_current_stripe_subscription'
          )
        order by proname`
      assert.equal(functions.length, 10, "all fenced lifecycle RPCs exist")
      for (const fn of functions) {
        assert.equal(fn.prosecdef, true, `${fn.proname}: SECURITY DEFINER`)
        assert.match(
          fn.function_config,
          /search_path=(?:pg_catalog, public|"pg_catalog", "public")/,
          `${fn.proname}: trusted search_path`
        )
        assert.equal(fn.service_role_execute, true, `${fn.proname}: service role executes`)
        assert.equal(fn.authenticated_execute, false, `${fn.proname}: authenticated denied`)
        assert.equal(fn.anon_execute, false, `${fn.proname}: anon denied`)
        assert.equal(fn.public_denied, true, `${fn.proname}: PUBLIC denied`)
      }

      const tables = await tx`
        select
          relname,
          relrowsecurity,
          relforcerowsecurity,
          has_table_privilege('service_role', oid, 'select, insert, update, delete') as service_role_access,
          has_table_privilege('authenticated', oid, 'select, insert, update, delete') as authenticated_access,
          has_table_privilege('anon', oid, 'select, insert, update, delete') as anon_access,
          not exists (
            select 1
            from aclexplode(coalesce(pg_class.relacl, acldefault('r', pg_class.relowner))) acl
            where acl.grantee = 0
              and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
          ) as public_denied
        from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('billing_checkout_attempts', 'stripe_webhook_events')
        order by relname`
      assert.equal(tables.length, 2)
      for (const table of tables) {
        assert.equal(table.relrowsecurity, true, `${table.relname}: RLS enabled`)
        assert.equal(table.relforcerowsecurity, true, `${table.relname}: RLS forced`)
        assert.equal(table.service_role_access, true, `${table.relname}: service role maintains`)
        assert.equal(table.authenticated_access, false, `${table.relname}: authenticated denied`)
        assert.equal(table.anon_access, false, `${table.relname}: anon denied`)
        assert.equal(table.public_denied, true, `${table.relname}: PUBLIC denied`)
      }

      const fixture = await createMerchant(tx, "historical")
      await tx`
        insert into public.billing_customers (
          merchant_id,
          stripe_customer_id,
          stripe_subscription_id,
          status,
          current_period_end
        ) values (
          ${fixture.merchantId}::uuid,
          ${`cus_historical_${fixture.short}`},
          ${`sub_historical_${fixture.short}`},
          'trialing',
          '2026-08-10T00:00:00Z'::timestamptz
        )`
      const [historical] = await tx`
        select stripe_subscription_status, billing_interval, stripe_state_event_id
        from public.billing_customers
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.deepEqual(
        historical,
        {
          stripe_subscription_status: null,
          billing_interval: null,
          stripe_state_event_id: null,
        },
        "valid historical rows survive without invented provider facts"
      )

      await expectConstraint(tx, async (sp) => {
        await sp`
          update public.billing_customers
          set billing_interval = 'week'
          where merchant_id = ${fixture.merchantId}::uuid`
      })
      await expectConstraint(tx, async (sp) => {
        await sp`
          insert into public.billing_checkout_attempts (
            merchant_id,
            stripe_customer_id,
            attempt_id,
            billing_interval,
            stripe_price_id,
            success_url,
            cancel_url,
            attempt_expires_at,
            stripe_checkout_session_id
          ) values (
            ${fixture.merchantId}::uuid,
            ${`cus_partial_${fixture.short}`},
            ${randomUUID()}::uuid,
            'month',
            'price_month_49',
            'http://localhost:3000/app/account?checkout=success',
            'http://localhost:3000/app/account?checkout=cancelled',
            transaction_timestamp() + interval '1 day',
            'cs_partial_without_url_or_expiry'
          )`
      })

      await tx`
        update public.billing_customers
        set status = 'cancelled'
        where merchant_id = ${fixture.merchantId}::uuid`
      const [seededFromCancelledBilling] = await claimCheckout(
        tx,
        fixture.merchantId,
        {
          interval: "month",
          priceId: "price_month_49",
        }
      )
      assert.equal(seededFromCancelledBilling.claim_status, "claimed")
      assert.equal(
        seededFromCancelledBilling.stripe_customer_id,
        `cus_historical_${fixture.short}`,
        "a cancelled subscription seeds its durable customer into the attempt"
      )
      const [customerMismatch] = await claimCheckout(tx, fixture.merchantId, {
        interval: "month",
        priceId: "price_month_49",
        customerId: `cus_wrong_${fixture.short}`,
      })
      assert.equal(customerMismatch.claim_status, "blocked")
      assert.equal(customerMismatch.attempt_id, null)

      const unboundFixture = await createMerchant(tx, "unbound-rotation")
      const [unbound] = await claimCheckout(tx, unboundFixture.merchantId, {
        interval: "month",
        priceId: "price_month_49",
      })
      await tx`
        select public.release_billing_checkout_attempt(
          ${unboundFixture.merchantId}::uuid,
          ${unbound.attempt_id}::uuid,
          ${unbound.worker_lease_id}::uuid
        )`
      const [unboundRotated] = await tx`
        select * from public.rotate_billing_checkout_attempt(
          ${unboundFixture.merchantId}::uuid,
          ${unbound.attempt_id}::uuid,
          null,
          'year',
          'price_year_490',
          'http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          'http://localhost:3000/app/account?checkout=cancelled',
          transaction_timestamp() + interval '1 day'
        )`
      assert.equal(unboundRotated.rotation_status, "claimed")
      assert.notEqual(unboundRotated.attempt_id, unbound.attempt_id)
      await expectConstraint(tx, async (sp) => {
        await sp`
          update public.billing_customers
          set stripe_state_event_id = 'evt_unpaired'
          where merchant_id = ${fixture.merchantId}::uuid`
      })
      await expectConstraint(tx, async (sp) => {
        await sp`
          update public.billing_customers
          set
            stripe_subscription_status = 'active',
            stripe_subscription_created_at = '2026-07-01T00:00:00Z',
            stripe_price_id = 'price_bad_currency',
            billing_interval = 'month',
            unit_amount = 4900,
            currency = 'GBP',
            cancel_at_period_end = false
          where merchant_id = ${fixture.merchantId}::uuid`
      })
    })
  }
)

test(
  "same-interval checkout claims converge, fences reject stale workers, and exact rotation is required",
  { skip },
  async () => {
    const fixture = await createCommittedMerchant("concurrency")
    const barrier = createBarrier(2)
    try {
      const claims = await Promise.all(
        [1, 2].map(async () => {
          const connection = postgres(localDbUrl, { max: 1 })
          try {
            await barrier()
            return await connection.begin(async (tx) => {
              const [claim] = await claimCheckout(tx, fixture.merchantId, {
                interval: "month",
                priceId: "price_month_49",
              })
              return claim
            })
          } finally {
            await connection.end({ timeout: 5 })
          }
        })
      )

      assert.deepEqual(
        claims.map((claim) => claim.claim_status).sort(),
        ["busy", "claimed"],
        "only one concurrent worker gets a live lease"
      )
      assert.equal(claims[0].attempt_id, claims[1].attempt_id)
      const winner = claims.find((claim) => claim.claim_status === "claimed")
      const loser = claims.find((claim) => claim.claim_status === "busy")
      assert.ok(winner.worker_lease_id)
      assert.equal(loser.worker_lease_id, null, "busy never leaks the live fence")

      const [noBilling] = await sql`
        select count(*)::int as count
        from public.billing_customers
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(noBilling.count, 0, "a pre-subscription attempt creates no entitlement row")

      const customerId = `cus_checkout_${fixture.short}`
      const [unboundFinalize] = await sql`
        select public.finalize_billing_checkout_session(
          ${fixture.merchantId}::uuid,
          ${winner.attempt_id}::uuid,
          ${winner.worker_lease_id}::uuid,
          ${`cs_unbound_${fixture.short}`},
          ${`https://checkout.stripe.test/cs_unbound_${fixture.short}`},
          transaction_timestamp() + interval '1 hour'
        ) as finalized`
      assert.equal(unboundFinalize.finalized, false, "a Session requires a bound customer")

      const [bound] = await sql`
        select public.bind_billing_checkout_customer(
          ${fixture.merchantId}::uuid,
          ${winner.attempt_id}::uuid,
          ${winner.worker_lease_id}::uuid,
          ${customerId}
        ) as bound`
      assert.equal(bound.bound, true)

      const [released] = await sql`
        select public.release_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${winner.attempt_id}::uuid,
          ${winner.worker_lease_id}::uuid
        ) as released`
      assert.equal(released.released, true)

      const [ambiguousRotation] = await sql`
        select * from public.rotate_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${winner.attempt_id}::uuid,
          null,
          'year',
          'price_year_490',
          'http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          'http://localhost:3000/app/account?checkout=cancelled',
          transaction_timestamp() + interval '1 day'
        )`
      assert.equal(
        ambiguousRotation.rotation_status,
        "conflict",
        "customer-bound ambiguity must be recovered before an interval switch"
      )

      const [recovered] = await claimCheckout(sql, fixture.merchantId, {
        interval: "month",
        priceId: "price_changed_but_recovery_replays_saved",
      })
      assert.equal(recovered.claim_status, "claimed")
      assert.equal(recovered.attempt_id, winner.attempt_id)
      assert.equal(recovered.stripe_price_id, "price_month_49")
      assert.equal(recovered.stripe_customer_id, customerId)

      const [staleBind] = await sql`
        select public.bind_billing_checkout_customer(
          ${fixture.merchantId}::uuid,
          ${winner.attempt_id}::uuid,
          ${winner.worker_lease_id}::uuid,
          ${customerId}
        ) as bound`
      assert.equal(staleBind.bound, false)

      const sessionId = `cs_test_${fixture.short}`
      const [finalized] = await sql`
        select public.finalize_billing_checkout_session(
          ${fixture.merchantId}::uuid,
          ${recovered.attempt_id}::uuid,
          ${recovered.worker_lease_id}::uuid,
          ${sessionId},
          ${`https://checkout.stripe.test/${sessionId}`},
          transaction_timestamp() + interval '1 hour'
        ) as finalized`
      assert.equal(finalized.finalized, true)
      const [finalizeClearedLease] = await sql`
        select public.release_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${recovered.attempt_id}::uuid,
          ${recovered.worker_lease_id}::uuid
        ) as released`
      assert.equal(finalizeClearedLease.released, false)

      const [existing] = await claimCheckout(sql, fixture.merchantId, {
        interval: "month",
        priceId: "price_month_49",
      })
      assert.equal(existing.claim_status, "existing")
      assert.equal(existing.stripe_checkout_session_id, sessionId)
      assert.equal(existing.worker_lease_id, null)

      const [conflict] = await claimCheckout(sql, fixture.merchantId, {
        interval: "year",
        priceId: "price_year_490",
      })
      assert.equal(conflict.claim_status, "interval_conflict")
      assert.equal(conflict.worker_lease_id, null)

      const [wrongRotation] = await sql`
        select * from public.rotate_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${existing.attempt_id}::uuid,
          'cs_wrong',
          'year',
          'price_year_490',
          'http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          'http://localhost:3000/app/account?checkout=cancelled',
          transaction_timestamp() + interval '1 day'
        )`
      assert.equal(wrongRotation.rotation_status, "conflict")

      const [rotated] = await sql`
        select * from public.rotate_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${existing.attempt_id}::uuid,
          ${sessionId},
          'year',
          'price_year_490',
          'http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          'http://localhost:3000/app/account?checkout=cancelled',
          transaction_timestamp() + interval '1 day'
        )`
      assert.equal(rotated.rotation_status, "claimed")
      assert.notEqual(rotated.attempt_id, existing.attempt_id)
      assert.ok(rotated.worker_lease_id)
      assert.equal(rotated.stripe_customer_id, customerId)
      assert.equal(
        rotated.success_url,
        "http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}"
      )
      assert.equal(
        rotated.cancel_url,
        "http://localhost:3000/app/account?checkout=cancelled",
        "rotation returns cancel_url in its own result column"
      )
      assert.ok(rotated.attempt_expires_at instanceof Date)

      const [releasedRotated] = await sql`
        select public.release_billing_checkout_attempt(
          ${fixture.merchantId}::uuid,
          ${rotated.attempt_id}::uuid,
          ${rotated.worker_lease_id}::uuid
        ) as released`
      assert.equal(releasedRotated.released, true)
      await sql`
        update public.billing_checkout_attempts
        set attempt_expires_at = transaction_timestamp() - interval '1 second'
        where merchant_id = ${fixture.merchantId}::uuid`
      const [recycled] = await claimCheckout(sql, fixture.merchantId, {
        interval: "month",
        priceId: "price_month_recycled",
      })
      assert.equal(recycled.claim_status, "claimed")
      assert.notEqual(
        recycled.attempt_id,
        rotated.attempt_id,
        "an expired attempt without a recorded Session must not strand checkout"
      )
      assert.equal(recycled.billing_interval, "month")
      assert.equal(recycled.stripe_price_id, "price_month_recycled")
      assert.equal(recycled.stripe_customer_id, customerId)
    } finally {
      await cleanupCommittedMerchant(fixture)
    }
  }
)

test(
  "webhook leases are retryable, reclaimable, fenced, and processed-terminal",
  { skip },
  async () => {
    await rolledBack(async (tx) => {
      const eventId = `evt_lease_${randomUUID()}`
      const [first] = await claimWebhook(tx, eventId, "2026-07-10T10:00:00Z")
      assert.equal(first.claim_status, "claimed")
      assert.equal(first.attempt_count, 1)
      assert.ok(first.lease_id)

      const [busy] = await claimWebhook(tx, eventId, "2026-07-10T10:00:00Z")
      assert.equal(busy.claim_status, "busy")
      assert.equal(busy.lease_id, null)
      assert.equal(busy.attempt_count, 1)

      const [staleFailure] = await tx`
        select public.fail_stripe_webhook_event(
          ${eventId},
          ${randomUUID()}::uuid,
          'processing_failed'
        ) as failed`
      assert.equal(staleFailure.failed, false)

      const [failed] = await tx`
        select public.fail_stripe_webhook_event(
          ${eventId},
          ${first.lease_id}::uuid,
          'provider_timeout'
        ) as failed`
      assert.equal(failed.failed, true)

      const [retry] = await claimWebhook(tx, eventId, "2026-07-10T10:00:00Z")
      assert.equal(retry.claim_status, "claimed")
      assert.equal(retry.attempt_count, 2)
      assert.notEqual(retry.lease_id, first.lease_id)

      await tx`
        update public.stripe_webhook_events
        set lease_expires_at = transaction_timestamp() - interval '1 second'
        where stripe_event_id = ${eventId}`
      const [reclaimed] = await claimWebhook(tx, eventId, "2026-07-10T10:00:00Z")
      assert.equal(reclaimed.claim_status, "claimed")
      assert.equal(reclaimed.attempt_count, 3)
      assert.notEqual(reclaimed.lease_id, retry.lease_id)

      const [staleComplete] = await tx`
        select public.complete_stripe_webhook_event(
          ${eventId},
          ${retry.lease_id}::uuid
        ) as completed`
      assert.equal(staleComplete.completed, false)

      const [completed] = await tx`
        select public.complete_stripe_webhook_event(
          ${eventId},
          ${reclaimed.lease_id}::uuid
        ) as completed`
      assert.equal(completed.completed, true)

      const [terminal] = await claimWebhook(tx, eventId, "2026-07-10T10:00:00Z")
      assert.equal(terminal.claim_status, "processed")
      assert.equal(terminal.lease_id, null)
      assert.equal(terminal.attempt_count, 3)

      const finishAfterExpiryEventId = `evt_finish_expired_${randomUUID()}`
      const [finishAfterExpiryClaim] = await claimWebhook(
        tx,
        finishAfterExpiryEventId,
        "2026-07-10T10:00:01Z"
      )
      await tx`
        update public.stripe_webhook_events
        set lease_expires_at = transaction_timestamp() - interval '1 second'
        where stripe_event_id = ${finishAfterExpiryEventId}`
      const [finishedWithoutReclaim] = await tx`
        select public.complete_stripe_webhook_event(
          ${finishAfterExpiryEventId},
          ${finishAfterExpiryClaim.lease_id}::uuid
        ) as completed`
      assert.equal(
        finishedWithoutReclaim.completed,
        true,
        "the still-current nonce may finish after nominal expiry"
      )

      const legacyEventId = `evt_legacy_pending_${randomUUID()}`
      await tx`
        insert into public.stripe_webhook_events (
          stripe_event_id,
          event_type,
          livemode,
          stripe_created_at,
          received_at
        ) values (
          ${legacyEventId},
          'customer.subscription.updated',
          false,
          '2026-07-10T10:00:02Z'::timestamptz,
          transaction_timestamp()
        )`
      const [legacyBusy] = await claimWebhook(
        tx,
        legacyEventId,
        "2026-07-10T10:00:02Z"
      )
      assert.equal(legacyBusy.claim_status, "busy")
      assert.equal(legacyBusy.lease_id, null)
      assert.equal(legacyBusy.attempt_count, 0)
      await tx`
        update public.stripe_webhook_events
        set received_at = transaction_timestamp() - interval '6 minutes'
        where stripe_event_id = ${legacyEventId}`
      const [legacyReclaimed] = await claimWebhook(
        tx,
        legacyEventId,
        "2026-07-10T10:00:02Z"
      )
      assert.equal(legacyReclaimed.claim_status, "claimed")
      assert.equal(legacyReclaimed.attempt_count, 1)
    })
  }
)

test(
  "versioned and current subscription snapshots preserve full terms and obey both ordering axes atomically",
  { skip },
  async () => {
    await rolledBack(async (tx) => {
      const fixture = await createMerchant(tx, "ordering")
      const customerId = `cus_order_${fixture.short}`
      const [attempt] = await claimCheckout(tx, fixture.merchantId, {
        interval: "year",
        priceId: "price_year_490",
        customerId,
      })
      assert.equal(attempt.claim_status, "claimed")

      const firstEventId = `evt_zzz_${fixture.short}`
      const [firstClaim] = await claimWebhook(
        tx,
        firstEventId,
        "2026-07-10T10:00:00Z"
      )
      const firstResult = await applyEvent(tx, {
        eventId: firstEventId,
        leaseId: firstClaim.lease_id,
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_current_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-01T10:00:00Z",
        priceId: "price_year_490",
        interval: "year",
        amount: 49000,
        currency: "gbp",
        providerStatus: "trialing",
        entitlementStatus: "trialing",
        periodEnd: "2027-07-01T10:00:00Z",
        cancelAtPeriodEnd: true,
        cancelAt: "2027-07-01T10:00:00Z",
      })
      assert.equal(firstResult, "applied")

      const [blockedAfterSubscription] = await claimCheckout(
        tx,
        fixture.merchantId,
        {
          interval: "month",
          priceId: "price_month_49",
        }
      )
      assert.equal(blockedAfterSubscription.claim_status, "blocked")
      assert.equal(
        blockedAfterSubscription.attempt_id,
        null,
        "active/trialing billing never exposes or creates another attempt"
      )

      let state = await readBilling(tx, fixture.merchantId)
      assertBilling(state, {
        customerId,
        subscriptionId: `sub_current_${fixture.short}`,
        providerStatus: "trialing",
        priceId: "price_year_490",
        interval: "year",
        amount: 49000,
        currency: "gbp",
        cancelAtPeriodEnd: true,
        cancelAt: "2027-07-01T10:00:00.000Z",
        cursorId: firstEventId,
      })
      const [clearedAttempt] = await tx`
        select stripe_customer_id, attempt_id
        from public.billing_checkout_attempts
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(clearedAttempt.stripe_customer_id, customerId)
      assert.equal(clearedAttempt.attempt_id, null, "subscription clears attempt, not customer")

      const olderEventId = `evt_older_${fixture.short}`
      const [olderClaim] = await claimWebhook(
        tx,
        olderEventId,
        "2026-07-10T09:59:59Z"
      )
      const olderResult = await applyEvent(tx, {
        eventId: olderEventId,
        leaseId: olderClaim.lease_id,
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_current_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-01T10:00:00Z",
        priceId: "price_must_not_win",
        interval: "month",
        amount: 1,
        currency: "gbp",
        providerStatus: "canceled",
        entitlementStatus: "cancelled",
        periodEnd: "2026-07-02T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: null,
      })
      assert.equal(olderResult, "stale")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.stripe_price_id, "price_year_490")
      assert.equal(state.stripe_state_event_id, firstEventId)
      assert.equal(await isProcessed(tx, olderEventId), true, "stale is atomically processed")

      const equalEventId = `evt_aaa_${fixture.short}`
      const [equalClaim] = await claimWebhook(
        tx,
        equalEventId,
        "2026-07-10T10:00:00Z"
      )
      const equalResult = await applyEvent(tx, {
        eventId: equalEventId,
        leaseId: equalClaim.lease_id,
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_current_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-01T10:00:00Z",
        priceId: "price_year_current_hydrated",
        interval: "year",
        amount: 49000,
        currency: "gbp",
        providerStatus: "active",
        entitlementStatus: "active",
        periodEnd: "2027-07-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: null,
      })
      assert.equal(equalResult, "applied", "equal timestamps may hydrate current state")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.stripe_state_event_id, equalEventId)
      assert.equal(state.stripe_subscription_status, "active")

      const oldSubscriptionEvent = `evt_later_old_sub_${fixture.short}`
      const [oldSubscriptionClaim] = await claimWebhook(
        tx,
        oldSubscriptionEvent,
        "2026-07-10T11:00:00Z"
      )
      const oldSubscriptionResult = await applyEvent(tx, {
        eventId: oldSubscriptionEvent,
        leaseId: oldSubscriptionClaim.lease_id,
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_older_${fixture.short}`,
        subscriptionCreatedAt: "2026-06-01T10:00:00Z",
        priceId: "price_old_sub",
        interval: "month",
        amount: 100,
        currency: "gbp",
        providerStatus: "canceled",
        entitlementStatus: "cancelled",
        periodEnd: "2026-07-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: null,
      })
      assert.equal(oldSubscriptionResult, "stale", "later old-sub event cannot repoint")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.stripe_subscription_id, `sub_current_${fixture.short}`)

      const newerSubscriptionEvent = `evt_new_sub_${fixture.short}`
      const [newerSubscriptionClaim] = await claimWebhook(
        tx,
        newerSubscriptionEvent,
        "2026-07-10T09:00:00Z"
      )
      const newerSubscriptionResult = await applyEvent(tx, {
        eventId: newerSubscriptionEvent,
        leaseId: newerSubscriptionClaim.lease_id,
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_newer_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-02T10:00:00Z",
        priceId: "price_month_49",
        interval: "month",
        amount: 4900,
        currency: "gbp",
        providerStatus: "active",
        entitlementStatus: "active",
        periodEnd: "2026-08-02T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: null,
      })
      assert.equal(newerSubscriptionResult, "applied", "newer Subscription wins")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.stripe_subscription_id, `sub_newer_${fixture.short}`)
      assert.equal(state.stripe_state_event_id, newerSubscriptionEvent)

      const cursorBeforeCurrent = state.stripe_state_event_id
      const revisionBeforeCurrent = state.billing_revision
      const [revisionReadback] = await tx`
        select updated_at = ${revisionBeforeCurrent}::text::timestamptz as matches
        from public.billing_customers
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(
        revisionReadback.matches,
        true,
        "the captured row revision round-trips exactly"
      )
      const currentResult = await applyCurrent(tx, {
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_newer_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-02T10:00:00Z",
        priceId: "price_month_49",
        interval: "month",
        amount: 4900,
        currency: "gbp",
        providerStatus: "active",
        entitlementStatus: "active",
        periodEnd: "2026-08-02T10:00:00Z",
        cancelAtPeriodEnd: true,
        cancelAt: "2026-08-02T10:00:00Z",
        expectedBillingUpdatedAt: revisionBeforeCurrent,
      })
      assert.equal(currentResult, "applied")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.cancel_at_period_end, true)
      assert.equal(state.stripe_state_event_id, cursorBeforeCurrent, "current sync preserves cursor")

      const customCancellationResult = await applyCurrent(tx, {
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_newer_${fixture.short}`,
        subscriptionCreatedAt: "2026-07-02T10:00:00Z",
        priceId: "price_month_49",
        interval: "month",
        amount: 4900,
        currency: "gbp",
        providerStatus: "active",
        entitlementStatus: "active",
        periodEnd: "2026-08-02T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: "2026-07-20T12:00:00Z",
        expectedBillingUpdatedAt: revisionBeforeCurrent,
      })
      assert.equal(customCancellationResult, "applied")
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.cancel_at_period_end, false)
      assert.equal(
        state.cancel_at.toISOString(),
        "2026-07-20T12:00:00.000Z",
        "a custom Stripe cancel_at is preserved independently of period-end cancellation"
      )
      assert.equal(state.stripe_state_event_id, cursorBeforeCurrent)

      const staleCurrentResult = await applyCurrent(tx, {
        merchantId: fixture.merchantId,
        customerId,
        subscriptionId: `sub_older_${fixture.short}`,
        subscriptionCreatedAt: "2026-06-01T10:00:00Z",
        priceId: "price_should_not_win",
        interval: "year",
        amount: 1,
        currency: "gbp",
        providerStatus: "canceled",
        entitlementStatus: "cancelled",
        periodEnd: "2026-07-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancelAt: null,
        expectedBillingUpdatedAt: revisionBeforeCurrent,
      })
      assert.equal(staleCurrentResult, "stale")

      const rollbackEventId = `evt_rollback_${fixture.short}`
      const [rollbackClaim] = await claimWebhook(
        tx,
        rollbackEventId,
        "2026-07-10T12:00:00Z"
      )
      await tx`
        create function pg_temp.reject_selected_webhook_completion()
        returns trigger
        language plpgsql
        as $trigger$
        begin
          if new.stripe_event_id = current_setting('test.block_stripe_event_id', true) then
            raise exception 'test-induced processed marker failure';
          end if;
          return new;
        end
        $trigger$`
      await tx`
        create trigger billing_state_atomic_rollback_probe
        before update of processed_at on public.stripe_webhook_events
        for each row
        execute function pg_temp.reject_selected_webhook_completion()`
      await tx`select set_config('test.block_stripe_event_id', ${rollbackEventId}, true)`
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await applyEvent(sp, {
            eventId: rollbackEventId,
            leaseId: rollbackClaim.lease_id,
            merchantId: fixture.merchantId,
            customerId,
            subscriptionId: `sub_newer_${fixture.short}`,
            subscriptionCreatedAt: "2026-07-02T10:00:00Z",
            priceId: "price_would_change_without_atomicity",
            interval: "month",
            amount: 5000,
            currency: "gbp",
            providerStatus: "active",
            entitlementStatus: "active",
            periodEnd: "2026-08-02T10:00:00Z",
            cancelAtPeriodEnd: false,
            cancelAt: null,
          })
        }),
        /test-induced processed marker failure/
      )
      assert.equal(await isProcessed(tx, rollbackEventId), false)
      state = await readBilling(tx, fixture.merchantId)
      assert.equal(state.stripe_price_id, "price_month_49", "failed event rolls billing back")
    })
  }
)

test(
  "a delayed current-provider return cannot roll back a newer webhook snapshot",
  { skip },
  async () => {
    const fixture = await createCommittedMerchant("return-webhook-cas")
    const customerId = `cus_cas_${fixture.short}`
    const subscriptionId = `sub_cas_${fixture.short}`
    const eventId = `evt_cas_cancel_${fixture.short}`

    const activeSnapshot = {
      merchantId: fixture.merchantId,
      customerId,
      subscriptionId,
      subscriptionCreatedAt: "2026-07-01T10:00:00Z",
      priceId: "price_month_49",
      interval: "month",
      amount: 4900,
      currency: "gbp",
      providerStatus: "active",
      entitlementStatus: "active",
      periodEnd: "2026-08-01T10:00:00Z",
      cancelAtPeriodEnd: false,
      cancelAt: null,
    }

    try {
      assert.equal(
        await applyCurrent(sql, {
          ...activeSnapshot,
          expectedBillingUpdatedAt: null,
        }),
        "applied"
      )

      const beforeWebhook = await readBilling(sql, fixture.merchantId)
      const staleReturnRevision = beforeWebhook.billing_revision
      await sql`select pg_sleep(0.01)`

      const [claim] = await claimWebhook(
        sql,
        eventId,
        "2026-07-10T13:00:00Z"
      )
      assert.equal(
        await applyEvent(sql, {
          ...activeSnapshot,
          eventId,
          leaseId: claim.lease_id,
          providerStatus: "canceled",
          entitlementStatus: "cancelled",
        }),
        "applied"
      )

      const afterWebhook = await readBilling(sql, fixture.merchantId)
      assert.notEqual(
        afterWebhook.billing_revision,
        staleReturnRevision,
        "the webhook advances the billing-row revision"
      )

      assert.equal(
        await applyCurrent(sql, {
          ...activeSnapshot,
          expectedBillingUpdatedAt: staleReturnRevision,
        }),
        "stale",
        "the return read before the webhook cannot commit after it"
      )

      const finalState = await readBilling(sql, fixture.merchantId)
      assert.equal(finalState.stripe_subscription_status, "canceled")
      assert.equal(finalState.status, "cancelled")
      assert.equal(finalState.stripe_state_event_id, eventId)
      assert.equal(
        finalState.billing_revision,
        afterWebhook.billing_revision,
        "a rejected stale return leaves the authoritative row untouched"
      )
    } finally {
      await sql`
        delete from public.stripe_webhook_events
        where stripe_event_id = ${eventId}`
      await cleanupCommittedMerchant(fixture)
    }
  }
)

async function claimCheckout(
  tx,
  merchantId,
  {
    interval,
    priceId,
    customerId = null,
    successUrl = "http://localhost:3000/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    cancelUrl = "http://localhost:3000/app/account?checkout=cancelled",
  }
) {
  return tx`
    select * from public.claim_billing_checkout_attempt(
      ${merchantId}::uuid,
      ${interval},
      ${priceId},
      ${successUrl},
      ${cancelUrl},
      transaction_timestamp() + interval '1 day',
      ${customerId}
    )`
}

async function claimWebhook(tx, eventId, createdAt) {
  return tx`
    select * from public.claim_stripe_webhook_event(
      ${eventId},
      'customer.subscription.updated',
      false,
      ${createdAt}::timestamptz
    )`
}

async function applyEvent(tx, snapshot) {
  const [row] = await tx`
    select public.apply_stripe_subscription_event(
      ${snapshot.eventId},
      ${snapshot.leaseId}::uuid,
      ${snapshot.merchantId}::uuid,
      ${snapshot.customerId},
      ${snapshot.subscriptionId},
      ${snapshot.providerStatus},
      ${snapshot.subscriptionCreatedAt}::timestamptz,
      ${snapshot.priceId},
      ${snapshot.interval},
      ${snapshot.amount}::bigint,
      ${snapshot.currency},
      ${snapshot.periodEnd}::timestamptz,
      ${snapshot.cancelAtPeriodEnd},
      ${snapshot.cancelAt}::timestamptz,
      ${snapshot.entitlementStatus}
    ) as result`
  return row.result
}

async function applyCurrent(tx, snapshot) {
  const [row] = await tx`
    select public.apply_current_stripe_subscription(
      ${snapshot.merchantId}::uuid,
      ${snapshot.customerId},
      ${snapshot.subscriptionId},
      ${snapshot.providerStatus},
      ${snapshot.subscriptionCreatedAt}::timestamptz,
      ${snapshot.priceId},
      ${snapshot.interval},
      ${snapshot.amount}::bigint,
      ${snapshot.currency},
      ${snapshot.periodEnd}::timestamptz,
      ${snapshot.cancelAtPeriodEnd},
      ${snapshot.cancelAt}::timestamptz,
      ${snapshot.entitlementStatus},
      ${snapshot.expectedBillingUpdatedAt}::text::timestamptz
    ) as result`
  return row.result
}

async function readBilling(tx, merchantId) {
  const [row] = await tx`
    select
      stripe_customer_id,
      stripe_subscription_id,
      stripe_subscription_status,
      stripe_subscription_created_at,
      stripe_price_id,
      billing_interval,
      unit_amount::int,
      currency,
      status,
      current_period_end,
      cancel_at_period_end,
      cancel_at,
      stripe_state_event_created_at,
      stripe_state_event_id,
      updated_at::text as billing_revision
    from public.billing_customers
    where merchant_id = ${merchantId}::uuid`
  return row
}

function assertBilling(actual, expected) {
  assert.equal(actual.stripe_customer_id, expected.customerId)
  assert.equal(actual.stripe_subscription_id, expected.subscriptionId)
  assert.equal(actual.stripe_subscription_status, expected.providerStatus)
  assert.equal(actual.stripe_price_id, expected.priceId)
  assert.equal(actual.billing_interval, expected.interval)
  assert.equal(actual.unit_amount, expected.amount)
  assert.equal(actual.currency, expected.currency)
  assert.equal(actual.cancel_at_period_end, expected.cancelAtPeriodEnd)
  assert.equal(actual.cancel_at?.toISOString() ?? null, expected.cancelAt)
  assert.equal(actual.stripe_state_event_id, expected.cursorId)
}

async function isProcessed(tx, eventId) {
  const [row] = await tx`
    select processed_at is not null as processed
    from public.stripe_webhook_events
    where stripe_event_id = ${eventId}`
  return row.processed
}

async function createMerchant(tx, label) {
  const ownerId = randomUUID()
  const merchantId = randomUUID()
  const short = merchantId.slice(0, 8)
  await tx`insert into auth.users (id) values (${ownerId}::uuid)`
  await tx`
    insert into public.merchants (
      id,
      owner_user_id,
      business_name,
      business_slug,
      business_type,
      email,
      status
    ) values (
      ${merchantId}::uuid,
      ${ownerId}::uuid,
      ${`Billing ${label}`},
      ${`billing-${label}-${short}`},
      'pub',
      ${`billing-${short}@example.test`},
      'trial'
    )`
  return { merchantId, ownerId, short }
}

async function createCommittedMerchant(label) {
  assert.ok(sql)
  return sql.begin(async (tx) => createMerchant(tx, label))
}

async function cleanupCommittedMerchant(fixture) {
  assert.ok(sql)
  await sql.begin(async (tx) => {
    await tx`delete from public.merchants where id = ${fixture.merchantId}::uuid`
    await tx`delete from auth.users where id = ${fixture.ownerId}::uuid`
  })
}

async function rolledBack(fn) {
  assert.ok(sql)
  const ROLLBACK = Symbol("rollback")
  try {
    await sql.begin(async (tx) => {
      await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
}

async function expectConstraint(tx, action) {
  await assert.rejects(tx.savepoint(action), (error) => error?.code === "23514")
}

function createBarrier(participants) {
  let arrived = 0
  let release
  const open = new Promise((resolve) => {
    release = resolve
  })
  return async () => {
    arrived += 1
    if (arrived === participants) release()
    await open
  }
}

function resolveLocalDbUrl() {
  const env = {
    ...readEnvFile(path.join(process.cwd(), ".env")),
    ...readEnvFile(path.join(process.cwd(), ".env.local")),
    ...process.env,
  }
  const value = env.SUPABASE_DB_URL?.trim()
  if (!value) return ""

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid local PostgreSQL URL")
  }
  if (!LOCAL_DB_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `Refusing billing durability DB proof against hosted host ${parsed.hostname}`
    )
  }
  return value
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const values = {}
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const index = trimmed.indexOf("=")
    if (index < 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
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
