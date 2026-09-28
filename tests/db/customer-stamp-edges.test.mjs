import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { ensureVerifiedCustomerPhone } from "./helpers/verified-customer-phone.mjs"

/**
 * customer card stamp (edges) — live-DB tier.
 *
 * Beyond the one-per-UK-day moat, these prove the stamp RPC's other guards that
 * were previously untested at runtime:
 *   - a completed card opens the next cycle before redemption,
 *   - lowering stamps_required reconciles an already-complete in-flight cycle,
 *   - geofence is SOFT on stamping — an out-of-range trigger stamp still lands
 *     and merely raises a fraud flag,
 *   - the unlocking stamp is refused when the reward pool has < 3 active items.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug,
         lc.id as loyalty_card_id, lc.stamps_required, lc.location_id,
         ml.latitude, ml.longitude, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations ml on ml.id = lc.location_id
  join public.qr_codes q on q.merchant_id = m.id and q.is_active
    and q.destination_type = 'join' and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

// Helper bound to a txn: enrol a fresh customer and return the IDs + a stamp fn.
async function seed(tx) {
  const [v] = await tx.unsafe(PICK)
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, date_of_birth, created_at, updated_at)
    values (${`e2e-${randomUUID()}@test.local`}, now(), 'Edge Tester', '1990-01-01', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
  const membershipId = joined.membership_id
  const ageStamps = async () => {
    const rows = await tx`
      select id
      from public.stamp_events
      where membership_id = ${membershipId} and event_type = 'earned'
      order by earned_business_date asc nulls first, created_at asc, id asc`

    for (const [index, row] of rows.entries()) {
      const daysAgo = rows.length - index + 7
      await tx`
        update public.stamp_events
        set earned_business_date = (now() at time zone 'Europe/London')::date - ${daysAgo}::int
        where id = ${row.id}`
    }
  }
  // Stamp through the live 8-arg QR shim. lat/long override lets the geofence
  // test push the trigger stamp out of range; default is the venue itself.
  const stamp = (lat = v.latitude, long = v.longitude) => tx`
    select * from public.issue_self_service_stamp(
      ${membershipId}::uuid, ${customer.id}::uuid, ${v.qr_id}::text,
      ${lat}::numeric, ${long}::numeric, 10::numeric, 'granted'::text, 1200::integer)`
  const count = async () =>
    (
      await tx`
    select current_stamp_count from public.customer_memberships where id = ${membershipId}`
    )[0].current_stamp_count
  const rewards = async () =>
    (
      await tx`
    select count(*)::int as n from public.reward_events where membership_id = ${membershipId}`
    )[0].n
  return { v, customer, membershipId, ageStamps, stamp, count, rewards }
}

test(
  "a completed card opens the next cycle without waiting for redemption",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)
      // Fill cycle 1 (join gave #1) → reward unlocks and cycle 2 opens.
      await s.ageStamps()
      await s.stamp()
      await s.ageStamps()
      await s.stamp()
      assert.equal(await s.count(), 0, "fresh cycle opens at 0/3")
      assert.equal(
        await s.rewards(),
        1,
        "the full card has minted exactly one reward"
      )

      const [waitingReward] = await tx`
        select collection.state as collection_state
        from public.reward_events rewards
        cross join lateral public.get_reward_collection_state(rewards.id) collection
        where rewards.membership_id = ${s.membershipId}
          and rewards.status = 'unlocked'`
      assert.equal(
        waitingReward.collection_state,
        "waiting",
        "the open reward is still waiting while the fresh card can earn"
      )

      await s.ageStamps()
      const [nextCycleStamp] = await s.stamp()
      assert.equal(nextCycleStamp.new_stamp_count, 1)
      assert.equal(await s.count(), 1, "cycle 2 collects before redemption")

      await assert.rejects(
        () => s.stamp(),
        (error) => error?.code === "NBS01",
        "the venue-day cap still refuses a second cycle-2 stamp"
      )
    })
  }
)

test(
  "a ready open reward also permits the first stamp on the fresh cycle",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)
      await s.ageStamps()
      await s.stamp()
      await s.ageStamps()
      await s.stamp()
      assert.equal(await s.count(), 0, "reward issuance opens cycle 2 empty")

      await ensureVerifiedCustomerPhone(tx, s.customer.id)

      await tx`
        update public.reward_events
        set redeemable_from = public.venue_trading_date(${s.v.merchant_id}::uuid, now()),
            available_from = now() - interval '1 minute'
        where membership_id = ${s.membershipId} and status = 'unlocked'`
      const [readyReward] = await tx`
        select collection.state as collection_state
        from public.reward_events rewards
        cross join lateral public.get_reward_collection_state(rewards.id) collection
        where rewards.membership_id = ${s.membershipId}
          and rewards.status = 'unlocked'`
      assert.equal(readyReward.collection_state, "ready")

      await s.ageStamps()
      const [nextCycleStamp] = await s.stamp()
      assert.equal(nextCycleStamp.new_stamp_count, 1)
      assert.equal(await s.count(), 1, "cycle 2 earns while reward is ready")
    })
  }
)

test(
  "mid-cycle threshold reduction reconciles the completed cycle",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx) // join → 1 stamp in cycle 1
      assert.equal(await s.count(), 1, "one stamp in flight")
      assert.equal(await s.rewards(), 0, "no reward yet")

      // Lower the card threshold UNDER the in-flight cycle count.
      await tx`update public.loyalty_cards set stamps_required = 1 where id = ${s.v.loyalty_card_id}`
      const [{ eligible }] = await tx`
        select count(*)::integer as eligible
        from public.customer_memberships memberships
        where memberships.merchant_id = ${s.v.merchant_id}::uuid
          and (
            select count(*)
            from public.stamp_events stamps
            where stamps.membership_id = memberships.id
              and stamps.event_type = 'earned'
              and stamps.cycle_number = memberships.active_cycle_number
          ) >= 1
          and not exists (
            select 1
            from public.reward_events rewards
            where rewards.membership_id = memberships.id
              and rewards.source = 'stamp_cycle'
              and rewards.cycle_number = memberships.active_cycle_number
          )`

      const [{ minted }] = await tx`
        select public.reconcile_loyalty_card_threshold_rewards(
          ${s.v.merchant_id}::uuid, ${s.v.loyalty_card_id}::uuid, 3, 1
        ) as minted`
      assert.equal(
        minted,
        eligible,
        "every eligible in-flight cycle is reconciled exactly once"
      )
      assert.equal(await s.rewards(), 1, "one reward is minted")
      assert.equal(await s.count(), 0, "the next cycle opens empty")
    })
  }
)

test(
  "geofence refuses an out-of-range stamp from the third visit (20260805100100)",
  { skip },
  async () => {
    // Was: "geofence is soft — an out-of-range trigger stamp still lands and
    // flags". It no longer lands. A position supplied by the device that is not
    // the venue is the one case we hold positive evidence of absence, so it is
    // the one case that refuses; everything else still collects.
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)
      await s.ageStamps()
      await s.stamp() // #2, in range
      await s.ageStamps()

      // #3 is the first verified visit; push ~111km away (1 degree of latitude).
      let code = null
      try {
        await tx.savepoint(async () => {
          await s.stamp(Number(s.v.latitude) + 1.0, s.v.longitude)
        })
      } catch (error) {
        code = error.code ?? null
      }

      assert.equal(code, "NBS10", "the out-of-range stamp is refused")
      assert.equal(
        await s.count(),
        2,
        "the card did NOT advance from out of range"
      )
      assert.equal(await s.rewards(), 0, "and no reward was unlocked")

      // The flag cannot be written inside the refusing transaction — it would be
      // rolled back with it — so the caller records it afterwards through
      // record_stamp_location_refusal (20260805100600).
      const [{ n }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${s.membershipId} and signal = 'self_service_geofence_out_of_range'`
      assert.equal(n, 0, "nothing survives the aborted transaction, by design")

      await tx`select public.record_stamp_location_refusal(
      ${s.membershipId}::uuid, ${s.customer.id}::uuid, 'location_out_of_range')`
      const [{ n: recorded }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${s.membershipId} and signal = 'self_service_geofence_out_of_range'`
      assert.equal(recorded, 1, "the caller's record commits the signal")
    })
  }
)

test(
  "the unlocking stamp is refused when the reward pool has < 3 active items",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)
      await s.ageStamps()
      await s.stamp() // #2 → card at 2/3
      // Drop the pool below the minimum before the unlocking stamp.
      await tx`
      update public.reward_pool_items set is_active = false
      where id = (select id from public.reward_pool_items
                  where merchant_id = ${s.v.merchant_id} and loyalty_card_id = ${s.v.loyalty_card_id}
                    and is_active order by display_order limit 1)`
      await s.ageStamps()
      let refused = false
      try {
        await tx.savepoint(async () => {
          await s.stamp()
        })
      } catch (error) {
        refused = /3 active reward pool items/i.test(String(error.message))
      }
      assert.ok(
        refused,
        "the unlocking stamp is blocked when the pool is too small"
      )
      assert.equal(
        await s.count(),
        2,
        "the card did not complete into an unready pool"
      )
      assert.equal(await s.rewards(), 0, "no reward was minted")
    })
  }
)

test(
  "failed self-stamps durably consume allowance and aggregate refusal telemetry",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await tx`select public.consume_self_service_stamp_attempt(
          ${s.membershipId}::uuid, ${s.customer.id}::uuid)`
        await tx`select public.record_stamp_location_refusal(
          ${s.membershipId}::uuid, ${s.customer.id}::uuid,
          'location_out_of_range')`
      }

      let limited = false
      try {
        await tx.savepoint(async () => {
          await tx`select public.consume_self_service_stamp_attempt(
            ${s.membershipId}::uuid, ${s.customer.id}::uuid)`
        })
      } catch (error) {
        limited = /rate limit exceeded/i.test(String(error.message))
      }
      assert.ok(limited, "the eleventh failed attempt is refused")

      const [bucket] = await tx`
        select count
        from public.rate_limit_buckets
        where bucket_key = ${`selfstamp-attempt:${s.membershipId}`}`
      assert.equal(bucket.count, 10, "all ten failed attempts remain charged")

      const [flags] = await tx`
        select count(*)::int as rows,
               max((metadata->>'attempt_count')::int)::int as attempts
        from public.fraud_flags
        where membership_id = ${s.membershipId}
          and signal = 'self_service_geofence_out_of_range'`
      assert.deepEqual(
        flags,
        { rows: 1, attempts: 10 },
        "one bounded signal retains the refusal count"
      )

      const [events] = await tx`
        select count(*)::int as rows
        from public.product_events
        where membership_id = ${s.membershipId}
          and event_name = 'stamp_refused_location'`
      assert.equal(events.rows, 1, "analytics receives one bounded event")
    })
  }
)

test(
  "self-stamp precharge preserves ownership and legitimate stamping",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx)

      let rejected = false
      try {
        await tx.savepoint(async () => {
          await tx`select public.consume_self_service_stamp_attempt(
            ${s.membershipId}::uuid, ${randomUUID()}::uuid)`
        })
      } catch (error) {
        rejected = /ownership required/i.test(String(error.message))
      }
      assert.ok(rejected, "another customer cannot charge an owned membership")

      await tx`select public.consume_self_service_stamp_attempt(
        ${s.membershipId}::uuid, ${s.customer.id}::uuid)`
      await s.ageStamps()
      await s.stamp()
      assert.equal(await s.count(), 2, "an allowed in-range stamp still lands")
    })
  }
)
