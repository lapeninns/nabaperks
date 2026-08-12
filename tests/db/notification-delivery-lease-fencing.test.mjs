import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

async function isolateQueue(tx) {
  await tx`update public.notification_events
           set due_at = now() + interval '1 day'
           where status = 'queued'`
  await tx`update public.notification_events
           set lease_expires_at = now() + interval '1 day'
           where status = 'delivering'`
}

async function createClaimedFixture(tx) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`delivery-fence-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  const [subscription] = await tx`
    insert into public.push_subscriptions
      (customer_id, endpoint, p256dh, auth, enabled, created_at, updated_at)
    values (${customer.id}, ${`https://fcm.googleapis.com/fcm/send/${randomUUID()}`},
            ${`p256dh-${randomUUID()}`}, ${`auth-${randomUUID()}`},
            true, now(), now())
    returning id`
  await isolateQueue(tx)
  const [event] = await tx`
    insert into public.notification_events
      (event_type, category, customer_id, status, due_at, dedupe_key,
       payload, metadata, created_at, updated_at)
    values ('reward_ready', 'transactional', ${customer.id}, 'queued', now() - interval '1 minute',
            ${`delivery-fence-${randomUUID()}`}, '{}'::jsonb, '{}'::jsonb, now(), now())
    returning id`
  const [claim] = await tx`
    select id, lease_token
    from public.claim_due_notification_events(now(), 1)`

  assert.equal(claim.id, event.id)
  assert.match(claim.lease_token, /^[0-9a-f-]{36}$/i)
  return { customer, subscription, event, claim }
}

async function recordSent(tx, fixture, leaseToken) {
  const [row] = await tx`
    select public.record_notification_delivery(
      p_notification_event_id => ${fixture.event.id}::uuid,
      p_push_subscription_id => ${fixture.subscription.id}::uuid,
      p_customer_id => ${fixture.customer.id}::uuid,
      p_status => 'sent',
      p_attempt_number => 1,
      p_response_status => 201,
      p_failure_reason => null,
      p_metadata => '{}'::jsonb,
      p_lease_token => ${leaseToken}::uuid
    ) as delivery_id`
  return row.delivery_id
}

test(
  "Given an event is reclaimed When stale and current claimants settle Then only the current lease changes state",
  { skip },
  async (t) => {
    await inRolledBackTxn(async (tx) => {
      // Given
      const fixture = await createClaimedFixture(tx)
      const staleLeaseToken = fixture.claim.lease_token
      await tx`update public.notification_events
               set lease_expires_at = now() - interval '1 second'
               where id = ${fixture.event.id}`
      const [currentClaim] = await tx`
        select id, lease_token
        from public.claim_due_notification_events(now(), 1)`
      assert.equal(currentClaim.id, fixture.event.id)
      assert.notEqual(currentClaim.lease_token, staleLeaseToken)

      // When
      const [staleSettlement] = await tx`
        select public.settle_notification_event(
          ${fixture.event.id}::uuid, ${staleLeaseToken}::uuid, 'sent', null
        ) as settled`
      const [currentSettlement] = await tx`
        select public.settle_notification_event(
          ${fixture.event.id}::uuid, ${currentClaim.lease_token}::uuid, 'sent', null
        ) as settled`

      // Then
      assert.equal(
        staleSettlement.settled,
        false,
        "stale claimant changes zero rows"
      )
      assert.equal(
        currentSettlement.settled,
        true,
        "current claimant settles once"
      )
      const [event] = await tx`
        select status, lease_token from public.notification_events
        where id = ${fixture.event.id}`
      assert.deepEqual(event, { status: "sent", lease_token: null })
      t.diagnostic("stale_settlement_rows=0 current_settlement_rows=1")
    })
  }
)

test(
  "Given stale and current claims race to anchor success When both record Then one successful ledger row exists and no provider is contacted",
  { skip },
  async (t) => {
    await inRolledBackTxn(async (tx) => {
      // Given
      let providerContactCount = 0
      const fixture = await createClaimedFixture(tx)
      const staleLeaseToken = fixture.claim.lease_token
      await tx`update public.notification_events
               set lease_expires_at = now() - interval '1 second'
               where id = ${fixture.event.id}`
      const [currentClaim] = await tx`
        select id, lease_token
        from public.claim_due_notification_events(now(), 1)`

      // When
      const staleDeliveryId = await recordSent(tx, fixture, staleLeaseToken)
      const currentDeliveryId = await recordSent(
        tx,
        fixture,
        currentClaim.lease_token
      )
      const repeatedCurrentDeliveryId = await recordSent(
        tx,
        fixture,
        currentClaim.lease_token
      )

      // Then
      assert.equal(staleDeliveryId, null, "stale claimant has no ledger anchor")
      assert.match(currentDeliveryId, /^[0-9a-f-]{36}$/i)
      assert.equal(
        repeatedCurrentDeliveryId,
        currentDeliveryId,
        "the current claimant reads the same atomic success anchor"
      )
      const [{ successfulDeliveryCount }] = await tx`
        select count(*)::int as "successfulDeliveryCount"
        from public.notification_deliveries
        where notification_event_id = ${fixture.event.id}
          and push_subscription_id = ${fixture.subscription.id}
          and status = 'sent'`
      assert.equal(successfulDeliveryCount, 1)
      assert.equal(
        providerContactCount,
        0,
        "the DB-only proof never contacts Web Push"
      )
      t.diagnostic(
        `successful_delivery_rows=${successfulDeliveryCount} provider_contact_count=${providerContactCount}`
      )
    })
  }
)

test(
  "Given a malformed lease token When settlement is attempted Then PostgreSQL rejects it before any provider contact",
  { skip },
  async (t) => {
    await inRolledBackTxn(async (tx) => {
      // Given
      let providerContactCount = 0
      const fixture = await createClaimedFixture(tx)

      // When / Then
      await assert.rejects(
        tx`select public.settle_notification_event(
          ${fixture.event.id}::uuid, ${"not-a-lease-token"}::uuid, 'sent', null
        )`,
        /invalid input syntax for type uuid/
      )
      assert.equal(providerContactCount, 0)
      t.diagnostic("malformed_lease_rejected=1 provider_contact_count=0")
    })
  }
)
