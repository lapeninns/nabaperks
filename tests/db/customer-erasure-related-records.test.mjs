import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

/**
 * db privacy lifecycle — erasure must de-activate the whole customer, not
 * just the profile row.
 *
 * `admin_erase_customer_pii` (single admin-executed erasure) and
 * `admin_purge_stale_customer_pii` (retention job) previously anonymised the
 * `customers` row and scrubbed pending invites, but left the customer's
 * `customer_sessions` active, `push_subscriptions` enabled, and pending
 * `notification_events` (`queued` / `delivering`) unsent — so a session kept
 * working and notifications still fired at an erased person.
 *
 * These tests EXECUTE the real RPCs and prove the three new revocations, while
 * asserting the invariants that must NOT change: terminal notification history
 * and the loyalty ledger are retained, and the purge self-guard is preserved.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

/** Insert an active (non-revoked) session, an enabled push subscription, and
 * one notification per status we care about. Returns their ids. */
async function seedRelatedRecords(tx, customerId, merchantId) {
  const sessionId = randomUUID()
  await tx`
    insert into public.customer_sessions (id, customer_id, expires_at)
    values (${sessionId}::uuid, ${customerId}::uuid, now() + interval '30 days')`

  const [push] = await tx`
    insert into public.push_subscriptions
      (customer_id, endpoint, p256dh, auth, enabled)
    values (${customerId}::uuid,
            ${"https://fcm.googleapis.com/fcm/send/" + randomUUID()},
            ${"p256dh-" + randomUUID()},
            ${"auth-" + randomUUID()},
            true)
    returning id`

  const notif = {}
  for (const status of ["queued", "delivering", "sent"]) {
    const [row] = await tx`
      insert into public.notification_events
        (customer_id, merchant_id, event_type, category, dedupe_key, status, due_at, sent_at)
      values (${customerId}::uuid, ${merchantId}::uuid, 'reward_ready',
              'transactional', ${status + "-" + randomUUID()}, ${status}, now(),
              ${status === "sent" ? new Date() : null})
      returning id`
    notif[status] = row.id
  }

  return { sessionId, pushId: push.id, notif }
}

test(
  "admin_erase_customer_pii revokes sessions, disables push, cancels pending notifications, retains ledger + history",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "the seeded journey venue exists")

      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, date_of_birth,
           phone_last4, phone_verified_at, created_at, updated_at)
        values (${`erase-${randomUUID()}@test.local`}, now(), 'Erase Me',
                '1988-02-02', '4321', now(), now(), now())
        returning id`
      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      const membershipId = joined.membership_id
      const [{ n: stampsBefore }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${membershipId} and event_type = 'earned'`
      assert.ok(stampsBefore >= 1, "the customer has a real stamp ledger")

      const seeded = await seedRelatedRecords(tx, customer.id, v.merchant_id)

      // Authorised erasure as the seeded internal admin.
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const [{ result }] = await tx`
        select public.admin_erase_customer_pii(
          ${customer.id}::uuid, ${v.merchant_id}::uuid, 'email',
          'Customer-requested erasure, verified via email.') as result`
      assert.equal(result.ok, true, "erasure reports success")

      // ---- Sessions revoked.
      const [session] = await tx`
        select revoked_at from public.customer_sessions where id = ${seeded.sessionId}::uuid`
      assert.ok(session.revoked_at, "the active session is revoked")

      // ---- Push disabled.
      const [push] = await tx`
        select enabled, revoked_at from public.push_subscriptions where id = ${seeded.pushId}`
      assert.equal(push.enabled, false, "the push subscription is disabled")
      assert.ok(
        push.revoked_at,
        "the push subscription carries a revoked timestamp"
      )

      // ---- Pending notifications cancelled; terminal history retained.
      const [queued] = await tx`
        select status, cancelled_at from public.notification_events where id = ${seeded.notif.queued}`
      assert.equal(
        queued.status,
        "cancelled",
        "the queued notification is cancelled"
      )
      assert.ok(
        queued.cancelled_at,
        "the cancelled notification carries a timestamp"
      )

      const [delivering] = await tx`
        select status from public.notification_events where id = ${seeded.notif.delivering}`
      assert.equal(
        delivering.status,
        "cancelled",
        "the delivering notification is cancelled"
      )

      const [sent] = await tx`
        select status from public.notification_events where id = ${seeded.notif.sent}`
      assert.equal(
        sent.status,
        "sent",
        "terminal (sent) notification history is retained"
      )

      // ---- The loyalty ledger is RETAINED.
      const [{ n: membershipsAfter }] = await tx`
        select count(*)::int as n from public.customer_memberships where id = ${membershipId}`
      assert.equal(membershipsAfter, 1, "membership row is retained")
      const [{ n: stampsAfter }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${membershipId} and event_type = 'earned'`
      assert.equal(stampsAfter, stampsBefore, "stamp ledger is fully retained")
    })
  }
)

test(
  "admin_purge_stale_customer_pii applies the same session/push/notification revocation",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "the seeded journey venue exists")

      // A stale, membership-less customer: qualifies for the retention purge
      // under the default 365-day cutoff.
      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, phone_last4, created_at, updated_at)
        values (${`stale-${randomUUID()}@test.local`}, now() - interval '400 days',
                'Stale Person', '9876',
                now() - interval '400 days', now() - interval '400 days')
        returning id`

      const seeded = await seedRelatedRecords(tx, customer.id, v.merchant_id)

      // inRolledBackTxn already sets request.jwt.claim.role = service_role, so
      // the self-guard passes; use the default cutoff.
      const [{ purged }] = await tx`
        select public.admin_purge_stale_customer_pii() as purged`
      assert.ok(purged >= 1, "at least the stale customer was purged")

      const [{ email }] =
        await tx`select email from public.customers where id = ${customer.id}`
      assert.match(
        email,
        /^erased\+[0-9a-f]+@privacy\.invalid$/i,
        "the stale customer is anonymised"
      )

      const [session] = await tx`
        select revoked_at from public.customer_sessions where id = ${seeded.sessionId}::uuid`
      assert.ok(session.revoked_at, "the stale customer's session is revoked")

      const [push] = await tx`
        select enabled, revoked_at from public.push_subscriptions where id = ${seeded.pushId}`
      assert.equal(
        push.enabled,
        false,
        "the stale customer's push subscription is disabled"
      )
      assert.ok(
        push.revoked_at,
        "the stale customer's push subscription carries a revoked timestamp"
      )

      const [queued] = await tx`
        select status from public.notification_events where id = ${seeded.notif.queued}`
      assert.equal(
        queued.status,
        "cancelled",
        "the stale customer's queued notification is cancelled"
      )

      const [sent] = await tx`
        select status from public.notification_events where id = ${seeded.notif.sent}`
      assert.equal(
        sent.status,
        "sent",
        "terminal notification history is retained by the purge"
      )
    })
  }
)
