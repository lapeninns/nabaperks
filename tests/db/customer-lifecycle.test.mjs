import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-customer-* — live-DB customer lifecycle JOURNEY tier.
 *
 * Where the other live-DB tests prove one invariant each by manufacturing the
 * precondition (force-setting current_stamp_count, hand-inserting an unlocked
 * reward), this walks the WHOLE arc organically through the real RPCs:
 *
 *   join (stamp 1) → stamp 2 → stamp 3 (card full, reward UNLOCKED by stamping)
 *     → next-business-day gate → redeem (token consumed) → cycle resets,
 *     active_cycle_number increments → first stamp of cycle 2 starts clean.
 *
 * Nothing is manufactured except the passage of time: the one-stamp-per-UK-day
 * guard is satisfied by ageing each prior earned row's `earned_business_date`
 * (the guard is date-keyed, see 20260606190000_mystery_visit_rewards.sql:96),
 * and the next-business-day redemption gate by ageing `redeemable_from`. All
 * inside a rolled-back transaction so the seed is never mutated.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// old-crown-girton: stamps_required=3, >=3 active pool items (unlock minimum),
// an active destination_type='join' QR, billing-active, geofenced (trigger #3).
const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug,
         lc.id as loyalty_card_id, lc.stamps_required, lc.location_id,
         ml.latitude, ml.longitude, ml.require_geofence,
         q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations ml on ml.id = lc.location_id
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton'
    and m.status in ('trial', 'active')
  order by q.created_at
  limit 1`

test(
  "customer lifecycle: join → stamp to full → unlock by stamping → redeem → cycle 2 starts clean",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "the old-crown-girton journey venue is seeded and billing-active")
      assert.equal(v.stamps_required, 3, "card completes in 3 stamps")
      assert.ok(v.latitude != null && v.longitude != null, "geofenced venue has coordinates")

      // A brand-new verified customer with a complete profile (so the reward is
      // redeemable later — full_name + date_of_birth + verified-if-present email).
      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, date_of_birth, created_at, updated_at)
        values (${`e2e-${randomUUID()}@test.local`}, now(), 'Journey Tester',
                '1990-01-01', now(), now())
        returning id`
      assert.ok(customer?.id, "created a fresh verified customer")

      // Age every prior earned stamp for this membership a week back so "today"
      // is always free of the one-per-UK-business-day guard.
      const ageStamps = (membershipId) => tx`
        update public.stamp_events
        set earned_business_date = earned_business_date - 7
        where membership_id = ${membershipId} and event_type = 'earned'`

      // Issue a self-service stamp through the real 8-arg QR shim (the live
      // customer path: validates the venue QR proof, then stamps). Venue coords
      // on the trigger stamp keep the soft geofence in-range (no flag).
      const stamp = (membershipId) => tx`
        select * from public.issue_self_service_stamp(
          ${membershipId}::uuid, ${customer.id}::uuid, ${v.qr_id}::text,
          ${v.latitude}::numeric, ${v.longitude}::numeric, 10::numeric,
          'granted'::text, 1200::integer)`

      const countEarned = async (membershipId, cycle) => {
        const [{ n }] = await tx`
          select count(*)::int as n from public.stamp_events
          where membership_id = ${membershipId} and event_type = 'earned'
            and cycle_number = ${cycle}`
        return n
      }
      const member = async (membershipId) => {
        const [row] = await tx`
          select current_stamp_count, active_cycle_number,
                 total_stamps_earned, total_rewards_redeemed
          from public.customer_memberships where id = ${membershipId}`
        return row
      }

      // ---- STEP 1: JOIN — enrol + first stamp atomically (cycle 1, stamp #1).
      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      assert.equal(joined.created_membership, true, "STEP 1: membership created")
      assert.equal(joined.first_stamp_issued, true, "STEP 1: first stamp issued on join")
      const membershipId = joined.membership_id

      let m = await member(membershipId)
      assert.equal(m.current_stamp_count, 1, "STEP 1: card shows 1 stamp")
      assert.equal(m.active_cycle_number, 1, "STEP 1: on cycle 1")
      assert.equal(await countEarned(membershipId, 1), 1, "STEP 1: one earned row in cycle 1")

      // ---- STEP 2: SECOND stamp the next business day (card 1 → 2).
      await ageStamps(membershipId)
      const [s2] = await stamp(membershipId)
      assert.equal(s2.reward_unlocked, false, "STEP 2: no reward yet at 2/3")
      m = await member(membershipId)
      assert.equal(m.current_stamp_count, 2, "STEP 2: card shows 2 stamps")
      assert.equal(m.total_stamps_earned, 2, "STEP 2: lifetime stamps = 2")
      assert.equal(m.active_cycle_number, 1, "STEP 2: still cycle 1")

      // ---- STEP 3: THIRD stamp completes the card → reward UNLOCKED by stamping.
      await ageStamps(membershipId)
      const [s3] = await stamp(membershipId)
      assert.equal(s3.reward_unlocked, true, "STEP 3: the third stamp unlocks a reward")
      m = await member(membershipId)
      assert.equal(m.current_stamp_count, 3, "STEP 3: card is full at 3/3")
      assert.equal(m.active_cycle_number, 1, "STEP 3: unlock does not advance the cycle")

      // Exactly one reward, earned (not hand-inserted), scoped to cycle 1, and
      // NOT same-day redeemable (redeemable_from = next UK business day).
      const rewards = await tx`
        select id, status, cycle_number, redeemable_from, reward_name
        from public.reward_events where membership_id = ${membershipId}`
      assert.equal(rewards.length, 1, "STEP 3: exactly one reward event exists")
      const reward = rewards[0]
      assert.equal(reward.status, "unlocked", "STEP 3: reward is unlocked")
      assert.equal(reward.cycle_number, 1, "STEP 3: reward belongs to cycle 1")
      const ukToday = (
        await tx`select (now() at time zone 'Europe/London')::date as d`
      )[0].d
      assert.ok(
        reward.redeemable_from > ukToday,
        "STEP 3: reward opens on a later UK business day, not same-day"
      )

      // A same-day redemption attempt must be refused by the next-day gate.
      let sameDayRefused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`select * from public.create_reward_scan_token(
            ${reward.id}::uuid, ${customer.id}::uuid)`
        })
      } catch (error) {
        sameDayRefused = /next UK business day/i.test(String(error.message))
      }
      assert.ok(sameDayRefused, "STEP 3: same-day redemption blocked until next business day")

      // ---- STEP 4: the next business day arrives → REDEEM via scan token.
      await tx`
        update public.reward_events set redeemable_from = ${ukToday}
        where id = ${reward.id}`
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${customer.id}::uuid)`
      assert.ok(minted?.scan_token, "STEP 4: a scan token is minted once redeemable")

      await tx`
        select * from public.collect_reward_scan_token(
          ${minted.scan_token}::uuid, ${v.merchant_id}::uuid)`
      const [tok] = await tx`
        select consumed_at from public.reward_scan_tokens where id = ${minted.scan_token}`
      assert.notEqual(tok.consumed_at, null, "STEP 4: token consumed on collect")
      const [{ status: rewardStatus }] = await tx`
        select status from public.reward_events where id = ${reward.id}`
      assert.equal(rewardStatus, "redeemed", "STEP 4: reward is redeemed")

      // ---- STEP 5: CYCLE RESETS. The real invariant is not "== 0" but the
      // rollover: greatest(count - required, 0) and cycle == redeemed + 1.
      m = await member(membershipId)
      assert.equal(m.current_stamp_count, 0, "STEP 5: stamp count rolls over to 0")
      assert.equal(m.active_cycle_number, 2, "STEP 5: advanced to cycle 2")
      assert.equal(m.total_rewards_redeemed, 1, "STEP 5: one reward redeemed")
      assert.equal(
        m.active_cycle_number,
        m.total_rewards_redeemed + 1,
        "STEP 5: cycle invariant active_cycle_number == total_rewards_redeemed + 1"
      )

      // ---- STEP 6: the FIRST stamp of cycle 2 starts a clean card, not 4/3.
      await ageStamps(membershipId)
      const [s4] = await stamp(membershipId)
      assert.equal(s4.reward_unlocked, false, "STEP 6: cycle 2 stamp #1 does not unlock")
      m = await member(membershipId)
      assert.equal(m.current_stamp_count, 1, "STEP 6: cycle 2 starts at 1 stamp")
      assert.equal(m.active_cycle_number, 2, "STEP 6: still cycle 2")
      assert.equal(m.total_stamps_earned, 4, "STEP 6: lifetime stamps = 4 across both cycles")
      assert.equal(await countEarned(membershipId, 2), 1, "STEP 6: one earned row in cycle 2")
      assert.equal(await countEarned(membershipId, 1), 3, "STEP 6: cycle 1 history is preserved")
    })
  }
)
