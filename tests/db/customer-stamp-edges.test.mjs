import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * customer card stamp (edges) — live-DB tier.
 *
 * Beyond the one-per-UK-day moat, these prove the stamp RPC's other guards that
 * were previously untested at runtime:
 *   - a FULL card refuses further stamps ("A reward is already ready to redeem"),
 *   - the mid-cycle stamps_required BRICK (lowering the threshold under an
 *     in-flight cycle wedges the card full with no reward ever minted),
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

test("a full card refuses further stamps", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const s = await seed(tx)
    // Fill to 3/3 (join gave #1) → reward unlocks but is NOT redeemed.
    await s.ageStamps()
    await s.stamp()
    await s.ageStamps()
    await s.stamp()
    assert.equal(await s.count(), 3, "card is full at 3/3")
    assert.equal(
      await s.rewards(),
      1,
      "the full card has minted exactly one reward"
    )

    await s.ageStamps()
    let refused = false
    try {
      await tx.savepoint(async () => {
        await s.stamp()
      })
    } catch (error) {
      refused = /already ready to redeem/i.test(String(error.message))
    }
    assert.ok(refused, "a full, unredeemed card cannot take another stamp")
    assert.equal(
      await s.count(),
      3,
      "the rejected stamp did not advance the card"
    )
  })
})

test(
  "mid-cycle stamps_required reduction bricks the card (no reward minted)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const s = await seed(tx) // join → 1 stamp in cycle 1
      assert.equal(await s.count(), 1, "one stamp in flight")
      assert.equal(await s.rewards(), 0, "no reward yet")

      // Lower the card threshold UNDER the in-flight cycle count.
      await tx`update public.loyalty_cards set stamps_required = 1 where id = ${s.v.loyalty_card_id}`

      await s.ageStamps()
      let bricked = false
      try {
        await tx.savepoint(async () => {
          await s.stamp()
        })
      } catch (error) {
        bricked = /already ready to redeem/i.test(String(error.message))
      }
      assert.ok(
        bricked,
        "the card is wedged: the guard fires before any unlock"
      )
      assert.equal(
        await s.rewards(),
        0,
        "BRICK: card reads full but no reward was ever minted"
      )
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
