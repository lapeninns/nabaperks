import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  inVerificationTxn,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"

for (const source of ["merchant_direct", "stamp_cycle"]) {
  test(
    `flagged v2 ${source} bootstraps owner ID verification without changing the open card`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await createRewardPoolFixture(tx)
        await tx`update public.loyalty_cards set reward_policy_version = 'v2'
        where id = ${f.cardId}::uuid`
        await asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
        update public.customers set date_of_birth = date '1991-02-03'
        where id = ${f.customerId}::uuid`
        )
        if (source === "stamp_cycle") {
          for (let index = 0; index < 3; index += 1) {
            await asPostgrestRole(
              tx,
              "authenticated",
              { sub: f.ownerUserId },
              (sp) => sp`
              select * from public.upsert_reward_pool_item(
                ${f.merchantId}::uuid, ${f.cardId}::uuid, null,
                ${`ID reward ${index}`}, 'One reward subject to availability.', 1, true, ${index}, true)`
            )
          }
          await tx`insert into public.stamp_events (
            merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
            event_type, stamps_delta, earned_business_date, cycle_number, metadata
          ) select ${f.merchantId}::uuid, ${f.customerId}::uuid,
            ${f.membershipId}::uuid, ${f.cardId}::uuid, ${f.locationId}::uuid,
            'earned', 1, public.uk_business_date(now()) - day, 1,
            '{"source":"self_service_qr"}'::jsonb
          from generate_series(1, 3) as day`
          const [completed] = await tx`select private.complete_cycle_if_full(
            ${f.membershipId}::uuid, 'age_gate_test') as id`
          assert.ok(completed.id)
          f.rewardEventId = completed.id
          await tx`update public.reward_events set available_from = now() - interval '1 day',
            redeemable_from = public.uk_business_date(now()) - 1
            where id = ${f.rewardEventId}::uuid`
        } else {
          await tx`
        insert into public.reward_events (
          id, merchant_id, customer_id, membership_id, loyalty_card_id,
          source, status, reward_name, reward_terms, redeemable_from,
          cycle_number, created_at, expires_at, reward_policy_version
        ) values (
          ${f.rewardEventId}::uuid, ${f.merchantId}::uuid, ${f.customerId}::uuid,
          ${f.membershipId}::uuid, ${f.cardId}::uuid, ${source}, 'unlocked',
          'ID checked reward', 'One reward subject to availability.',
          public.uk_business_date(now()) - 1,
          ${source === "stamp_cycle" ? 1 : null}, now() - interval '2 days',
          now() + interval '28 days', 'v2')`
        }
        const [before] =
          await tx`select current_stamp_count, active_cycle_number
        from public.customer_memberships where id = ${f.membershipId}::uuid`
        if (source === "stamp_cycle") {
          assert.equal(before.current_stamp_count, 0)
          assert.equal(before.active_cycle_number, 2)
        }
        const [token] = await asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
        select * from public.create_reward_scan_token(
          ${f.rewardEventId}::uuid, ${f.customerId}::uuid)`
        )
        const [context] = await asPostgrestRole(
          tx,
          "authenticated",
          { sub: f.ownerUserId },
          (sp) => sp`
        select * from public.get_owner_reward_scan_context(${token.scan_token}::uuid)`
        )
        assert.equal(context.scan_status, "verification_required")
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              "service_role",
              {},
              (sp) => sp`
          select * from public.collect_reward_scan_token(
            ${token.scan_token}::uuid, ${f.merchantId}::uuid)`
            ),
          /verified adult date of birth required|verified photo ID and be 18 or over/i
        )
        await asPostgrestRole(
          tx,
          "authenticated",
          { sub: f.ownerUserId },
          (sp) => sp`
        select * from public.verify_and_collect_reward_scan_token(
          ${token.scan_token}::uuid, date '1991-02-03', true)`
        )
        const [after] =
          await tx`select m.current_stamp_count, m.active_cycle_number,
          r.status, t.consumed_at
        from public.customer_memberships m
        join public.reward_events r on r.membership_id = m.id
        join public.reward_scan_tokens t on t.reward_event_id = r.id
        where r.id = ${f.rewardEventId}::uuid and t.id = ${token.scan_token}::uuid`
        assert.equal(after.status, "redeemed")
        assert.ok(after.consumed_at)
        assert.equal(after.current_stamp_count, before.current_stamp_count)
        assert.equal(after.active_cycle_number, before.active_cycle_number)
      })
    }
  )
}
after(async () => {
  await closeVerificationDb()
  await closeDb()
})

for (const requiresAgeCheck of [false, true]) {
  test(
    `direct reward age flag ${requiresAgeCheck} controls owner review and collection`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await createRewardPoolFixture(tx)
        await asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
        update public.customers set date_of_birth = date '1991-02-03'
        where id = ${f.customerId}::uuid`
        )
        const [reward] = await asPostgrestRole(
          tx,
          "authenticated",
          { sub: f.ownerUserId },
          (sp) => sp`
        select * from public.issue_merchant_direct_reward(
          ${f.merchantId}::uuid, ${f.membershipId}::uuid,
          'A meal', 'One meal subject to availability.', 30, null, ${requiresAgeCheck})`
        )
        await tx`
        update public.reward_events
        set available_from = now() - interval '1 minute',
            redeemable_from = public.venue_trading_date(merchant_id, now())
        where id = ${reward.reward_event_id}::uuid`
        const [token] = await asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
        select * from public.create_reward_scan_token(
          ${reward.reward_event_id}::uuid, ${f.customerId}::uuid)`
        )
        const [context] = await asPostgrestRole(
          tx,
          "authenticated",
          { sub: f.ownerUserId },
          (sp) => sp`
        select * from public.get_owner_reward_scan_context(${token.scan_token}::uuid)`
        )
        assert.equal(
          context.scan_status,
          requiresAgeCheck ? "verification_required" : "ready"
        )
        const collect = () =>
          asPostgrestRole(
            tx,
            "service_role",
            {},
            (sp) => sp`
        select * from public.collect_reward_scan_token(
          ${token.scan_token}::uuid, ${f.merchantId}::uuid)`
          )
        if (requiresAgeCheck) {
          await assert.rejects(
            collect,
            /verified adult date of birth required|verified photo ID and be 18 or over/i
          )
        } else {
          await collect()
          const [state] = await tx`
          select status from public.reward_events where id = ${reward.reward_event_id}::uuid`
          assert.equal(state.status, "redeemed")
        }
      })
    }
  )
}

test(
  "unflagged birthday issues without ID verification and keeps its issuance flag",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createRewardPoolFixture(tx)
      await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
      update public.customers set date_of_birth = make_date(
        extract(year from now())::int - 30,
        extract(month from now() at time zone 'Europe/London')::int, 15)
      where id = ${f.customerId}::uuid`
      )
      await tx`update public.customer_memberships set last_visit_at = now()
      where id = ${f.membershipId}::uuid`
      await asPostgrestRole(
        tx,
        "authenticated",
        { sub: f.ownerUserId },
        (sp) => sp`
      select * from public.save_loyalty_card_birthday_reward(
        ${f.merchantId}::uuid, ${f.cardId}::uuid, true,
        'Birthday meal', 'One meal during your birthday month.', false)`
      )
      const [issued] = await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
      select public.issue_birthday_rewards(now(), ${f.customerId}::uuid) as count`
      )
      assert.equal(issued.count, 1)
      await tx`update public.loyalty_cards set birthday_reward_requires_age_check = true
      where id = ${f.cardId}::uuid`
      const [reward] = await tx`
      select reward_policy_snapshot ->> 'age_check' as age_check
      from public.reward_events
      where customer_id = ${f.customerId}::uuid and source = 'birthday_month'`
      assert.equal(reward.age_check, "false")
    })
  }
)

test(
  "pool item edits do not rewrite an issued reward age snapshot",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createRewardPoolFixture(tx)
      const [item] = await asPostgrestRole(
        tx,
        "authenticated",
        { sub: f.ownerUserId },
        (sp) => sp`
      select * from public.upsert_reward_pool_item(
        ${f.merchantId}::uuid, ${f.cardId}::uuid, null,
        'A meal', 'One meal subject to availability.', 1, true, 0, false)`
      )
      await tx`
      insert into public.reward_events (
        id, merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, source, status, reward_name, reward_terms,
        redeemable_from, cycle_number
      ) values (
        ${f.rewardEventId}::uuid, ${f.merchantId}::uuid, ${f.customerId}::uuid,
        ${f.membershipId}::uuid, ${f.cardId}::uuid, ${item.reward_pool_item_id}::uuid,
        'stamp_cycle', 'unlocked', 'A meal', 'One meal subject to availability.',
        public.uk_business_date(now()), 1)`
      await tx`update public.reward_pool_items set requires_age_check = true
      where id = ${item.reward_pool_item_id}::uuid`
      const [reward] = await tx`
      select reward_policy_snapshot ->> 'age_check' as age_check
      from public.reward_events where id = ${f.rewardEventId}::uuid`
      assert.equal(reward.age_check, "false")
    })
  }
)

test(
  "expanded merchant RPCs expose one signature and keep implementations private",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      for (const name of [
        "upsert_reward_pool_item",
        "add_reward_pool_presets",
        "save_loyalty_card_birthday_reward",
        "save_loyalty_card",
        "issue_merchant_direct_reward",
        "create_bounded_merchant_reward_invite",
      ]) {
        const rows = await tx`
        select p.oid::regprocedure::text as signature,
          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
          has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role,
          n.nspname as schema
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where p.proname = ${name} and n.nspname in ('public', 'private')`
        const publicRows = rows.filter((row) => row.schema === "public")
        assert.equal(publicRows.length, 1, name)
        assert.equal(publicRows[0].anon, false)
        assert.equal(publicRows[0].authenticated, true)
        assert.equal(publicRows[0].service_role, true)
        for (const row of rows.filter((entry) => entry.schema === "private")) {
          assert.equal(row.anon, false, row.signature)
          assert.equal(row.authenticated, false, row.signature)
          assert.equal(row.service_role, false, row.signature)
        }
      }
    })
  }
)
