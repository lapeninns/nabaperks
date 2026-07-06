import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-db-integrity-hardening — live-DB tier.
 *
 * Status⇒timestamp coherence on reward_events / notification_events was RPC
 * convention only; this suite pins the new CHECK enforcement (impossible
 * states rejected, the coherent shapes the RPCs actually write still pass),
 * the stale rate-limit purge (in-flight windows untouched), the nine FK
 * support indexes, and that no NOT VALID constraint remains anywhere.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id, lc.id as loyalty_card_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

async function seedRewardEvent(tx) {
  const [v] = await tx.unsafe(PICK)
  assert.ok(v, "the seeded journey venue exists")

  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, created_at, updated_at)
    values (${`integrity-${randomUUID()}@test.local`}, now(), 'Integrity Check', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`

  const [reward] = await tx`
    insert into public.reward_events
      (merchant_id, customer_id, membership_id, loyalty_card_id, status,
       reward_name, reward_terms, cycle_number, source)
    values (${v.merchant_id}::uuid, ${customer.id}::uuid,
            ${joined.membership_id}::uuid, ${v.loyalty_card_id}::uuid,
            'unlocked', 'Integrity reward', 'Integrity reward terms text.',
            1, 'stamp_cycle')
    returning id`

  return { venue: v, customerId: customer.id, membershipId: joined.membership_id, rewardId: reward.id }
}

async function expectCheckViolation(tx, label, fn) {
  let refused = false
  try {
    await tx.savepoint(fn)
  } catch (error) {
    refused = error?.code === "23514" || /check constraint/i.test(String(error.message))
  }
  assert.ok(refused, label)
}

test("incoherent reward states are rejected; coherent ones pass", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const { rewardId } = await seedRewardEvent(tx)

    await expectCheckViolation(tx, "redeemed without redeemed_at is rejected", (sp) =>
      sp`update public.reward_events set status = 'redeemed' where id = ${rewardId}`
    )
    await expectCheckViolation(tx, "expired without expired_at is rejected", (sp) =>
      sp`update public.reward_events set status = 'expired' where id = ${rewardId}`
    )
    await expectCheckViolation(tx, "cancelled without a reason is rejected", (sp) =>
      sp`update public.reward_events set status = 'cancelled' where id = ${rewardId}`
    )

    // The shapes the RPCs actually write still pass.
    await tx`update public.reward_events
             set status = 'redeemed', redeemed_at = now() where id = ${rewardId}`
    const [row] = await tx`select status from public.reward_events where id = ${rewardId}`
    assert.equal(row.status, "redeemed", "the coherent redeemed shape is accepted")
  })
})

test("incoherent notification states are rejected; coherent ones pass", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const { customerId } = await seedRewardEvent(tx)
    const [event] = await tx`
      insert into public.notification_events
        (event_type, category, customer_id, dedupe_key, status)
      values ('reward_ready', 'transactional', ${customerId}::uuid,
              ${`integrity-${randomUUID()}`}, 'queued')
      returning id`

    await expectCheckViolation(tx, "sent without sent_at is rejected", (sp) =>
      sp`update public.notification_events set status = 'sent' where id = ${event.id}`
    )
    await expectCheckViolation(tx, "cancelled without cancelled_at is rejected", (sp) =>
      sp`update public.notification_events set status = 'cancelled' where id = ${event.id}`
    )

    await tx`update public.notification_events
             set status = 'sent', sent_at = now() where id = ${event.id}`
    const [row] = await tx`select status from public.notification_events where id = ${event.id}`
    assert.equal(row.status, "sent", "the coherent sent shape is accepted")
  })
})

test("the stale-bucket purge removes only long-expired windows", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const stale = `integrity-stale-${randomUUID()}`
    const recent = `integrity-recent-${randomUUID()}`
    const inflight = `integrity-inflight-${randomUUID()}`
    await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
             values (${stale}, 3, now() - interval '3 days'),
                    (${recent}, 3, now() - interval '2 hours'),
                    (${inflight}, 3, now() + interval '1 hour')`

    const [{ purged }] = await tx`select public.purge_stale_rate_limit_buckets() as purged`
    assert.ok(purged >= 1, "the purge reports deleted rows")

    const rows = await tx`
      select bucket_key from public.rate_limit_buckets
      where bucket_key in (${stale}, ${recent}, ${inflight})`
    const keys = rows.map((row) => row.bucket_key)
    assert.ok(!keys.includes(stale), "the 3-day-old bucket is purged")
    assert.ok(keys.includes(recent), "a window ended 2h ago is inside the grace period")
    assert.ok(keys.includes(inflight), "an in-flight window is never touched")
  })
})

test("the nine FK support indexes exist", { skip }, async () => {
  const sql = db()
  const expected = [
    "fraud_flags_customer_id_idx",
    "fraud_flags_membership_id_idx",
    "notification_events_merchant_id_idx",
    "notification_events_membership_id_idx",
    "reward_scan_tokens_membership_id_idx",
    "reward_scan_tokens_consumed_by_merchant_id_idx",
    "pending_reward_invites_attached_customer_id_idx",
    "pending_reward_invites_attached_membership_id_idx",
    "pending_reward_invites_attached_reward_event_id_idx",
  ]
  const rows = await sql.unsafe(
    `select indexname from pg_indexes
     where schemaname='public' and indexname in (${expected.map((name) => `'${name}'`).join(", ")})`
  )
  assert.equal(rows.length, expected.length, "every FK support index exists")
})

test("no NOT VALID constraint remains in the public schema", { skip }, async () => {
  const sql = db()
  const rows = await sql.unsafe(
    `select conname from pg_constraint
     where connamespace = 'public'::regnamespace and not convalidated`
  )
  assert.deepEqual(
    rows.map((row) => row.conname),
    [],
    "every constraint (including the push endpoint allowlist) is validated"
  )
})
