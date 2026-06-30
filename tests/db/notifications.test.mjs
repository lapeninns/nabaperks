import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-notifications — live-DB tier.
 *
 * The durable notification queue was previously covered only by source-grep.
 * This executes the real `claim_due_notification_events` RPC (the cron worker's
 * claim step) and proves the queue semantics that keep a notification from being
 * delivered twice or early:
 *   - it claims only DUE queued events (due_at <= now), flipping them to
 *     'delivering' so a second worker can't re-claim them,
 *   - it leaves not-yet-due events 'queued',
 *   - it honours the batch limit.
 *
 * The atomic no-double-claim property comes from `FOR UPDATE SKIP LOCKED`; its
 * concurrency behaviour is the same race proven for stamps/tokens in
 * architecture-moat. Here we pin the transition deterministically by parking any
 * pre-existing due events first (rolled back), so the claim set is exactly ours.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// Insert a notification_event directly so we control status + due_at precisely.
async function enqueue(tx, customerId, { dueOffset, dedupe }) {
  const [row] = await tx`
    insert into public.notification_events
      (event_type, category, customer_id, status, due_at, dedupe_key, payload, metadata,
       created_at, updated_at)
    values ('reward_ready', 'reminder', ${customerId}, 'queued',
            now() + (${dueOffset} || ' seconds')::interval, ${dedupe},
            '{}'::jsonb, '{}'::jsonb, now(), now())
    returning id`
  return row.id
}

test(
  "claim: takes only due events, flips them to delivering, leaves the rest queued",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`notif-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`

      // Park any pre-existing due/queued events so the claim set is exactly ours.
      await tx`update public.notification_events
             set due_at = now() + interval '1 day' where status = 'queued'`

      const dueId = await enqueue(tx, customer.id, {
        dueOffset: "-60",
        dedupe: `due-${randomUUID()}`,
      })
      const futureId = await enqueue(tx, customer.id, {
        dueOffset: "3600",
        dedupe: `future-${randomUUID()}`,
      })

      const claimed = await tx`
      select id from public.claim_due_notification_events(now(), 50)`
      const claimedIds = claimed.map((r) => r.id)
      assert.ok(claimedIds.includes(dueId), "the due event is claimed")
      assert.ok(
        !claimedIds.includes(futureId),
        "the not-yet-due event is NOT claimed"
      )

      const [due] =
        await tx`select status from public.notification_events where id = ${dueId}`
      assert.equal(
        due.status,
        "delivering",
        "a claimed event flips queued → delivering"
      )
      const [future] =
        await tx`select status from public.notification_events where id = ${futureId}`
      assert.equal(future.status, "queued", "a future event stays queued")
    })
  }
)

test(
  "claim: honours the batch limit and leaves the remainder for the next run",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`notif-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      await tx`update public.notification_events
             set due_at = now() + interval '1 day' where status = 'queued'`

      const ids = []
      for (let i = 0; i < 3; i++) {
        ids.push(
          await enqueue(tx, customer.id, {
            dueOffset: "-60",
            dedupe: `batch-${i}-${randomUUID()}`,
          })
        )
      }

      const firstBatch =
        await tx`select id from public.claim_due_notification_events(now(), 2)`
      assert.equal(firstBatch.length, 2, "the limit caps the batch at 2")

      const [{ n: stillQueued }] = await tx`
      select count(*)::int as n from public.notification_events
      where id = any(${ids}) and status = 'queued'`
      assert.equal(
        stillQueued,
        1,
        "the third event waits, still queued, for the next run"
      )
    })
  }
)

test(
  "readback: delivery rows link by notification_event_id and exclude other customers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`notif-readback-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      const [otherCustomer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`notif-readback-other-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`

      const visibleId = await enqueue(tx, customer.id, {
        dueOffset: "-60",
        dedupe: `readback-${randomUUID()}`,
      })
      const otherId = await enqueue(tx, otherCustomer.id, {
        dueOffset: "-60",
        dedupe: `readback-other-${randomUUID()}`,
      })

      await tx`
      insert into public.notification_deliveries
        (notification_event_id, customer_id, status, attempt_number, response_status,
         failure_reason, metadata, created_at)
      values
        (${visibleId}, ${customer.id}, 'sent', 1, 200, null, '{}'::jsonb, now()),
        (${otherId}, ${otherCustomer.id}, 'sent', 1, 202, null, '{}'::jsonb, now())`

      const rows = await tx`
      select
        notification_events.id,
        notification_deliveries.notification_event_id,
        notification_deliveries.response_status
      from public.notification_events
      left join public.notification_deliveries
        on notification_deliveries.notification_event_id = notification_events.id
       and notification_deliveries.customer_id = ${customer.id}
      where notification_events.customer_id = ${customer.id}
        and notification_events.id in (${visibleId}, ${otherId})
      order by notification_events.created_at desc`

      assert.equal(
        rows.length,
        1,
        "only the current customer's event is returned"
      )
      assert.equal(
        rows[0]?.id,
        visibleId,
        "the visible event belongs to the current customer"
      )
      assert.equal(
        rows[0]?.notification_event_id,
        visibleId,
        "delivery readback joins through notification_event_id"
      )
      assert.equal(
        rows[0]?.response_status,
        200,
        "the current customer's delivery is visible"
      )
    })
  }
)

test(
  "push subscriptions: duplicate register reuses one row and disable records reason",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`push-${randomUUID()}@test.local`}, now(), now(), now())
      returning id`
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`

      const [{ register_push_subscription_for_customer: firstId }] = await tx`
      select public.register_push_subscription_for_customer(
        ${customer.id}::uuid,
        ${endpoint},
        ${"p".repeat(32)},
        ${"a".repeat(16)},
        'first agent',
        'granted'
      )`
      const [{ register_push_subscription_for_customer: secondId }] = await tx`
      select public.register_push_subscription_for_customer(
        ${customer.id}::uuid,
        ${` ${endpoint} `},
        ${"q".repeat(32)},
        ${"b".repeat(16)},
        'second agent',
        'granted'
      )`

      assert.equal(secondId, firstId, "duplicate endpoint reuses the row id")

      const [{ n: rowCount }] = await tx`
      select count(*)::int as n
      from public.push_subscriptions
      where customer_id = ${customer.id} and endpoint = ${endpoint}`
      assert.equal(rowCount, 1, "duplicate register keeps one active row")

      const [registered] = await tx`
      select p256dh, auth, user_agent, enabled, revoked_at
      from public.push_subscriptions
      where id = ${firstId}`
      assert.equal(registered.p256dh, "q".repeat(32))
      assert.equal(registered.auth, "b".repeat(16))
      assert.equal(registered.user_agent, "second agent")
      assert.equal(registered.enabled, true)
      assert.equal(registered.revoked_at, null)

      await tx`
      select public.disable_push_subscription_for_customer(
        ${customer.id}::uuid,
        ${endpoint},
        'service_worker_disabled'
      )`
      const [disabled] = await tx`
      select enabled, permission_state, revoked_at, failure_reason
      from public.push_subscriptions
      where id = ${firstId}`
      assert.equal(disabled.enabled, false)
      assert.equal(disabled.permission_state, "unknown")
      assert.notEqual(disabled.revoked_at, null)
      assert.equal(disabled.failure_reason, "service_worker_disabled")
    })
  }
)
