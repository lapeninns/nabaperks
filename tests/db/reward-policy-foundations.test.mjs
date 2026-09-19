import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  actAsMerchantOwner,
  createRewardPoolFixture,
  upsertRewardPoolItem,
} from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "an explicit legacy card still issues a legacy-policy reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.loyalty_cards
        set reward_policy_version = 'legacy_v1',
            reward_expires_after_days = null
        where id = ${fixture.cardId}::uuid`
      await actAsMerchantOwner(tx, fixture.ownerUserId)
      for (let index = 0; index < 3; index += 1) {
        await upsertRewardPoolItem(tx, fixture, {
          rewardName: `Legacy policy reward ${index + 1}`,
          displayOrder: index,
        })
      }
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata
        )
        select ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
               ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
               ${fixture.locationId}::uuid, 'earned', 1, null, 1,
               jsonb_build_object('source', 'legacy_policy_fixture')
        from generate_series(1, 3)`

      const [{ reward_id: rewardId }] = await tx`
        select private.complete_cycle_if_full(
          ${fixture.membershipId}::uuid,
          'legacy_policy_fixture'
        ) as reward_id`
      const [reward] = await tx`
        select reward_policy_version,
               reward_policy_snapshot ->> 'collection' as collection_rule,
               reward_policy_snapshot ->> 'age_check' as age_check,
               reward_policy_snapshot ->> 'expiry' as expiry_rule
        from public.reward_events
        where id = ${rewardId}::uuid`

      assert.deepEqual(reward, {
        reward_policy_version: "legacy_v1",
        collection_rule: "next_uk_business_day",
        age_check: "true",
        expiry_rule: "never",
      })

      const collectionRows = await tx`
        select reward_id, state, reason, requires_age_check
        from public.get_reward_collection_states(
          array[${rewardId}::uuid, ${rewardId}::uuid]
        )`
      assert.deepEqual(
        [...collectionRows],
        [
          {
            reward_id: rewardId,
            state: "waiting",
            reason: "Reward is not redeemable until the next UK business day",
            requires_age_check: true,
          },
        ]
      )
    })
  }
)

test(
  "one live stamp-cycle reward per membership cycle is enforced",
  { skip },
  async () => {
    const sql = db()
    const [row] = await sql`
    select indexdef
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'reward_events_one_cycle_reward_idx'`
    assert.match(row?.indexdef ?? "", /UNIQUE/)
    assert.match(row?.indexdef ?? "", /source = 'stamp_cycle'/)
    assert.match(row?.indexdef ?? "", /status <> 'cancelled'/)
  }
)

test(
  "reward collection wrappers remain service-role only",
  { skip },
  async () => {
    const sql = db()
    const [row] = await sql`
    select
      has_function_privilege('anon', 'public.get_reward_collection_state(uuid)', 'EXECUTE') as anon,
      has_function_privilege('authenticated', 'public.get_reward_collection_state(uuid)', 'EXECUTE') as authenticated,
      has_function_privilege('service_role', 'public.get_reward_collection_state(uuid)', 'EXECUTE') as service_role,
      has_function_privilege('anon', 'public.get_reward_collection_states(uuid[])', 'EXECUTE') as batch_anon,
      has_function_privilege('authenticated', 'public.get_reward_collection_states(uuid[])', 'EXECUTE') as batch_authenticated,
      has_function_privilege('service_role', 'public.get_reward_collection_states(uuid[])', 'EXECUTE') as batch_service_role,
      has_function_privilege('anon', 'public.list_pending_reward_notification_candidates(text,timestamptz,integer)', 'EXECUTE') as candidates_anon,
      has_function_privilege('authenticated', 'public.list_pending_reward_notification_candidates(text,timestamptz,integer)', 'EXECUTE') as candidates_authenticated,
      has_function_privilege('service_role', 'public.list_pending_reward_notification_candidates(text,timestamptz,integer)', 'EXECUTE') as candidates_service_role`
    assert.equal(row.anon, false)
    assert.equal(row.authenticated, false)
    assert.equal(row.service_role, true)
    assert.equal(row.batch_anon, false)
    assert.equal(row.batch_authenticated, false)
    assert.equal(row.batch_service_role, true)
    assert.equal(row.candidates_anon, false)
    assert.equal(row.candidates_authenticated, false)
    assert.equal(row.candidates_service_role, true)
  }
)

test(
  "notification candidates filter notified and blocked rows before the bounded page",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const eligible = await createRewardPoolFixture(tx)
      const blocked = await createRewardPoolFixture(tx)
      await tx`
        update public.customers
        set date_of_birth_verified_at = now(),
            date_of_birth_verification_source = 'trusted_database',
            date_of_birth_verified_by = null
        where id in (${eligible.customerId}::uuid, ${blocked.customerId}::uuid)`
      await tx`update public.customers set full_name = null
        where id = ${blocked.customerId}::uuid`

      await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          source, status, reward_name, reward_terms, redeemable_from,
          cycle_number, created_at, metadata
        )
        select ${eligible.merchantId}::uuid, ${eligible.customerId}::uuid,
               ${eligible.membershipId}::uuid, ${eligible.cardId}::uuid,
               'stamp_cycle', 'unlocked', 'Already notified reward',
               'Subject to availability.', public.uk_business_date(now()) - 19,
               series.n, now() - interval '20 days' + series.n * interval '1 minute',
               jsonb_build_object('candidate_class', 'notified')
        from generate_series(1, 101) series(n)`
      await tx`
        insert into public.notification_events (
          event_type, category, customer_id, merchant_id, membership_id,
          reward_event_id, due_at, dedupe_key
        )
        select 'reward_ready', 'transactional', rewards.customer_id,
               rewards.merchant_id, rewards.membership_id, rewards.id,
               now(), 'candidate-test:' || rewards.id::text
        from public.reward_events rewards
        where rewards.membership_id = ${eligible.membershipId}::uuid
          and rewards.metadata ->> 'candidate_class' = 'notified'`

      await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          source, status, reward_name, reward_terms, redeemable_from,
          cycle_number, created_at, metadata
        )
        select ${blocked.merchantId}::uuid, ${blocked.customerId}::uuid,
               ${blocked.membershipId}::uuid, ${blocked.cardId}::uuid,
               'stamp_cycle', 'unlocked', 'Blocked reward',
               'Subject to availability.', public.uk_business_date(now()) - 17,
               series.n, now() - interval '18 days' + series.n * interval '1 minute',
               jsonb_build_object('candidate_class', 'blocked')
        from generate_series(1, 101) series(n)`
      const [survivor] = await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          source, status, reward_name, reward_terms, redeemable_from,
          cycle_number, created_at, metadata
        ) values (
          ${eligible.merchantId}::uuid, ${eligible.customerId}::uuid,
          ${eligible.membershipId}::uuid, ${eligible.cardId}::uuid,
          'stamp_cycle', 'unlocked', 'Later eligible reward',
          'Subject to availability.', public.uk_business_date(now()) - 1,
          102, now() - interval '1 day',
          jsonb_build_object('candidate_class', 'survivor')
        ) returning id`

      const rows = await tx`
        select * from public.list_pending_reward_notification_candidates(
          'reward_ready', now(), 100
        )`
      assert.deepEqual(
        rows
          .filter((row) =>
            [eligible.membershipId, blocked.membershipId].includes(
              row.membership_id
            )
          )
          .map((row) => row.reward_event_id),
        [survivor.id]
      )
      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`select * from public.list_pending_reward_notification_candidates(
            'unsupported', now(), 100
          )`
        ),
        /Unsupported reward notification event type/
      )
      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`select * from public.list_pending_reward_notification_candidates(
            'reward_ready', now(), 501
          )`
        ),
        /limit must be between 1 and 500/
      )
    })
  }
)

test(
  "cards created after activation mint v2 rewards and open cycle two",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)
      for (let index = 0; index < 3; index += 1) {
        await upsertRewardPoolItem(tx, fixture, {
          rewardName: `Post-activation reward ${index + 1}`,
          displayOrder: index,
        })
      }
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`
      insert into public.stamp_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata
      )
      select ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
             ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
             ${fixture.locationId}::uuid, 'earned', 1, null, 1,
             jsonb_build_object('source', 'post_activation_fixture')
      from generate_series(1, 3)`

      const [{ reward_id: rewardId }] = await tx`
      select public.mint_cycle_reward_if_missing(
        ${fixture.membershipId}::uuid
      ) as reward_id`
      const [state] = await tx`
      select cards.reward_policy_version as card_version,
             rewards.reward_policy_version as reward_version,
             rewards.reward_policy_snapshot ->> 'collection' as collection_rule,
             memberships.current_stamp_count,
             memberships.active_cycle_number
      from public.loyalty_cards cards
      join public.customer_memberships memberships
        on memberships.id = ${fixture.membershipId}::uuid
      join public.reward_events rewards on rewards.id = ${rewardId}::uuid
      where cards.id = ${fixture.cardId}::uuid`
      assert.deepEqual(
        {
          cardVersion: state.card_version,
          rewardVersion: state.reward_version,
          collectionRule: state.collection_rule,
          stampCount: state.current_stamp_count,
          cycle: state.active_cycle_number,
        },
        {
          cardVersion: "v2",
          rewardVersion: "v2",
          collectionRule: "next_trading_day",
          stampCount: 0,
          cycle: 2,
        }
      )
    })
  }
)
