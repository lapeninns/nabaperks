import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "Given first-stamp issuance fails after membership creation When recovery is retried Then one durable record resolves to exactly one stamp",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [fixture] = await tx`
        select
          qr.qr_id,
          qr.loyalty_card_id,
          merchants.id as merchant_id,
          merchants.business_slug
        from public.qr_codes qr
        join public.merchants merchants on merchants.id = qr.merchant_id
        where qr.is_active
          and qr.destination_type = 'join'
          and merchants.status in ('trial', 'active')
          and exists (
            select 1 from public.reward_pool_items rewards
            where rewards.loyalty_card_id = qr.loyalty_card_id
              and rewards.is_active
          )
        order by qr.created_at
        limit 1`
      assert.ok(fixture)

      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`recovery-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      assert.ok(customer?.id)

      await tx`
        update public.loyalty_cards
        set stamps_required = 1
        where id = ${fixture.loyalty_card_id}`
      await tx`
        update public.reward_pool_items
        set is_active = false
        where loyalty_card_id = ${fixture.loyalty_card_id}`

      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid,
          ${fixture.business_slug},
          ${fixture.qr_id},
          false,
          '2026-06-06'
        )`

      assert.equal(joined.created_membership, true)
      assert.equal(joined.first_stamp_issued, false)
      assert.equal(joined.first_stamp_reason, "reward_pool_unavailable")
      assert.equal(joined.first_stamp_resolution, "venue_action")

      const [pending] = await tx`
        select reason, resolution, status, attempt_count
        from public.customer_join_stamp_recoveries
        where membership_id = ${joined.membership_id}`
      assert.deepEqual(pending, {
        reason: "reward_pool_unavailable",
        resolution: "venue_action",
        status: "pending",
        attempt_count: 1,
      })

      const [{ stamps: beforeRetry }] = await tx`
        select count(*)::int as stamps
        from public.stamp_events
        where membership_id = ${joined.membership_id}
          and event_type = 'earned'`
      assert.equal(beforeRetry, 0)

      await tx`
        update public.reward_pool_items
        set is_active = true
        where loyalty_card_id = ${fixture.loyalty_card_id}`
      await tx`
        update public.customer_join_stamp_recoveries
        set reason = 'transient',
            resolution = 'retry',
            retry_until = now() + interval '10 minutes'
        where membership_id = ${joined.membership_id}`

      const [retried] = await tx`
        select * from public.retry_customer_join_first_stamp(
          ${joined.membership_id}::uuid,
          ${customer.id}::uuid
        )`
      assert.equal(retried.outcome, "issued")

      const [replayed] = await tx`
        select * from public.retry_customer_join_first_stamp(
          ${joined.membership_id}::uuid,
          ${customer.id}::uuid
        )`
      assert.equal(replayed.outcome, "not_found")

      const [foreignCustomer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`foreign-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      const [foreignRetry] = await tx`
        select * from public.retry_customer_join_first_stamp(
          ${joined.membership_id}::uuid,
          ${foreignCustomer.id}::uuid
        )`
      assert.equal(foreignRetry.outcome, "not_found")

      const [{ stamps: afterRetry }] = await tx`
        select count(*)::int as stamps
        from public.stamp_events
        where membership_id = ${joined.membership_id}
          and event_type = 'earned'`
      assert.equal(afterRetry, 1)

      const [resolved] = await tx`
        select status, resolved_at is not null as has_resolved_at
        from public.customer_join_stamp_recoveries
        where membership_id = ${joined.membership_id}`
      assert.deepEqual(resolved, { status: "resolved", has_resolved_at: true })
    })
  }
)
