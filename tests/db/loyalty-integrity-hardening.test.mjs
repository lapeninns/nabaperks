import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { ensureVerifiedCustomerEmail } from "./helpers/verified-customer-email.mjs"
import {
  createRewardPoolFixture,
  upsertRewardPoolItem,
} from "./helpers/reward-pool-fixture.mjs"

/**
 * Loyalty integrity hardening — live proof for 20260805100000..20260805100500.
 *
 * The contract tier already pins the SQL text. What it cannot do is run it, and
 * every change in this set is behavioural: an index that must reject a second
 * active card, a refusal that must carry a SQLSTATE, an expiry that must release
 * a cycle, a heal that must mint. Those only mean something against Postgres.
 *
 * Every test runs inside a rolled-back transaction, so the seed is untouched.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug,
         lc.id as loyalty_card_id, lc.location_id, lc.stamps_required,
         ml.latitude, ml.longitude, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations ml on ml.id = lc.location_id
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  order by q.created_at limit 1`

async function newCustomer(tx, label) {
  const [customer] = await tx`
    insert into public.customers
      (email, email_verified_at, full_name, date_of_birth, created_at, updated_at)
    values (${`${label}-${randomUUID()}@test.local`}, now(), 'Integrity Tester',
            '1990-01-01', now(), now())
    returning id`
  await ensureVerifiedCustomerEmail(tx, customer.id)
  return customer.id
}

/** Push every earned row back a week so the one-per-UK-day rule stays clear. */
const ageStamps = (tx, membershipId) => tx`
  update public.stamp_events
  set earned_business_date = earned_business_date - 7
  where membership_id = ${membershipId} and event_type = 'earned'`

/**
 * Run `work` and return the SQLSTATE it raises, or null when it succeeds.
 *
 * The savepoint is load-bearing, not decoration. An error inside a postgres.js
 * `begin` block aborts the whole transaction, so merely catching the rejection
 * leaves the connection poisoned and every later assertion fails with 25P02 —
 * or, worse, resurfaces the expected error and disguises a passing test as a
 * failing one. Rolling back to a savepoint keeps the surrounding fixture alive
 * so a test can assert on what happened AFTER a refusal.
 */
async function sqlstateOf(tx, work) {
  try {
    await tx.savepoint(async (sp) => {
      await work(sp)
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

// ---------------------------------------------------------------------------
// 20260805100000 — one active loyalty card per merchant
// ---------------------------------------------------------------------------

test(
  "a second active card for one merchant is rejected by the database",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "journey venue is seeded")

      const code = await sqlstateOf(
        tx,
        (sp) => sp`
      insert into public.loyalty_cards
        (merchant_id, location_id, card_name, stamps_required,
         reward_name, reward_terms, is_active)
      values (${v.merchant_id}, ${v.location_id}, 'Second active card', 5,
              'Surprise reward', 'Terms for the duplicate card', true)`
      )

      // 23505 unique_violation — the invariant the four card lookups assume.
      assert.equal(code, "23505", "a second active card must be impossible")
    })
  }
)

test("an inactive second card is still allowed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [v] = await tx.unsafe(PICK)
    const [row] = await tx`
      insert into public.loyalty_cards
        (merchant_id, location_id, card_name, stamps_required,
         reward_name, reward_terms, is_active)
      values (${v.merchant_id}, ${v.location_id}, 'Retired card', 5,
              'Surprise reward', 'Terms for the retired card', false)
      returning id`
    assert.ok(row.id, "the index is partial: only active cards are constrained")
  })
})

// ---------------------------------------------------------------------------
// 20260805100100 — graduated location verification
// ---------------------------------------------------------------------------

/** Join, then lengthen the card so completion never collides with geofence tests. */
async function joinWithLongCard(tx, v, customerId) {
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
  await tx`
    update public.loyalty_cards set stamps_required = 20
    where id = ${v.loyalty_card_id}`
  await tx`
    update public.merchant_locations set require_geofence = true
    where id = ${v.location_id}`
  return joined.membership_id
}

const stampAt = (tx, v, membershipId, customerId, opts = {}) => tx`
  select * from public.issue_self_service_stamp(
    ${membershipId}::uuid, ${customerId}::uuid, ${v.qr_id}::text,
    ${opts.latitude ?? null}::numeric, ${opts.longitude ?? null}::numeric,
    ${opts.accuracy ?? null}::numeric, ${opts.status ?? null}::text, null::integer)`

test(
  "the first two visits are exempt from location verification",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-exempt")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      // Visit 1 was the join, with no location at all, and it succeeded.
      await ageStamps(tx, membershipId)

      // Visit 2: still exempt, location explicitly denied.
      const [second] = await stampAt(tx, v, membershipId, customerId, {
        status: "denied",
      })
      assert.equal(
        second.new_stamp_count,
        2,
        "visit 2 collects without location"
      )

      const [row] = await tx`
      select metadata->>'geo_verification' as verification
      from public.stamp_events
      where id = ${second.stamp_event_id}`
      assert.equal(
        row.verification,
        "exempt",
        "visits 1-2 are recorded as exempt"
      )
    })
  }
)

test(
  "from visit three a position outside the venue is refused with NBS10",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-out")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      await ageStamps(tx, membershipId)
      await stampAt(tx, v, membershipId, customerId, { status: "denied" })
      await ageStamps(tx, membershipId)

      // Visit 3, a good fix roughly 111km north of the venue.
      const code = await sqlstateOf(tx, (sp) =>
        stampAt(sp, v, membershipId, customerId, {
          latitude: Number(v.latitude) + 1,
          longitude: Number(v.longitude),
          accuracy: 10,
          status: "granted",
        })
      )
      assert.equal(
        code,
        "NBS10",
        "positive evidence of absence refuses the stamp"
      )

      const [row] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${membershipId} and event_type = 'earned'`
      assert.equal(row.n, 2, "no stamp row is written when the refusal fires")
    })
  }
)

test(
  "from visit three a good fix at the venue still collects",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-in")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      await ageStamps(tx, membershipId)
      await stampAt(tx, v, membershipId, customerId, { status: "denied" })
      await ageStamps(tx, membershipId)

      const [third] = await stampAt(tx, v, membershipId, customerId, {
        latitude: v.latitude,
        longitude: v.longitude,
        accuracy: 10,
        status: "granted",
      })
      assert.equal(third.new_stamp_count, 3)
      assert.equal(third.geo_flagged, false)

      const [row] = await tx`
      select metadata->>'geo_verification' as verification
      from public.stamp_events where id = ${third.stamp_event_id}`
      assert.equal(row.verification, "verified")
    })
  }
)

test(
  "a denied location spends grace, then refuses with NBS11 rather than losing the customer",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-grace")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      const [{ limit }] = await tx`
      select public.geofence_unverified_grace_limit() as limit`

      // Visits 3.. are unverified. Each is allowed while grace remains — the
      // customer is in the venue with location off, which is not a fraud signal.
      let collected = 1
      await ageStamps(tx, membershipId)
      await stampAt(tx, v, membershipId, customerId, { status: "denied" })
      collected = 2

      for (let i = 0; i < limit; i += 1) {
        await ageStamps(tx, membershipId)
        const [row] = await stampAt(tx, v, membershipId, customerId, {
          status: "denied",
        })
        collected += 1
        assert.equal(
          row.new_stamp_count,
          collected,
          `grace visit ${i + 1} collects`
        )
        assert.equal(row.geo_flagged, true, "an unverified visit is flagged")
      }

      // Grace spent: now it refuses, and the message names the fix.
      await ageStamps(tx, membershipId)
      const code = await sqlstateOf(tx, (sp) =>
        stampAt(sp, v, membershipId, customerId, { status: "denied" })
      )
      assert.equal(
        code,
        "NBS11",
        "location becomes mandatory once grace is spent"
      )
    })
  }
)

test(
  "a poor-accuracy fix is unverified, not treated as absence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-poor")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      await ageStamps(tx, membershipId)
      await stampAt(tx, v, membershipId, customerId, { status: "denied" })
      await ageStamps(tx, membershipId)

      // Far away, but the fix is too imprecise to convict anyone.
      const [third] = await stampAt(tx, v, membershipId, customerId, {
        latitude: Number(v.latitude) + 1,
        longitude: Number(v.longitude),
        accuracy: 5000,
        status: "granted",
      })

      assert.equal(third.new_stamp_count, 3, "an imprecise fix must not refuse")
      const [row] = await tx`
      select metadata->>'geo_verification' as verification,
             metadata->>'location_status' as status
      from public.stamp_events where id = ${third.stamp_event_id}`
      assert.equal(row.verification, "unverified")
      assert.equal(row.status, "poor_accuracy")
    })
  }
)

test(
  "promotional grants neither exempt a visit nor spend the grace budget",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "geo-promo")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      // A promotional grant, shaped exactly as claim_offer_campaign writes one.
      await tx`
      insert into public.stamp_events
        (merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
         event_type, stamps_delta, earned_business_date, cycle_number, metadata)
      values (${v.merchant_id}, ${customerId}, ${membershipId},
              ${v.loyalty_card_id}, ${v.location_id}, 'earned', 1, null, 1,
              jsonb_build_object('source', 'offer_campaign'))`

      await ageStamps(tx, membershipId)
      const [second] = await stampAt(tx, v, membershipId, customerId, {
        status: "denied",
      })

      // Visit number counts self-service scans only, so this is still visit 2 and
      // still exempt despite three earned rows existing.
      const [row] = await tx`
      select metadata->>'geo_verification' as verification,
             (metadata->>'visit_number')::int as visit_number
      from public.stamp_events where id = ${second.stamp_event_id}`
      assert.equal(row.visit_number, 2, "an offer grant is not a visit")
      assert.equal(row.verification, "exempt")
    })
  }
)

// ---------------------------------------------------------------------------
// 20260805100100 — velocity signal, reward-pool race
// ---------------------------------------------------------------------------

test(
  "the velocity flag is raised against the membership, not the venue",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "velocity")
      const membershipId = await joinWithLongCard(tx, v, customerId)

      for (let i = 0; i < 3; i += 1) {
        await ageStamps(tx, membershipId)
        await stampAt(tx, v, membershipId, customerId, { status: "denied" })
      }

      const [flag] = await tx`
      select signal, membership_id, metadata->>'scope' as scope
      from public.fraud_flags
      where membership_id = ${membershipId} and signal = 'high_stamp_velocity'`

      assert.ok(
        flag,
        "three stamps in fifteen minutes on one card is worth a look"
      )
      assert.equal(flag.scope, "membership")
    })
  }
)

test("promotional grants do not trigger visit velocity", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [v] = await tx.unsafe(PICK)
    const customerId = await newCustomer(tx, "velocity-promo")
    const membershipId = await joinWithLongCard(tx, v, customerId)

    await tx`
      insert into public.stamp_events
        (merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
         event_type, stamps_delta, earned_business_date, cycle_number, metadata)
      select ${v.merchant_id}, ${customerId}, ${membershipId},
             ${v.loyalty_card_id}, ${v.location_id}, 'earned', 1, null, 1,
             jsonb_build_object('source', 'offer_campaign')
      from generate_series(1, 2)`

    await ageStamps(tx, membershipId)
    await stampAt(tx, v, membershipId, customerId, { status: "denied" })

    const [before] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${membershipId}
        and signal = 'high_stamp_velocity'`
    assert.equal(before.n, 0, "two grants plus two visits are not velocity")

    await ageStamps(tx, membershipId)
    await stampAt(tx, v, membershipId, customerId, { status: "denied" })

    const [after] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${membershipId}
        and signal = 'high_stamp_velocity'`
    assert.equal(after.n, 1, "the third real visit raises the signal")
  })
})

// ---------------------------------------------------------------------------
// 20260805100200 — expiry releases the cycle
// ---------------------------------------------------------------------------

async function driveToFullCard(tx, v, customerId) {
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
  const membershipId = joined.membership_id

  for (let i = 1; i < v.stamps_required; i += 1) {
    await ageStamps(tx, membershipId)
    await stampAt(tx, v, membershipId, customerId, {
      latitude: v.latitude,
      longitude: v.longitude,
      accuracy: 10,
      status: "granted",
    })
  }
  return membershipId
}

test(
  "an unredeemed reward expires and hands the card back",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "expiry")
      const membershipId = await driveToFullCard(tx, v, customerId)

      const [before] = await tx`
      select current_stamp_count, active_cycle_number, total_rewards_expired
      from public.customer_memberships where id = ${membershipId}`
      assert.equal(
        before.current_stamp_count,
        v.stamps_required,
        "card is full"
      )
      assert.equal(before.active_cycle_number, 1)

      // A full card refuses new stamps until something clears it.
      await ageStamps(tx, membershipId)
      assert.equal(
        await sqlstateOf(tx, (sp) =>
          stampAt(sp, v, membershipId, customerId, { status: "denied" })
        ),
        "NBS02",
        "a full card is parked"
      )

      // Age the reward past its window and run the sweep.
      await tx`
      update public.reward_events
      set expires_at = now() - interval '1 day'
      where membership_id = ${membershipId} and status = 'unlocked'`
      await tx`select public.expire_due_reward_events(now())`

      const [after_] = await tx`
      select current_stamp_count, active_cycle_number, total_rewards_expired,
             total_rewards_redeemed
      from public.customer_memberships where id = ${membershipId}`

      assert.equal(
        after_.active_cycle_number,
        2,
        "the cycle advanced on expiry"
      )
      assert.equal(after_.total_rewards_expired, 1)
      assert.equal(
        after_.current_stamp_count,
        0,
        "the card was handed back empty"
      )
      assert.equal(
        after_.active_cycle_number,
        after_.total_rewards_redeemed + after_.total_rewards_expired + 1,
        "the counter identity still holds after an expiry"
      )

      // And the customer can collect again — the point of the whole change.
      await ageStamps(tx, membershipId)
      const [resumed] = await stampAt(tx, v, membershipId, customerId, {
        latitude: v.latitude,
        longitude: v.longitude,
        accuracy: 10,
        status: "granted",
      })
      assert.equal(resumed.new_stamp_count, 1, "a fresh cycle is collecting")
    })
  }
)

test(
  "an expired issued reward does not advance any cycle",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "issued-expiry")
      const [joined] = await tx`
      select * from public.join_customer_membership_with_first_stamp(
        ${customerId}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      const membershipId = joined.membership_id

      // Issued rewards carry cycle_number null: they were never a full card.
      await tx`
      insert into public.reward_events
        (merchant_id, customer_id, membership_id, loyalty_card_id, reward_name,
         reward_terms, status, source, redeemable_from, expires_at)
      values (${v.merchant_id}, ${customerId}, ${membershipId},
              ${v.loyalty_card_id}, 'Birthday drink', 'On the house',
              'unlocked', 'merchant_direct', current_date, now() - interval '1 day')`

      await tx`select public.expire_due_reward_events(now())`

      const [row] = await tx`
      select active_cycle_number, total_rewards_expired
      from public.customer_memberships where id = ${membershipId}`
      assert.equal(
        row.active_cycle_number,
        1,
        "an issued reward must not advance a cycle"
      )
      assert.equal(row.total_rewards_expired, 0)
    })
  }
)

// ---------------------------------------------------------------------------
// 20260805100200 — healing a cycle completed without a reward
// ---------------------------------------------------------------------------

test(
  "a cycle filled by a promotional grant is healed so it can be redeemed and released",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "heal")
      const [joined] = await tx`
      select * from public.join_customer_membership_with_first_stamp(
        ${customerId}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      const membershipId = joined.membership_id

      // Fill the rest of the card with grants that mint nothing, which is exactly
      // what claim_offer_campaign and claim_loyalty_invite do.
      for (let i = 1; i < v.stamps_required; i += 1) {
        await tx`
        insert into public.stamp_events
          (merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
           event_type, stamps_delta, earned_business_date, cycle_number, metadata)
        values (${v.merchant_id}, ${customerId}, ${membershipId},
                ${v.loyalty_card_id}, ${v.location_id}, 'earned', 1, null, 1,
                jsonb_build_object('source', 'offer_campaign'))`
      }
      await tx`
      update public.customer_memberships
      set current_stamp_count = ${v.stamps_required}
      where id = ${membershipId}`

      const [beforeRewards] = await tx`
      select count(*)::int as n from public.reward_events
      where membership_id = ${membershipId} and source = 'stamp_cycle'`
      assert.equal(
        beforeRewards.n,
        0,
        "the grants minted nothing — the dead end"
      )

      const [{ healed }] = await tx`
      select public.release_completed_cycles_without_reward() as healed`
      assert.ok(healed >= 1, "the sweep mints the missing reward")

      const [reward] = await tx`
      select status, cycle_number, metadata->>'source' as source
      from public.reward_events
      where membership_id = ${membershipId} and source = 'stamp_cycle'`
      assert.equal(reward.status, "unlocked")
      assert.equal(reward.cycle_number, 1)
      assert.equal(reward.source, "cycle_completed_without_reward")
    })
  }
)

test("the heal is idempotent", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [v] = await tx.unsafe(PICK)
    const customerId = await newCustomer(tx, "heal-idem")
    const membershipId = await driveToFullCard(tx, v, customerId)

    await tx`select public.mint_cycle_reward_if_missing(${membershipId}::uuid)`
    await tx`select public.mint_cycle_reward_if_missing(${membershipId}::uuid)`

    const [row] = await tx`
      select count(*)::int as n from public.reward_events
      where membership_id = ${membershipId} and source = 'stamp_cycle'`
    assert.equal(row.n, 1, "an existing reward is returned, never duplicated")
  })
})

async function seedFixtureCycle(tx, fixture) {
  for (let index = 0; index < 3; index += 1) {
    await upsertRewardPoolItem(tx, fixture, {
      rewardName: `Isolation reward ${index + 1}`,
      rewardTerms: "Subject to availability for this isolation test.",
      displayOrder: index,
    })
  }

  await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    select ${fixture.merchantId}::uuid,
           ${fixture.customerId}::uuid,
           ${fixture.membershipId}::uuid,
           ${fixture.cardId}::uuid,
           ${fixture.locationId}::uuid,
           'earned', 1,
           public.uk_business_date(now()) - series.day_offset,
           1,
           jsonb_build_object('source', 'isolation_test')
    from generate_series(1, 3) as series(day_offset)`
}

test(
  "an inactive-billing heal candidate cannot block another tenant's expiry",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const poisoned = await createRewardPoolFixture(tx)
      const healthy = await createRewardPoolFixture(tx)
      await seedFixtureCycle(tx, poisoned)
      await seedFixtureCycle(tx, healthy)

      const [{ reward_id: healthyRewardId }] = await tx`
        select public.mint_cycle_reward_if_missing(
          ${healthy.membershipId}::uuid
        ) as reward_id`
      await tx`
        update public.reward_events
        set expires_at = now() - interval '1 minute'
        where id = ${healthyRewardId}::uuid`

      await tx`
        update public.merchants
        set requires_billing = true
        where id = ${poisoned.merchantId}::uuid`

      const [{ expired }] = await tx`
        select public.expire_due_reward_events(now()) as expired`
      assert.ok(expired >= 1, "the healthy due reward still expires")

      const [healthyReward] = await tx`
        select status
        from public.reward_events
        where id = ${healthyRewardId}::uuid`
      assert.equal(healthyReward.status, "expired")

      const [poisonedRewards] = await tx`
        select count(*)::int as rows
        from public.reward_events
        where membership_id = ${poisoned.membershipId}::uuid`
      assert.equal(
        poisonedRewards.rows,
        0,
        "billing-ineligible membership does not mint"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// 20260805100500 — the merchant expiry setting, and its ACL
// ---------------------------------------------------------------------------

test(
  "save_loyalty_card exposes exactly one signature, and authenticated may call it",
  { skip },
  async () => {
    const rows = await db()`
    select p.oid::regprocedure::text as signature,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_may_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_may_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_loyalty_card'`

    assert.equal(
      rows.length,
      1,
      "the superseded 7-argument signature must be gone"
    )
    assert.match(rows[0].signature, /boolean,\s?integer\)$/)
    // The merchant desk calls this through the user-JWT client; losing this grant
    // in the drop/recreate would take the card screen down.
    assert.equal(rows[0].authenticated_may_execute, true)
    assert.equal(rows[0].service_role_may_execute, true)
  }
)

test(
  "a reward expiry outside the permitted range is refused with NBS12",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      const [owner] = await tx`
      select owner_user_id from public.merchants where id = ${v.merchant_id}`

      await tx`select set_config('request.jwt.claim.sub', ${owner.owner_user_id}::text, true)`
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`

      const code = await sqlstateOf(
        tx,
        (sp) => sp`
      select * from public.save_loyalty_card(
        ${v.merchant_id}::uuid, ${v.loyalty_card_id}::uuid, 'Mystery Visit Card',
        3::integer, 'Surprise reward',
        'A surprise reward on the house after 3 visits.', true, 4000::integer)`
      )

      assert.equal(
        code,
        "NBS12",
        "the RPC must refuse what the column CHECK forbids"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// 20260805100400 — offer pass mint refusal codes
// ---------------------------------------------------------------------------

test(
  "the offer pass mint refuses an out-of-window pass with NBP02",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [exists] = await tx`
      select count(*)::int as n from pg_proc
      where proname = 'create_offer_pass_scan_token'`
      if (!exists.n) return

      const [v] = await tx.unsafe(PICK)
      const customerId = await newCustomer(tx, "offer-pass")
      const [joined] = await tx`
      select * from public.join_customer_membership_with_first_stamp(
        ${customerId}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`

      const [campaign] = await tx`
      insert into public.offer_campaigns
        (merchant_id, status, discount_percent, starts_on, ends_on,
         requires_id_check, published_at)
      values (${v.merchant_id}, 'live', 10, current_date - 40, current_date - 10,
              false, now())
      returning id`
      const [claim] = await tx`
      insert into public.offer_campaign_claims
        (campaign_id, merchant_id, customer_id, membership_id, bonus_stamps_awarded)
      values (${campaign.id}, ${v.merchant_id}, ${customerId},
              ${joined.membership_id}, 0)
      returning id`
      const [pass] = await tx`
      insert into public.offer_discount_entitlements
        (claim_id, campaign_id, merchant_id, customer_id, membership_id,
         discount_percent, requires_id_check, valid_from, valid_to)
      values (${claim.id}, ${campaign.id}, ${v.merchant_id}, ${customerId},
              ${joined.membership_id}, 10, false,
              current_date - 40, current_date - 10)
      returning id`

      const code = await sqlstateOf(
        tx,
        (sp) => sp`
      select * from public.create_offer_pass_scan_token(
        ${pass.id}::uuid, ${customerId}::uuid)`
      )

      assert.equal(
        code,
        "NBP02",
        "an out-of-window pass refuses with a stable code"
      )
    })
  }
)
