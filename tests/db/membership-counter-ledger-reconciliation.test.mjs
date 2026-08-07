import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { ensureVerifiedCustomerEmail } from "./helpers/verified-customer-email.mjs"

/**
 * STAMP-08 — membership counters must reconcile with the event ledger.
 *
 * customer_memberships stores denormalised counters (current_stamp_count,
 * total_stamps_earned, total_rewards_redeemed, active_cycle_number) that the
 * stamp/redeem RPCs maintain procedurally — NOT by trigger or generated column.
 * That is a known desync class: repair migrations 20260630127000
 * (reconcile_loyalty_threshold_lowering) and 20260713100000
 * (customer_join_ledger_recovery) exist precisely because these drifted from the
 * ledger before. This test locks the invariant so a future RPC edit that
 * updates a counter without a matching ledger row (or vice versa) fails.
 *
 * Redeem resets current_stamp_count directly (no compensating ledger delta), so
 * the current count reconciles against the EARNED rows of the active cycle, not
 * the delta sum. Four invariants hold along an organic lifecycle (seed rows may
 * manufacture states that violate the earned/cycle ones, so those are asserted
 * only on the organic drive):
 *   1. current_stamp_count    == count(earned events where cycle = active cycle)
 *   2. total_stamps_earned    == count(stamp_events event_type='earned')
 *   3. total_rewards_redeemed == count(reward_events status='redeemed')
 *   4. active_cycle_number    == total_rewards_redeemed + total_rewards_expired + 1
 *      (20260805100200 made an expired stamp-cycle reward release the card, so an
 *      expiry advances the cycle exactly as a redemption does; total_rewards_expired
 *      is what keeps the identity true instead of quietly breaking it.)
 * Only #3 is asserted across all seeded memberships: a redeemed-reward tally that
 * disagrees with the reward rows is always a bug, regardless of how a row was
 * produced.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug,
         lc.stamps_required, ml.latitude, ml.longitude, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations ml on ml.id = lc.location_id
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  order by q.created_at limit 1`

async function reconcile(tx, membershipId) {
  const [row] = await tx`
    select cm.current_stamp_count, cm.total_stamps_earned,
           cm.total_rewards_redeemed, cm.total_rewards_expired, cm.active_cycle_number,
           (select count(*) from public.stamp_events se
             where se.membership_id = cm.id and se.event_type = 'earned'
               and se.cycle_number = cm.active_cycle_number)::int as earned_active_cycle,
           (select count(*) from public.stamp_events se
             where se.membership_id = cm.id and se.event_type = 'earned')::int as earned_rows,
           (select count(*) from public.reward_events re
             where re.membership_id = cm.id and re.status = 'redeemed')::int as redeemed_rows
    from public.customer_memberships cm where cm.id = ${membershipId}`
  return row
}

function assertReconciled(m, label) {
  assert.equal(
    m.current_stamp_count,
    m.earned_active_cycle,
    `${label}: current_stamp_count == count(earned events in active cycle)`
  )
  assert.equal(
    m.total_stamps_earned,
    m.earned_rows,
    `${label}: total_stamps_earned == count(earned stamp_events)`
  )
  assert.equal(
    m.total_rewards_redeemed,
    m.redeemed_rows,
    `${label}: total_rewards_redeemed == count(redeemed reward_events)`
  )
  assert.equal(
    m.active_cycle_number,
    m.total_rewards_redeemed + m.total_rewards_expired + 1,
    `${label}: active_cycle_number == total_rewards_redeemed + total_rewards_expired + 1`
  )
}

test(
  "counters reconcile with the ledger across an organic join → full → redeem → next-cycle arc",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "old-crown-girton journey venue is seeded")
      assert.equal(v.stamps_required, 3, "card completes in 3 stamps")

      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, date_of_birth, created_at, updated_at)
        values (${`recon-${randomUUID()}@test.local`}, now(), 'Recon Tester',
                '1990-01-01', now(), now())
        returning id`
      await ensureVerifiedCustomerEmail(tx, customer.id)

      const ageStamps = (membershipId) => tx`
        update public.stamp_events
        set earned_business_date = earned_business_date - 7
        where membership_id = ${membershipId} and event_type = 'earned'`
      const stamp = (membershipId) => tx`
        select * from public.issue_self_service_stamp(
          ${membershipId}::uuid, ${customer.id}::uuid, ${v.qr_id}::text,
          ${v.latitude}::numeric, ${v.longitude}::numeric, 10::numeric,
          'granted'::text, 1200::integer)`

      // JOIN (cycle 1, stamp #1).
      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      const membershipId = joined.membership_id
      assertReconciled(await reconcile(tx, membershipId), "after join")

      // Stamps 2 and 3 (3 completes the card and unlocks a reward).
      await ageStamps(membershipId)
      await stamp(membershipId)
      assertReconciled(await reconcile(tx, membershipId), "after stamp 2")

      await ageStamps(membershipId)
      const [s3] = await stamp(membershipId)
      assert.equal(s3.reward_unlocked, true, "stamp 3 unlocks a reward")
      const afterUnlock = await reconcile(tx, membershipId)
      assert.equal(afterUnlock.current_stamp_count, 3, "card is full at 3/3")
      assertReconciled(afterUnlock, "after unlock")

      // Redeem next business day: counters must roll over in lockstep with the
      // ledger (a -stamps_required reversal delta + a redeemed reward row).
      const [reward] = await tx`
        select id from public.reward_events where membership_id = ${membershipId}`
      const ukToday = (
        await tx`select (now() at time zone 'Europe/London')::date as d`
      )[0].d
      await tx`update public.reward_events set redeemable_from = ${ukToday}
               where id = ${reward.id}`
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${customer.id}::uuid)`
      await tx`select * from public.collect_reward_scan_token(
          ${minted.scan_token}::uuid, ${v.merchant_id}::uuid)`
      const afterRedeem = await reconcile(tx, membershipId)
      assert.equal(afterRedeem.current_stamp_count, 0, "count rolls to 0")
      assert.equal(afterRedeem.active_cycle_number, 2, "advanced to cycle 2")
      assertReconciled(afterRedeem, "after redeem")

      // First stamp of cycle 2 — clean card, counters still reconciled.
      await ageStamps(membershipId)
      await stamp(membershipId)
      assertReconciled(await reconcile(tx, membershipId), "after cycle-2 stamp")
    })
  }
)

test(
  "every seeded membership satisfies the ledger-authoritative invariants",
  { skip },
  async () => {
    // Read-only sweep (no transaction/rollback needed). Asserts only the
    // invariant that holds regardless of how a row was produced: a manufactured
    // seed row may legitimately carry a hand-set stamp count or cycle number, but
    // a redeemed-reward tally that disagrees with the actual redeemed reward rows
    // is always a bug.
    const sql = db()
    const rows = await sql`
      select cm.id, cm.total_rewards_redeemed,
        (select count(*) from public.reward_events re
          where re.membership_id = cm.id and re.status = 'redeemed')::int as redeemed_rows
      from public.customer_memberships cm`

    for (const r of rows) {
      assert.equal(
        r.total_rewards_redeemed,
        r.redeemed_rows,
        `membership ${r.id}: total_rewards_redeemed drifted from redeemed reward rows`
      )
    }
  }
)
