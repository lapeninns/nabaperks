import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

async function expectSqlState(tx, code, operation) {
  await assert.rejects(
    tx.savepoint(operation),
    (error) => error?.code === code,
    `expected SQLSTATE ${code}`
  )
}

async function insertReward(
  tx,
  fixture,
  source,
  cycleNumber,
  status = "unlocked"
) {
  const id = randomUUID()
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      status, source, reward_name, reward_terms, redeemable_from,
      cycle_number, redeemed_at, created_at, updated_at
    ) values (
      ${id}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      ${status}, ${source}, 'Trading day reward', 'Subject to availability.',
      public.uk_business_date(now()), ${cycleNumber},
      case when ${status} = 'redeemed' then now() else null end,
      now() - interval '2 days', now() - interval '2 days'
    )`
  return id
}

async function insertEarnedStamp(
  tx,
  fixture,
  businessDate,
  source = "self_service_qr"
) {
  const id = randomUUID()
  await tx`
    insert into public.stamp_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    ) values (
      ${id}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      ${fixture.locationId}::uuid, 'earned', 1, ${businessDate}::date, 1,
      jsonb_build_object('source', ${source}::text)
    )`
  return id
}

async function nextStampCandidates(tx, at, limit = 100) {
  return tx`
    select *
    from public.list_pending_next_stamp_available(
      ${at}::timestamptz,
      ${limit}
    )`
}

function dateText(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

test(
  "04:59 and 05:01 split the venue day while 23:30 and 01:00 stay together",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
      update public.merchant_locations
      set trading_day_starts_at = '05:00'
      where id = ${fixture.locationId}::uuid`

      const [row] = await tx`
      select
        public.venue_trading_date(
          ${fixture.merchantId}::uuid, '2026-09-07T04:59:00+01:00'::timestamptz
        )::text as before_five,
        public.venue_trading_date(
          ${fixture.merchantId}::uuid, '2026-09-07T05:01:00+01:00'::timestamptz
        )::text as after_five,
        public.venue_trading_date(
          ${fixture.merchantId}::uuid, '2026-09-07T23:30:00+01:00'::timestamptz
        )::text as late_evening,
        public.venue_trading_date(
          ${fixture.merchantId}::uuid, '2026-09-08T01:00:00+01:00'::timestamptz
        )::text as after_midnight,
        private.venue_code_day(
          ${fixture.merchantId}::uuid, '2026-09-07T04:59:00+01:00'::timestamptz
        )::text as code_before_five,
        private.venue_code_day(
          ${fixture.merchantId}::uuid, '2026-09-07T05:01:00+01:00'::timestamptz
        )::text as code_after_five`

      assert.equal(row.before_five, "2026-09-06")
      assert.equal(row.after_five, "2026-09-07")
      assert.equal(
        row.late_evening,
        row.after_midnight,
        "23:30 to 01:00 is one trading day"
      )
      assert.equal(
        row.code_before_five,
        row.before_five,
        "code and stamp day agree before 05:00"
      )
      assert.equal(
        row.code_after_five,
        row.after_five,
        "code and stamp day agree after 05:00"
      )
    })
  }
)

test("00:00 restores the London calendar date", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await tx`
      update public.merchant_locations
      set trading_day_starts_at = '00:00'
      where id = ${fixture.locationId}::uuid`
    const [row] = await tx`
      select
        public.venue_trading_date(
          ${fixture.merchantId}::uuid, '2026-09-07T00:10:00+01:00'::timestamptz
        )::text as trading_date,
        public.uk_business_date(
          '2026-09-07T00:10:00+01:00'::timestamptz
        )::text as london_date`
    assert.equal(row.trading_date, row.london_date)
  })
})

test(
  "the refusal twin and issuer use the stored venue trading date before insert",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
      delete from public.reward_events
      where membership_id = ${fixture.membershipId}::uuid`
      await tx`
      delete from public.stamp_events
      where membership_id = ${fixture.membershipId}::uuid`
      await tx`
      update public.customer_memberships
      set current_stamp_count = 0, total_stamps_earned = 0
      where id = ${fixture.membershipId}::uuid`

      await tx`
      insert into public.stamp_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata
      ) values (
        ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
        ${fixture.locationId}::uuid, 'earned', 1,
        public.venue_trading_date(${fixture.merchantId}::uuid, now()),
        1, '{"source":"self_service_qr"}'::jsonb
      )`

      const [refusal] = await tx`
      select private.visit_stamp_refusal_code(${fixture.membershipId}::uuid) as code`
      assert.equal(
        refusal.code,
        "NBS01",
        "the twin refuses the current venue day"
      )

      await expectSqlState(
        tx,
        "NBS01",
        (savepoint) => savepoint`
      select * from private.issue_visit_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        null, null, null, 'unsupported', null, ${fixture.customerId}, null
      )`
      )

      await tx`
      update public.stamp_events
      set earned_business_date =
        public.venue_trading_date(${fixture.merchantId}::uuid, now()) - 1
      where membership_id = ${fixture.membershipId}::uuid`

      const [issued] = await tx`
      select * from private.issue_visit_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        null, null, null, 'unsupported', null, ${fixture.customerId}, null
      )`
      const [stored] = await tx`
      select earned_business_date::text as earned_business_date
      from public.stamp_events where id = ${issued.stamp_event_id}::uuid`
      const [expected] = await tx`
      select public.venue_trading_date(
        ${fixture.merchantId}::uuid, now()
      )::text as trading_date`
      assert.equal(stored.earned_business_date, expected.trading_date)
    })
  }
)

test(
  "referral and promotional stamps keep null historical evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
      delete from public.reward_events
      where membership_id = ${fixture.membershipId}::uuid`
      await tx`
      delete from public.stamp_events
      where membership_id = ${fixture.membershipId}::uuid`
      await tx`
      update public.customer_memberships
      set current_stamp_count = 0, total_stamps_earned = 0
      where id = ${fixture.membershipId}::uuid`

      const ids = [randomUUID(), randomUUID()]
      await tx`
      insert into public.stamp_events (
        id, merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata
      ) values
      (
        ${ids[0]}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
        ${fixture.locationId}::uuid, 'earned', 1, null, 1,
        '{"source":"referral_bonus"}'::jsonb
      ),
      (
        ${ids[1]}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
        ${fixture.locationId}::uuid, 'earned', 1, null, 1,
        '{"source":"offer_campaign"}'::jsonb
      )`

      const rows = await tx`
      select metadata->>'source' as source, earned_business_date
      from public.stamp_events where id in (${ids[0]}::uuid, ${ids[1]}::uuid)
      order by source`
      assert.deepEqual(
        rows.map((row) => [row.source, row.earned_business_date]),
        [
          ["offer_campaign", null],
          ["referral_bonus", null],
        ]
      )
    })
  }
)

test(
  "next-stamp candidates open at the selected venue boundary and ignore null evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.merchant_locations
        set trading_day_starts_at = '05:00'
        where id = ${fixture.locationId}::uuid`

      for (const source of ["referral_bonus", "offer_campaign"]) {
        await insertEarnedStamp(tx, fixture, null, source)
      }
      const withoutRealEvidence = await nextStampCandidates(
        tx,
        "2026-09-08T05:01:00+01:00"
      )
      assert.equal(
        withoutRealEvidence.some(
          (row) => row.membership_id === fixture.membershipId
        ),
        false,
        "null promotional evidence cannot create eligibility"
      )

      await insertEarnedStamp(tx, fixture, "2026-09-07")
      for (const beforeBoundary of [
        "2026-09-07T23:30:00+01:00",
        "2026-09-08T01:00:00+01:00",
      ]) {
        const rows = await nextStampCandidates(tx, beforeBoundary)
        assert.equal(
          rows.some((row) => row.membership_id === fixture.membershipId),
          false,
          `${beforeBoundary} remains on the earned trading date`
        )
      }

      const afterBoundary = await nextStampCandidates(
        tx,
        "2026-09-08T05:01:00+01:00"
      )
      const candidate = afterBoundary.find(
        (row) => row.membership_id === fixture.membershipId
      )
      assert.ok(candidate, "the member becomes eligible after 05:00")
      assert.equal(candidate.loyalty_card_id, fixture.cardId)
      assert.equal(candidate.location_id, fixture.locationId)
      assert.equal(dateText(candidate.business_date), "2026-09-08")
      assert.equal(dateText(candidate.last_earned_business_date), "2026-09-07")
      assert.equal(
        candidate.dedupe_key,
        `next_stamp_available:${fixture.membershipId}:1:2026-09-08`
      )
    })
  }
)

test(
  "midnight venues expose the next stamp on the next London date",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.merchant_locations
        set trading_day_starts_at = '00:00'
        where id = ${fixture.locationId}::uuid`
      await insertEarnedStamp(tx, fixture, "2026-09-07")

      const rows = await nextStampCandidates(tx, "2026-09-08T00:01:00+01:00")
      const candidate = rows.find(
        (row) => row.membership_id === fixture.membershipId
      )
      assert.ok(candidate)
      assert.equal(dateText(candidate.business_date), "2026-09-08")
    })
  }
)

test(
  "next-stamp candidates are suppressed by their stable scheduled-event identity",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await insertEarnedStamp(tx, fixture, "2026-09-07")
      const at = "2026-09-08T05:01:00+01:00"
      const first = (await nextStampCandidates(tx, at)).find(
        (row) => row.membership_id === fixture.membershipId
      )
      assert.ok(first)

      await tx`
        insert into public.notification_events (
          event_type, category, customer_id, merchant_id, membership_id,
          cycle_number, business_date, due_at, dedupe_key
        ) values (
          'next_stamp_available', 'reminder', ${fixture.customerId}::uuid,
          ${fixture.merchantId}::uuid, ${fixture.membershipId}::uuid,
          ${first.cycle_number}, ${first.business_date}::date, ${at}::timestamptz,
          ${first.dedupe_key}
        )`

      const repeated = await nextStampCandidates(tx, at)
      assert.equal(
        repeated.some((row) => row.membership_id === fixture.membershipId),
        false
      )
    })
  }
)

test(
  "already-notified candidates are excluded before the bounded fair limit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await insertEarnedStamp(tx, fixture, "2026-09-07")
      await tx`
        create temporary table next_stamp_candidate_seed on commit drop as
        select
          series.n,
          extensions.gen_random_uuid() as auth_user_id,
          extensions.gen_random_uuid() as customer_id,
          extensions.gen_random_uuid() as membership_id
        from generate_series(1, 101) series(n)`
      await tx`
        insert into auth.users (id)
        select auth_user_id from next_stamp_candidate_seed`
      await tx`
        insert into public.customers (
          id, auth_user_id, email, full_name, date_of_birth, email_verified_at
        )
        select customer_id, auth_user_id,
          'next-stamp-' || n::text || '-' || customer_id::text || '@example.test',
          'Next Stamp Candidate', date '1990-01-01', now()
        from next_stamp_candidate_seed`
      await tx`
        insert into public.customer_memberships (
          id, merchant_id, customer_id, current_stamp_count,
          total_stamps_earned, active_cycle_number
        )
        select membership_id, ${fixture.merchantId}::uuid, customer_id, 1, 1, 1
        from next_stamp_candidate_seed`
      await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata
        )
        select ${fixture.merchantId}::uuid, customer_id, membership_id,
          ${fixture.cardId}::uuid, ${fixture.locationId}::uuid,
          'earned', 1, date '2026-09-06', 1,
          '{"source":"self_service_qr"}'::jsonb
        from next_stamp_candidate_seed`
      await tx`
        insert into public.notification_events (
          event_type, category, customer_id, merchant_id, membership_id,
          cycle_number, business_date, due_at, dedupe_key
        )
        select 'next_stamp_available', 'reminder', customer_id,
          ${fixture.merchantId}::uuid, membership_id, 1, date '2026-09-08',
          '2026-09-08T05:01:00+01:00'::timestamptz,
          'next_stamp_available:' || membership_id::text || ':1:2026-09-08'
        from next_stamp_candidate_seed`

      const rows = await nextStampCandidates(
        tx,
        "2026-09-08T05:01:00+01:00",
        100
      )
      assert.ok(rows.length <= 100, "the candidate batch stays bounded")
      assert.ok(
        rows.some((row) => row.membership_id === fixture.membershipId),
        "101 notified older candidates cannot starve the later eligible member"
      )

      await assert.rejects(
        tx.savepoint(
          (savepoint) => savepoint`
            select * from public.list_pending_next_stamp_available(now(), 501)`
        ),
        /limit must be between 1 and 500/
      )
    })
  }
)

test(
  "next-stamp candidate RPC is service-role-only and location-date authoritative",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [acl] = await tx`
        select
          has_function_privilege(
            'anon',
            'public.list_pending_next_stamp_available(timestamptz,integer)',
            'EXECUTE'
          ) as anon,
          has_function_privilege(
            'authenticated',
            'public.list_pending_next_stamp_available(timestamptz,integer)',
            'EXECUTE'
          ) as authenticated,
          has_function_privilege(
            'service_role',
            'public.list_pending_next_stamp_available(timestamptz,integer)',
            'EXECUTE'
          ) as service_role,
          pg_get_functiondef(
            'public.list_pending_next_stamp_available(timestamptz,integer)'::regprocedure
          ) as definition`
      assert.deepEqual(
        {
          anon: acl.anon,
          authenticated: acl.authenticated,
          service_role: acl.service_role,
        },
        { anon: false, authenticated: false, service_role: true }
      )
      assert.match(acl.definition, /private\.venue_trading_date/i)
      assert.match(acl.definition, /not exists/i)
      assert.doesNotMatch(acl.definition, /uk_business_date/i)
    })
  }
)

test(
  "NBR01 blocks a second standard redemption under the membership lock; gifts stay exempt",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`delete from public.reward_events where membership_id = ${fixture.membershipId}::uuid`
      await tx`
      update public.customer_memberships
      set current_stamp_count = 3, active_cycle_number = 1
      where id = ${fixture.membershipId}::uuid`

      await tx`
      update public.customer_memberships
      set active_cycle_number = 2
      where id = ${fixture.membershipId}::uuid`
      await insertReward(tx, fixture, "stamp_cycle", 1, "redeemed")
      const standardId = await insertReward(tx, fixture, "stamp_cycle", 2)
      const [state] = await tx`
      select state, reason
      from private.reward_collection_state(${standardId}::uuid, now())`
      assert.equal(state.state, "blocked")
      assert.equal(state.reason, "One reward per visit day already collected")

      await expectSqlState(
        tx,
        "NBR01",
        (savepoint) => savepoint`
      select * from private.redeem_self_service_reward_transition(
        ${standardId}::uuid, ${fixture.customerId}::uuid, null, null
      )`
      )

      const giftId = await insertReward(tx, fixture, "merchant_direct", null)
      await tx`
      select * from private.redeem_self_service_reward_transition(
        ${giftId}::uuid, ${fixture.customerId}::uuid, null, null
      )`
      const [gift] = await tx`
      select status from public.reward_events where id = ${giftId}::uuid`
      assert.equal(
        gift.status,
        "redeemed",
        "a merchant gift is exempt from NBR01"
      )

      const [definition] = await tx`
      select pg_get_functiondef(
        'private.redeem_self_service_reward_transition(uuid,uuid,numeric,numeric)'::regprocedure
      ) as body`
      assert.match(definition.body, /for update of rewards, memberships/i)
      assert.match(definition.body, /errcode = 'NBR01'/i)
    })
  }
)

test(
  "referral and direct-reward caps call the venue trading-date helper",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [definitions] = await tx`
      select
        pg_get_functiondef(
          'nabaperks_internal.settle_referral_bonus_with_visit(uuid)'::regprocedure
        ) as referral,
        pg_get_functiondef(
          coalesce(
            to_regprocedure(
              'private.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)'
            ),
            to_regprocedure(
              'public.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)'
            )
          )
        ) as direct`
      assert.match(definitions.referral, /venue_trading_date/)
      assert.doesNotMatch(
        definitions.referral,
        /uk_business_date\(referrer_bonus_awarded_at\)/
      )
      assert.match(definitions.direct, /venue_trading_date/)
      assert.doesNotMatch(
        definitions.direct,
        /uk_business_date\(reward_events\.created_at\)/
      )
    })
  }
)
