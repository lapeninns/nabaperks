import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * rewards issued source rails — live-DB invariant tier (redemption side).
 *
 * Proves the source rails: an issued reward (birthday_month / merchant_direct)
 * shares the earned-reward redemption flow and every trust gate, but the
 * legacy stamp-count threshold is scoped to stamp_cycle rewards. Collection
 * records the outcome without changing the already-open v2 stamp cycle.
 *
 * R-3 stamp gate scoped · R-4 side-effects by source · R-5 gates preserved ·
 * R-7 collect notification by source.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

/**
 * Insert an unlocked reward with an explicit source, redeemable today. Kept
 * local (not in the shared fixture) so the file is self-contained inside the
 * spec blast radius.
 */
async function insertReward(tx, fixture, opts = {}) {
  await tx`update public.customers
    set date_of_birth_verified_at = now(),
        date_of_birth_verification_source = 'trusted_database'
    where id = ${fixture.customerId}::uuid`
  const id = opts.id ?? randomUUID()
  const source = opts.source ?? "stamp_cycle"
  const birthdayYear = opts.birthdayYear ?? null
  const rewardName = opts.rewardName ?? "Test reward"
  const cycleNumber = opts.cycleNumber ?? null
  const expiresAt = opts.expiresAt ?? null
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      status, source, birthday_year, reward_name, reward_terms,
      redeemable_from, expires_at, cycle_number, created_at, updated_at)
    values (
      ${id}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      'unlocked', ${source}, ${birthdayYear}, ${rewardName}, 'Subject to availability.',
      public.uk_business_date(now()), ${expiresAt}, ${cycleNumber}, now() - interval '2 days', now())`
  if (expiresAt) {
    await tx`update public.reward_events set expires_at = ${expiresAt}
      where id = ${id}::uuid`
  }
  return id
}

async function collect(tx, rewardId, fixture) {
  const [minted] = await tx`
    select scan_token from public.create_reward_scan_token(
      ${rewardId}::uuid, ${fixture.customerId}::uuid)`
  assert.ok(minted?.scan_token, "a scan token is minted")
  await tx`
    select * from public.collect_reward_scan_token(
      ${minted.scan_token}::uuid, ${fixture.merchantId}::uuid)`
  return minted.scan_token
}

test(
  "R-3/R-4: a birthday reward redeems below the stamp threshold and leaves the cycle untouched",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      // Issued rewards can be collected while the active card is incomplete.
      await tx`
        update public.customer_memberships
        set current_stamp_count = 1, active_cycle_number = 1, total_rewards_redeemed = 0
        where id = ${fixture.membershipId}::uuid`

      const rewardId = await insertReward(tx, fixture, {
        source: "birthday_month",
        birthdayYear: 2026,
        rewardName: "Birthday treat",
      })

      await collect(tx, rewardId, fixture)

      const [reward] = await tx`
        select status from public.reward_events where id = ${rewardId}::uuid`
      assert.equal(reward.status, "redeemed", "birthday reward is redeemed")

      const [m] = await tx`
        select current_stamp_count, active_cycle_number, total_rewards_redeemed
        from public.customer_memberships where id = ${fixture.membershipId}::uuid`
      assert.equal(m.current_stamp_count, 1, "stamp count is unchanged")
      assert.equal(m.active_cycle_number, 1, "cycle is not advanced")
      assert.equal(
        m.total_rewards_redeemed,
        1,
        "redemption count is incremented"
      )
    })
  }
)

test(
  "R-3 activated control: an issued legacy reward can mint at any open-cycle stamp count",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`update public.loyalty_cards set reward_policy_version = 'legacy_v1'
        where id = ${fixture.cardId}::uuid`
      await tx`
        update public.customer_memberships
        set current_stamp_count = 1
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "stamp_cycle",
      })

      const [minted] = await tx`
        select scan_token from public.create_reward_scan_token(
          ${rewardId}::uuid, ${fixture.customerId}::uuid)`
      assert.ok(minted.scan_token)
      const [cycle] = await tx`
        select current_stamp_count, active_cycle_number
        from public.customer_memberships
        where id = ${fixture.membershipId}::uuid`
      assert.deepEqual(cycle, {
        current_stamp_count: 1,
        active_cycle_number: 1,
      })
    })
  }
)

test(
  "R-4: v2 earned redemption preserves the already-open next cycle",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 1, active_cycle_number = 2, total_rewards_redeemed = 0
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "stamp_cycle",
        cycleNumber: 1,
      })

      await collect(tx, rewardId, fixture)

      const [m] = await tx`
        select current_stamp_count, active_cycle_number, total_rewards_redeemed
        from public.customer_memberships where id = ${fixture.membershipId}::uuid`
      assert.equal(
        m.current_stamp_count,
        1,
        "stamps on the next card are not consumed"
      )
      assert.equal(
        m.active_cycle_number,
        2,
        "collection leaves the already-open cycle unchanged"
      )
      assert.equal(
        m.total_rewards_redeemed,
        1,
        "redemption count is incremented"
      )
    })
  }
)

for (const policy of ["v2", "legacy_v1"]) {
  test(
    `R-7 (${policy}): earned collection records truthful copy without starting another cycle`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const fixture = await createRewardPoolFixture(tx)
        await tx`update public.loyalty_cards set reward_policy_version = ${policy}
        where id = ${fixture.cardId}::uuid`

        // The next card already opened when the earned reward was issued.
        await tx`
        update public.customer_memberships
        set current_stamp_count = 0, active_cycle_number = 2
        where id = ${fixture.membershipId}::uuid`
        const earnedId = await insertReward(tx, fixture, {
          source: "stamp_cycle",
          cycleNumber: 1,
        })
        const [issued] = await tx`select reward_policy_version
        from public.reward_events where id = ${earnedId}::uuid`
        assert.equal(issued.reward_policy_version, policy)
        // Old rewards retain their snapshot after the card activates v2.
        await tx`update public.loyalty_cards set reward_policy_version = 'v2'
        where id = ${fixture.cardId}::uuid`
        await collect(tx, earnedId, fixture)
        const [earnedNotif] = await tx`
        select count(*)::int as n from public.notification_events
        where event_type = 'reward_collected_cycle_started'
          and reward_event_id = ${earnedId}::uuid`
        assert.equal(
          earnedNotif.n,
          1,
          "earned collection emits one deduplicated service event"
        )

        const [collected] = await tx`
        select payload->>'title' as title, payload->>'body' as body,
               metadata->'cycle_started' as "cycleStarted"
        from public.notification_events
        where event_type = 'reward_collected_cycle_started'
          and reward_event_id = ${earnedId}::uuid`
        assert.deepEqual(collected, {
          title: "Reward collected",
          body: "Test reward collected at Reward Pool DB Test.",
          cycleStarted: false,
        })
        const [card] = await tx`select current_stamp_count, active_cycle_number
        from public.customer_memberships where id = ${fixture.membershipId}::uuid`
        assert.deepEqual(card, {
          current_stamp_count: 0,
          active_cycle_number: 2,
        })

        // Issued: birthday reward → collect → NO cycle-started notification.
        const birthdayId = await insertReward(tx, fixture, {
          source: "birthday_month",
          birthdayYear: 2026,
        })
        await collect(tx, birthdayId, fixture)
        const [issuedNotif] = await tx`
        select count(*)::int as n from public.notification_events
        where event_type = 'reward_collected_cycle_started'
          and reward_event_id = ${birthdayId}::uuid`
        assert.equal(
          issuedNotif.n,
          0,
          "issued collect does not enqueue a new cycle"
        )
      })
    }
  )
}

test(
  "R-5: the profile and 18+ gates still block an issued reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 0
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "merchant_direct",
      })

      // Under 18 → blocked even though stamps are skipped for issued rewards.
      await tx`
        update public.customers
        set date_of_birth = (now() - interval '10 years')::date
        where id = ${fixture.customerId}::uuid`
      let ageRejection = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select scan_token from public.create_reward_scan_token(
              ${rewardId}::uuid, ${fixture.customerId}::uuid)`
        })
      } catch (error) {
        ageRejection = String(error.message)
      }
      assert.match(ageRejection, /18 or over/i)

      // Incomplete profile → blocked.
      await tx`
        update public.customers
        set date_of_birth = date '1990-01-01', full_name = null
        where id = ${fixture.customerId}::uuid`
      let profileRejection = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select scan_token from public.create_reward_scan_token(
              ${rewardId}::uuid, ${fixture.customerId}::uuid)`
        })
      } catch (error) {
        profileRejection = String(error.message)
      }
      assert.match(profileRejection, /complete your profile/i)
    })
  }
)

test(
  "R-5: an expired issued reward cannot mint a collection token",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 0
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "birthday_month",
        birthdayYear: 2026,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })

      let rejection = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select scan_token from public.create_reward_scan_token(
              ${rewardId}::uuid, ${fixture.customerId}::uuid)`
        })
      } catch (error) {
        rejection = String(error.message)
      }
      assert.match(rejection, /expired/i)
    })
  }
)
