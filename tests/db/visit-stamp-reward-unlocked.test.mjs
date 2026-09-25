import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * reward_unlocked reports a reward that exists — live-DB tier.
 *
 * 20261005100500 makes private.issue_visit_stamp derive reward_unlocked from
 * the reward id private.complete_cycle_if_full returns, not from the stamp
 * count. This suite proves, through the public stamp RPCs the app calls:
 *
 *   - a healthy completing stamp still reports true, with exactly one
 *     stamp-cycle reward behind it and the next cycle opened;
 *   - a reward pool below the unlock minimum refuses the completing stamp
 *     (NBS03) and writes nothing — no stamp, no reward, no unlock;
 *   - when the helper returns null without minting (here: the active card
 *     disappears inside the stamp transaction, forced by a rolled-back probe
 *     trigger), the stamp stands but reward_unlocked is false, no reward row
 *     exists, and the card is left full on cycle 1 for the repair path.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// old-crown-girton: stamps_required=3, >=3 active pool items, an active join QR,
// billing-active, geofenced from visit 3 (so the final stamp sends venue coords).
const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id,
         lc.id as loyalty_card_id, lc.stamps_required,
         l.id as location_id, l.latitude, l.longitude
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations l on l.id = lc.location_id
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  order by q.created_at
  limit 1`

async function sqlstateOf(tx, fn) {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp)
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

/** Join (stamp 1) and add stamp 2, each on an aged business day, so the next stamp completes the card. */
async function memberOneStampFromFull(tx, venue) {
  assert.equal(venue.stamps_required, 3, "the seeded card completes in 3")
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, created_at, updated_at)
    values (${`unlock-${randomUUID()}@test.local`}, now(), 'Unlock Proof', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, '2026-06-06',
      ${venue.latitude}, ${venue.longitude})`
  assert.equal(joined.first_stamp_issued, true, "join issued stamp 1")

  const membershipId = joined.membership_id
  const age = () => tx`
    update public.stamp_events
    set earned_business_date = earned_business_date - 7
    where membership_id = ${membershipId}::uuid and event_type = 'earned'`

  await age()
  const [second] = await finalStamp(tx, venue, membershipId, customer.id)
  assert.equal(second.new_stamp_count, 2)
  assert.equal(second.reward_unlocked, false, "2 of 3 unlocks nothing")
  await age()

  return { customerId: customer.id, membershipId }
}

/** The app's QR stamp path: the 9-arg public wrapper with venue coordinates. */
function finalStamp(tx, venue, membershipId, customerId) {
  return tx`
    select * from public.issue_self_service_stamp(
      ${membershipId}::uuid, ${customerId}::uuid, ${venue.qr_id}::text,
      ${venue.latitude}::numeric, ${venue.longitude}::numeric, 10::numeric,
      'granted'::text, 900::integer, 0::integer)`
}

async function cycleState(tx, membershipId) {
  const [membership] = await tx`
    select current_stamp_count, active_cycle_number
    from public.customer_memberships where id = ${membershipId}::uuid`
  const rewards = await tx`
    select id, cycle_number, status from public.reward_events
    where membership_id = ${membershipId}::uuid and source = 'stamp_cycle'`
  const [{ n: earned }] = await tx`
    select count(*)::int as n from public.stamp_events
    where membership_id = ${membershipId}::uuid and event_type = 'earned'`
  return { membership, rewards, earned }
}

test(
  "a completing stamp with a minted reward still reports reward_unlocked = true",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      assert.ok(venue, "the seeded journey venue exists")
      const member = await memberOneStampFromFull(tx, venue)

      const [result] = await finalStamp(
        tx,
        venue,
        member.membershipId,
        member.customerId
      )
      assert.equal(result.new_stamp_count, 3)
      assert.equal(result.reward_unlocked, true)

      const state = await cycleState(tx, member.membershipId)
      assert.equal(state.rewards.length, 1, "exactly one reward is behind it")
      assert.equal(state.rewards[0].cycle_number, 1)
      assert.equal(state.rewards[0].status, "unlocked")
      assert.deepEqual(
        state.membership,
        { current_stamp_count: 0, active_cycle_number: 2 },
        "the next cycle opened"
      )
    })
  }
)

test(
  "a reward pool below the unlock minimum refuses the completing stamp with NBS03 and writes nothing",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const member = await memberOneStampFromFull(tx, venue)

      await tx`
        update public.reward_pool_items set is_active = false
        where loyalty_card_id = ${venue.loyalty_card_id}::uuid`

      const code = await sqlstateOf(tx, (sp) =>
        finalStamp(sp, venue, member.membershipId, member.customerId)
      )
      assert.equal(code, "NBS03", "pool-short final stamp is refused")

      const state = await cycleState(tx, member.membershipId)
      assert.equal(state.earned, 2, "no third stamp landed")
      assert.equal(state.rewards.length, 0, "no reward was minted")
      assert.deepEqual(state.membership, {
        current_stamp_count: 2,
        active_cycle_number: 1,
      })
    })
  }
)

test(
  "a completing stamp whose reward is not minted reports reward_unlocked = false and leaves the card full",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const member = await memberOneStampFromFull(tx, venue)

      // Probe: once the completing stamp row is written, the venue's card goes
      // inactive inside the same transaction, so complete_cycle_if_full finds
      // no active card and returns null without minting. Rolled back with the
      // test transaction.
      await tx.unsafe(`
        create function pg_temp.deactivate_card_after_stamp() returns trigger
        language plpgsql as $probe$
        begin
          update public.loyalty_cards set is_active = false
          where id = new.loyalty_card_id;
          return null;
        end;
        $probe$`)
      await tx.unsafe(`
        create trigger reward_unlocked_probe_deactivate_card
        after insert on public.stamp_events
        for each row
        when (new.metadata->>'cycle_stamp_number' = '3')
        execute function pg_temp.deactivate_card_after_stamp()`)

      const [result] = await finalStamp(
        tx,
        venue,
        member.membershipId,
        member.customerId
      )
      assert.ok(result.stamp_event_id, "the visit stamp still stands")
      assert.equal(result.new_stamp_count, 3, "the card reads full")
      assert.equal(
        result.reward_unlocked,
        false,
        "no reward was minted, so none is reported"
      )

      const state = await cycleState(tx, member.membershipId)
      assert.equal(state.earned, 3)
      assert.equal(state.rewards.length, 0, "no reward row exists")
      assert.deepEqual(
        state.membership,
        { current_stamp_count: 3, active_cycle_number: 1 },
        "the full card is left for the repair path, not advanced"
      )

      const [unlockEvent] = await tx`
        select count(*)::int as n from public.product_events
        where membership_id = ${member.membershipId}::uuid
          and event_name = 'reward_unlocked'`
      assert.equal(unlockEvent.n, 0, "no reward_unlocked event was recorded")
    })
  }
)
