import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import {
  closeDb,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"
import {
  cleanupRewardPoolFixture,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select
    merchants.id as merchant_id,
    merchants.owner_user_id,
    locations.id as location_id,
    cards.id as card_id,
    memberships.id as membership_id,
    memberships.customer_id
  from public.merchants merchants
  join public.merchant_locations locations
    on locations.merchant_id = merchants.id and locations.is_primary
  join public.loyalty_cards cards
    on cards.merchant_id = merchants.id and cards.location_id = locations.id and cards.is_active
  join public.customer_memberships memberships
    on memberships.merchant_id = merchants.id
  where merchants.status in ('trial', 'active')
    and (select count(*) from public.reward_pool_items items
         where items.loyalty_card_id = cards.id and items.is_active) >= 2
  order by merchants.created_at, memberships.created_at
  limit 1`

async function fixture(tx) {
  const [picked] = await tx.unsafe(PICK)
  assert.ok(
    picked,
    "a seeded merchant with a member and two reward items exists"
  )
  const items = await tx`
    select id, reward_name, reward_terms
    from public.reward_pool_items
    where loyalty_card_id = ${picked.card_id}::uuid and is_active
    order by display_order, created_at, id
    limit 2`
  assert.equal(items.length, 2)
  return { ...picked, original: items[0], upgrade: items[1] }
}

async function asOwner(tx, fixtureRow) {
  await tx`select set_config('request.jwt.claim.sub', ${fixtureRow.owner_user_id}::text, true)`
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', ${fixtureRow.owner_user_id}::text,
      'role', 'authenticated'
    )::text,
    true
  )`
}

async function expectCode(tx, expectedCode, work) {
  let received = null
  try {
    await tx.savepoint(work)
  } catch (error) {
    received = error.code
  }
  assert.equal(received, expectedCode)
}

test(
  "window RPC validates shape, overlap and tenant-owned upgrade items",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const row = await fixture(tx)
      const wrongUserId = randomUUID()
      const wrongClaims = JSON.stringify({
        sub: wrongUserId,
        role: "authenticated",
      })
      let unauthorizedCode = null
      try {
        await tx.savepoint(async (savepoint) => {
          await savepoint`set local role authenticated`
          await savepoint`select set_config(
            'request.jwt.claims',
            ${wrongClaims},
            true
          )`
          await savepoint`select set_config(
            'request.jwt.claim.sub',
            ${wrongUserId},
            true
          )`
          await savepoint`select set_config(
            'request.jwt.claim.role', 'authenticated', true
          )`
          await savepoint`select public.save_venue_collection_windows(
            ${row.merchant_id}::uuid, ${row.location_id}::uuid, '[]'::jsonb
          )`
        })
      } catch (error) {
        unauthorizedCode = error.code
      }
      assert.equal(unauthorizedCode, "42501")
      await asOwner(tx, row)

      const [otherLocation] = await tx`
      insert into public.merchant_locations (merchant_id, name, is_primary)
      values (${row.merchant_id}::uuid, 'Scoped window test location', false)
      returning id`
      await tx`insert into public.venue_collection_windows (
      merchant_id, location_id, isodow, starts_at, ends_at
    ) values (
      ${row.merchant_id}::uuid, ${otherLocation.id}::uuid, 2, time '10:00', time '11:00'
    )`

      const valid = [
        {
          location_id: row.location_id,
          isodow: 1,
          starts_at: "12:00",
          ends_at: "15:00",
          upgrade_pool_item_id: row.upgrade.id,
          is_active: true,
        },
      ]
      await tx`select public.save_venue_collection_windows(
      ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${tx.json(valid)}::jsonb
    )`
      const [counts] = await tx`
      select
        count(*) filter (where location_id = ${row.location_id}::uuid)::int as scoped_count,
        count(*) filter (where location_id = ${otherLocation.id}::uuid)::int as other_count
      from public.venue_collection_windows
      where merchant_id = ${row.merchant_id}::uuid and is_active`
      assert.equal(counts.scoped_count, 1, "one active bonus window is saved")
      assert.equal(
        counts.other_count,
        1,
        "another location is preserved atomically"
      )

      await expectCode(tx, "NBW01", async (savepoint) => {
        const overlap = [
          { ...valid[0], starts_at: "12:00", ends_at: "14:00" },
          { ...valid[0], starts_at: "13:00", ends_at: "15:00" },
        ]
        await savepoint`select public.save_venue_collection_windows(
        ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${savepoint.json(overlap)}::jsonb
      )`
      })

      await expectCode(tx, "NBW02", async (savepoint) => {
        await savepoint`select public.save_venue_collection_windows(
          ${row.merchant_id}::uuid, ${row.location_id}::uuid,
          '{"isodow":1,"starts_at":"12:00","ends_at":"15:00"}'::jsonb
        )`
      })

      await expectCode(tx, "NBW02", async (savepoint) => {
        const malformed = [{ ...valid[0], starts_at: "not-a-time" }]
        await savepoint`select public.save_venue_collection_windows(
          ${row.merchant_id}::uuid, ${row.location_id}::uuid,
          ${savepoint.json(malformed)}::jsonb
        )`
      })

      await expectCode(tx, "NBW03", async (savepoint) => {
        const tooShort = [{ ...valid[0], starts_at: "12:00", ends_at: "12:15" }]
        await savepoint`select public.save_venue_collection_windows(
        ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${savepoint.json(tooShort)}::jsonb
      )`
      })

      const [foreignItem] = await tx`
      select items.id
      from public.reward_pool_items items
      where items.merchant_id <> ${row.merchant_id}::uuid and items.is_active
      limit 1`
      assert.ok(foreignItem, "a foreign tenant reward item exists")
      await expectCode(tx, "NBW04", async (savepoint) => {
        const crossTenant = [
          { ...valid[0], upgrade_pool_item_id: foreignItem.id },
        ]
        await savepoint`select public.save_venue_collection_windows(
        ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${savepoint.json(crossTenant)}::jsonb
      )`
      })

      await tx`select public.save_venue_collection_windows(
      ${row.merchant_id}::uuid, ${row.location_id}::uuid, '[]'::jsonb
    )`
      const [afterClear] = await tx`
      select
        count(*) filter (where location_id = ${row.location_id}::uuid and is_active)::int
          as scoped_count,
        count(*) filter (where location_id = ${otherLocation.id}::uuid and is_active)::int
          as other_count
      from public.venue_collection_windows
      where merchant_id = ${row.merchant_id}::uuid`
      assert.equal(
        afterClear.scoped_count,
        0,
        "an empty list clears only the scoped location"
      )
      assert.equal(
        afterClear.other_count,
        1,
        "the other location remains active after clear"
      )

      const [privileges] = await tx`
        select
          has_table_privilege('authenticated', 'public.venue_collection_windows', 'SELECT')
            as authenticated_select,
          has_table_privilege('authenticated', 'public.venue_collection_windows', 'INSERT,UPDATE,DELETE')
            as authenticated_write,
          has_table_privilege('service_role', 'public.venue_collection_windows', 'INSERT,UPDATE,DELETE')
            as service_write,
          has_function_privilege(
            'authenticated',
            'public.save_venue_collection_windows(uuid,uuid,jsonb)',
            'EXECUTE'
          ) as authenticated_save,
          has_function_privilege(
            'anon',
            'public.save_venue_collection_windows(uuid,uuid,jsonb)',
            'EXECUTE'
          ) as anonymous_save,
          has_function_privilege(
            'authenticated',
            'public.get_owner_reward_scan_context(uuid)',
            'EXECUTE'
          ) as authenticated_owner_scan,
          has_function_privilege(
            'service_role',
            'public.list_collection_window_reminders(timestamptz,integer)',
            'EXECUTE'
          ) as service_reminders,
          has_function_privilege(
            'authenticated',
            'public.list_collection_window_reminders(timestamptz,integer)',
            'EXECUTE'
          ) as authenticated_reminders`
      assert.equal(privileges.authenticated_select, true)
      assert.equal(privileges.authenticated_write, false)
      assert.equal(privileges.service_write, false)
      assert.equal(privileges.authenticated_save, true)
      assert.equal(privileges.anonymous_save, false)
      assert.equal(privileges.authenticated_owner_scan, true)
      assert.equal(privileges.service_reminders, true)
      assert.equal(privileges.authenticated_reminders, false)

      await tx`select public.add_venue_closure(
        ${row.merchant_id}::uuid, ${row.location_id}::uuid,
        '2030-01-10T00:00:00Z'::timestamptz,
        '2030-01-12T00:00:00Z'::timestamptz,
        'Planned maintenance'
      )`
      await expectCode(tx, "NBW06", async (savepoint) => {
        await savepoint`select public.add_venue_closure(
          ${row.merchant_id}::uuid, ${row.location_id}::uuid,
          '2030-01-11T00:00:00Z'::timestamptz,
          '2030-01-13T00:00:00Z'::timestamptz,
          'Overlapping maintenance'
        )`
      })
      await expectCode(tx, "NBW05", async (savepoint) => {
        await savepoint`select public.add_venue_closure(
          ${row.merchant_id}::uuid, ${row.location_id}::uuid,
          '2030-01-01T00:00:00Z'::timestamptz,
          '2030-05-01T00:00:00Z'::timestamptz,
          'Too long'
        )`
      })
    })
  }
)

test(
  "concurrent overlapping window writes serialize and one is refused",
  { skip },
  async () => {
    const setup = postgres(dbUrl(), { max: 1 })
    const first = postgres(dbUrl(), { max: 1 })
    const second = postgres(dbUrl(), { max: 1 })
    let locationId = null
    try {
      const [merchant] = await setup`
        select id from public.merchants order by created_at, id limit 1`
      assert.ok(merchant)
      const [location] = await setup`
        insert into public.merchant_locations (merchant_id, name, is_primary)
        values (${merchant.id}::uuid, 'Concurrent window test', false)
        returning id`
      locationId = location.id

      let contender
      await first.begin(async (tx) => {
        await tx`insert into public.venue_collection_windows (
          merchant_id, location_id, isodow, starts_at, ends_at
        ) values (
          ${merchant.id}::uuid, ${location.id}::uuid, 3, time '12:00', time '14:00'
        )`
        contender = second.begin(async (otherTx) => {
          await otherTx`set local statement_timeout = '5s'`
          await otherTx`insert into public.venue_collection_windows (
            merchant_id, location_id, isodow, starts_at, ends_at
          ) values (
            ${merchant.id}::uuid, ${location.id}::uuid, 3, time '13:00', time '15:00'
          )`
        })
        const state = await Promise.race([
          contender.then(
            () => "settled",
            () => "settled"
          ),
          new Promise((resolve) => setTimeout(() => resolve("waiting"), 100)),
        ])
        assert.equal(
          state,
          "waiting",
          "the second write waits on the location advisory lock"
        )
      })
      await assert.rejects(contender, (error) => error.code === "NBW01")
    } finally {
      if (locationId) {
        await setup`delete from public.merchant_locations where id = ${locationId}::uuid`
      }
      await Promise.all([
        setup.end({ timeout: 5 }),
        first.end({ timeout: 5 }),
        second.end({ timeout: 5 }),
      ])
    }
  }
)

test(
  "upgrade collection holds the live item stable through the atomic swap",
  { skip },
  async () => {
    const setup = postgres(dbUrl(), { max: 1 })
    const collector = postgres(dbUrl(), { max: 1 })
    const deactivator = postgres(dbUrl(), { max: 1 })
    let createdFixture = null
    try {
      createdFixture = await setup.begin((tx) => createRewardPoolFixture(tx))
      const itemRows = await setup`
        insert into public.reward_pool_items (
          merchant_id, location_id, loyalty_card_id, reward_name,
          reward_terms, weight, is_active, display_order, requires_age_check
        ) values
          (
            ${createdFixture.merchantId}::uuid,
            ${createdFixture.locationId}::uuid,
            ${createdFixture.cardId}::uuid,
            'Original concurrency reward', 'Original terms.', 1, true, 0, false
          ),
          (
            ${createdFixture.merchantId}::uuid,
            ${createdFixture.locationId}::uuid,
            ${createdFixture.cardId}::uuid,
            'Concurrent upgrade', 'Upgrade terms.', 1, true, 1, false
          )
        returning id, display_order`
      const items = {
        original_id: itemRows.find((item) => item.display_order === 0).id,
        upgrade_id: itemRows.find((item) => item.display_order === 1).id,
      }
      await setup`update public.loyalty_cards
        set reward_policy_version = 'v2', reward_expires_after_days = 56
        where id = ${createdFixture.cardId}::uuid`
      await setup`update public.customers
        set date_of_birth_verified_at = now(),
            date_of_birth_verification_source = 'merchant_owner',
            date_of_birth_verified_by = ${createdFixture.ownerUserId}::uuid
        where id = ${createdFixture.customerId}::uuid`
      const [{ isodow }] = await setup`
        select extract(isodow from now() at time zone 'Europe/London')::int as isodow`
      await setup`insert into public.venue_collection_windows (
        merchant_id, location_id, isodow, starts_at, ends_at, upgrade_pool_item_id
      ) values (
        ${createdFixture.merchantId}::uuid, ${createdFixture.locationId}::uuid,
        ${isodow}, time '00:00', time '23:59:59', ${items.upgrade_id}::uuid
      )`
      await setup`insert into public.reward_events (
        id, merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, created_at, updated_at, metadata
      ) values (
        ${createdFixture.rewardEventId}::uuid,
        ${createdFixture.merchantId}::uuid,
        ${createdFixture.customerId}::uuid,
        ${createdFixture.membershipId}::uuid,
        ${createdFixture.cardId}::uuid,
        ${items.original_id}::uuid,
        'unlocked', 'merchant_direct', 'Original concurrency reward',
        'Original terms.', 'v2', now() - interval '2 days',
        now() - interval '2 days', '{}'::jsonb
      )`

      let deactivate
      await collector.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
        await tx`select * from private.redeem_self_service_reward_transition(
          ${createdFixture.rewardEventId}::uuid,
          ${createdFixture.customerId}::uuid,
          null,
          null
        )`
        deactivate = deactivator.begin(async (otherTx) => {
          await otherTx`set local statement_timeout = '5s'`
          await otherTx`update public.reward_pool_items
            set is_active = false where id = ${items.upgrade_id}::uuid`
        })
        const state = await Promise.race([
          deactivate.then(
            () => "settled",
            () => "settled"
          ),
          new Promise((resolve) => setTimeout(() => resolve("waiting"), 100)),
        ])
        assert.equal(
          state,
          "waiting",
          "deactivation waits on the collected item's share lock"
        )
      })
      await deactivate

      const [stored] = await setup`
        select rewards.status, rewards.reward_pool_item_id,
               items.is_active as upgrade_active
        from public.reward_events rewards
        join public.reward_pool_items items on items.id = ${items.upgrade_id}::uuid
        where rewards.id = ${createdFixture.rewardEventId}::uuid`
      assert.equal(stored.status, "redeemed")
      assert.equal(stored.reward_pool_item_id, items.upgrade_id)
      assert.equal(
        stored.upgrade_active,
        false,
        "deactivation proceeds only after the committed upgrade"
      )
    } finally {
      if (createdFixture) {
        await setup`delete from public.notification_events
          where merchant_id = ${createdFixture.merchantId}::uuid`
        await cleanupRewardPoolFixture(setup, createdFixture)
      }
      await Promise.all([
        setup.end({ timeout: 5 }),
        collector.end({ timeout: 5 }),
        deactivator.end({ timeout: 5 }),
      ])
    }
  }
)

test(
  "V2 availability, no-window horizon and London DST boundaries are exact",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const row = await fixture(tx)
      await tx`delete from public.venue_collection_windows where location_id = ${row.location_id}::uuid`
      await tx`update public.merchant_locations
      set trading_day_starts_at = time '05:00'
      where id = ${row.location_id}::uuid`

      const [timing] = await tx`
      select
        private.v2_available_from(
          ${row.location_id}::uuid, '2026-10-23T20:00:00+01:00'::timestamptz
        )::text as available_from,
        private.compute_v2_reward_base_expires_at(
          ${row.location_id}::uuid,
          '2026-10-23T20:00:00+01:00'::timestamptz,
          private.v2_available_from(
            ${row.location_id}::uuid, '2026-10-23T20:00:00+01:00'::timestamptz
          ),
          56
        )::text as expires_at`
      assert.equal(timing.available_from, "2026-10-24 04:00:00+00")
      assert.equal(timing.expires_at, "2026-12-19 05:00:00+00")

      await tx`insert into public.venue_collection_windows (
      merchant_id, location_id, isodow, starts_at, ends_at, upgrade_pool_item_id
    ) values (
      ${row.merchant_id}::uuid, ${row.location_id}::uuid, 7,
      time '12:00', time '15:00', ${row.upgrade.id}::uuid
    )`
      const [dst] = await tx`
      select
        before_change.window_starts_at::text as before_change,
        after_change.window_starts_at::text as after_change
      from private.next_collection_window(
        ${row.location_id}::uuid, '2026-10-17T23:00:00Z'::timestamptz
      ) before_change
      cross join private.next_collection_window(
        ${row.location_id}::uuid, '2026-10-24T23:00:00Z'::timestamptz
      ) after_change`
      assert.equal(dst.before_change, "2026-10-18 11:00:00+00")
      assert.equal(dst.after_change, "2026-10-25 12:00:00+00")

      const [boundaries] = await tx`
      select
        (select count(*)::int from private.current_collection_window(
          ${row.location_id}::uuid, '2026-10-25T12:00:00Z'::timestamptz
        )) as at_start,
        (select count(*)::int from private.current_collection_window(
          ${row.location_id}::uuid, '2026-10-25T15:00:00Z'::timestamptz
        )) as at_end,
        private.compute_v2_reward_base_expires_at(
          ${row.location_id}::uuid,
          '2026-10-23T20:00:00+01:00'::timestamptz,
          private.v2_available_from(
            ${row.location_id}::uuid, '2026-10-23T20:00:00+01:00'::timestamptz
          ),
          56
        )::text as windowed_expires_at`
      assert.equal(boundaries.at_start, 1, "a window includes its exact start")
      assert.equal(boundaries.at_end, 0, "a window excludes its exact end")
      assert.equal(
        boundaries.windowed_expires_at,
        "2026-12-13 15:00:00+00",
        "windowed expiry uses the final window end inside the horizon"
      )

      const [seam] = await tx`
      select
        private.v2_available_from(
          ${row.location_id}::uuid, '2026-10-24T03:59:59Z'::timestamptz
        )::text as before_boundary,
        private.v2_available_from(
          ${row.location_id}::uuid, '2026-10-24T04:00:00Z'::timestamptz
        )::text as at_boundary`
      assert.equal(seam.before_boundary, "2026-10-24 04:00:00+00")
      assert.equal(seam.at_boundary, "2026-10-25 05:00:00+00")
    })
  }
)

test(
  "closures extend open V2 rewards, combine, cap, and never shorten",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const row = await fixture(tx)
      await tx`delete from public.venue_collection_windows where location_id = ${row.location_id}::uuid`
      await tx`delete from public.venue_closures where location_id = ${row.location_id}::uuid`
      await tx`update public.loyalty_cards
      set reward_policy_version = 'v2', reward_expires_after_days = 56
      where id = ${row.card_id}::uuid`

      const [created] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, created_at, updated_at, metadata
      ) values (
        ${row.merchant_id}::uuid, ${row.customer_id}::uuid,
        ${row.membership_id}::uuid, ${row.card_id}::uuid,
        ${row.original.id}::uuid, 'unlocked', 'merchant_direct',
        ${row.original.reward_name}, ${row.original.reward_terms}, 'v2',
        '2026-01-01T20:00:00Z'::timestamptz,
        '2026-01-01T20:00:00Z'::timestamptz,
        jsonb_build_object('requires_age_check', false)
      ) returning id, expires_at`
      const originalExpiry = created.expires_at

      const [firstClosure] = await tx`
      insert into public.venue_closures (
        merchant_id, location_id, starts_at, ends_at, reason
      ) values (
        ${row.merchant_id}::uuid, ${row.location_id}::uuid,
        '2026-01-10T00:00:00Z', '2026-01-12T00:00:00Z', 'Emergency repair'
      ) returning id`
      const [extended] = await tx`
      select expires_at from public.reward_events where id = ${created.id}::uuid`
      assert.ok(
        extended.expires_at > originalExpiry,
        "closure extends the stored deadline"
      )

      await tx`update public.venue_closures
      set ended_early_at = '2026-01-11T00:00:00Z'
      where id = ${firstClosure.id}::uuid`
      const [notShortened] = await tx`
      select expires_at from public.reward_events where id = ${created.id}::uuid`
      assert.equal(
        notShortened.expires_at.toISOString(),
        extended.expires_at.toISOString(),
        "ending a closure early never shortens an issued reward"
      )

      await tx`insert into public.venue_closures (
      merchant_id, location_id, starts_at, ends_at, reason
    ) values (
      ${row.merchant_id}::uuid, ${row.location_id}::uuid,
      '2026-01-20T00:00:00Z', '2026-02-20T00:00:00Z', 'Building works'
    )`
      const [combined] = await tx`
      select expires_at,
             (reward_policy_snapshot->'expiry_extensions') as extensions
      from public.reward_events where id = ${created.id}::uuid`
      assert.ok(
        combined.expires_at > extended.expires_at,
        "separate closures combine"
      )
      assert.equal(
        combined.extensions.length,
        2,
        "both contributing closures are snapshotted"
      )

      const [capped] = await tx`
      select private.compute_v2_reward_expires_at(
        ${row.location_id}::uuid,
        '2026-01-01T20:00:00Z'::timestamptz,
        '2026-01-02T05:00:00Z'::timestamptz,
        180
      ) as expires_at,
      private.compute_v2_reward_base_expires_at(
        ${row.location_id}::uuid,
        '2026-01-01T20:00:00Z'::timestamptz,
        '2026-01-02T05:00:00Z'::timestamptz,
        180
      ) as base_expires_at`
      assert.ok(
        capped.expires_at >= capped.base_expires_at,
        "a long base horizon is not shortened"
      )
      assert.ok(
        capped.expires_at <=
          new Date(capped.base_expires_at.getTime() + 90 * 86400000),
        "closure extension is capped at 90 days beyond the base horizon"
      )

      const [due] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, created_at, updated_at, metadata
      ) values (
        ${row.merchant_id}::uuid, ${row.customer_id}::uuid,
        ${row.membership_id}::uuid, ${row.card_id}::uuid,
        ${row.original.id}::uuid, 'unlocked', 'merchant_direct',
        ${row.original.reward_name}, ${row.original.reward_terms}, 'v2',
        '2025-01-01T20:00:00Z'::timestamptz,
        '2025-01-01T20:00:00Z'::timestamptz,
        '{}'::jsonb
      ) returning id, reward_policy_snapshot->>'expiry_rule' as expiry_rule`
      assert.equal(due.expiry_rule, "window_horizon")
      await tx`update public.reward_events
      set expires_at = '2025-02-01T00:00:00Z'::timestamptz
      where id = ${due.id}::uuid`
      await tx`select public.expire_due_reward_events(
        '2025-02-02T00:00:00Z'::timestamptz
      )`
      const [expired] = await tx`
      select status from public.reward_events where id = ${due.id}::uuid`
      assert.equal(
        expired.status,
        "expired",
        "the sweep expires a due V2 reward"
      )
    })
  }
)

test(
  "an age-gated upgrade overrides an unflagged issued item",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const row = await fixture(tx)
      await tx`delete from public.venue_collection_windows where location_id = ${row.location_id}::uuid`
      await tx`update public.merchants set status = 'active', requires_billing = false
      where id = ${row.merchant_id}::uuid`
      await tx`update public.loyalty_cards
      set reward_policy_version = 'v2', reward_expires_after_days = 56
      where id = ${row.card_id}::uuid`
      await tx`update public.customers
      set full_name = 'Age Upgrade Customer',
          date_of_birth = date '1990-01-01',
          date_of_birth_verified_at = null,
          date_of_birth_verification_source = null,
          date_of_birth_verified_by = null,
          email_verified_at = case when email is null then null else now() end
      where id = ${row.customer_id}::uuid`
      await tx`update public.reward_pool_items
      set requires_age_check = case when id = ${row.upgrade.id}::uuid then true else false end
      where id in (${row.original.id}::uuid, ${row.upgrade.id}::uuid)`
      const [{ isodow }] = await tx`
      select extract(isodow from now() at time zone 'Europe/London')::int as isodow`
      await tx`insert into public.venue_collection_windows (
      merchant_id, location_id, isodow, starts_at, ends_at, upgrade_pool_item_id
    ) values (
      ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${isodow},
      time '00:00', time '23:59:59', ${row.upgrade.id}::uuid
    )`
      const [reward] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, created_at, updated_at, metadata
      ) values (
        ${row.merchant_id}::uuid, ${row.customer_id}::uuid,
        ${row.membership_id}::uuid, ${row.card_id}::uuid,
        ${row.original.id}::uuid, 'unlocked', 'merchant_direct',
        ${row.original.reward_name}, ${row.original.reward_terms}, 'v2',
        now() - interval '2 days', now() - interval '2 days',
        jsonb_build_object('requires_age_check', false)
      ) returning id`

      const [eligibilityHelper] = await tx`
      select pg_get_functiondef(
        'private.reward_scan_eligibility_reason(uuid)'::regprocedure
      ) as definition`
      assert.match(
        eligibilityHelper.definition,
        /private\.reward_collection_state\(p_reward_id, now\(\)\)/,
        "scan eligibility delegates to the authoritative collection predicate"
      )

      const [gated] = await tx`
      select collection.state, collection.reason,
             private.reward_effective_requires_age_check(${reward.id}::uuid, now()) as age_check
      from private.reward_collection_state(${reward.id}::uuid, now()) collection`
      assert.equal(gated.age_check, true)
      assert.equal(gated.state, "blocked")
      assert.match(gated.reason, /verified photo ID/i)

      await tx`update public.reward_pool_items set is_active = false
      where id = ${row.upgrade.id}::uuid`
      const [fallback] = await tx`
      select collection.state,
             private.reward_effective_requires_age_check(${reward.id}::uuid, now()) as age_check
      from private.reward_collection_state(${reward.id}::uuid, now()) collection`
      assert.equal(
        fallback.age_check,
        false,
        "stale upgrade falls back to issued-item policy"
      )
      assert.equal(
        fallback.state,
        "ready",
        "the bonus never gates ordinary collection"
      )
    })
  }
)

test(
  "upgrade snapshots survive rename, stale items no-op, collect swaps atomically, and NBR01 holds",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const row = await fixture(tx)
      await tx`delete from public.venue_collection_windows where location_id = ${row.location_id}::uuid`
      await tx`delete from public.venue_closures where location_id = ${row.location_id}::uuid`
      await tx`update public.merchants set status = 'active', requires_billing = false
      where id = ${row.merchant_id}::uuid`
      await tx`update public.merchant_locations set require_geofence = false
      where id = ${row.location_id}::uuid`
      await tx`update public.loyalty_cards
      set reward_policy_version = 'v2', reward_expires_after_days = 56
      where id = ${row.card_id}::uuid`
      await tx`update public.customers
      set full_name = 'Window Test Customer',
          date_of_birth = date '1990-01-01',
          date_of_birth_verified_at = now(),
          email = coalesce(email, 'window-test@example.invalid'),
          email_verified_at = now()
      where id = ${row.customer_id}::uuid`
      await tx`update public.reward_pool_items set requires_age_check = false
      where id in (${row.original.id}::uuid, ${row.upgrade.id}::uuid)`

      const originalUpgradeName = row.upgrade.reward_name
      const [{ isodow }] = await tx`
      select extract(isodow from now() at time zone 'Europe/London')::int as isodow`
      await tx`insert into public.venue_collection_windows (
      merchant_id, location_id, isodow, starts_at, ends_at, upgrade_pool_item_id
    ) values (
      ${row.merchant_id}::uuid, ${row.location_id}::uuid, ${isodow},
      time '00:00', time '23:59:59', ${row.upgrade.id}::uuid
    )`

      const [first] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, cycle_number, created_at, updated_at, metadata
      ) values (
        ${row.merchant_id}::uuid, ${row.customer_id}::uuid,
        ${row.membership_id}::uuid, ${row.card_id}::uuid,
        ${row.original.id}::uuid, 'unlocked', 'stamp_cycle',
        ${row.original.reward_name}, ${row.original.reward_terms}, 'v2',
        (select coalesce(max(cycle_number), 0) + 1
         from public.reward_events
         where membership_id = ${row.membership_id}::uuid
           and source = 'stamp_cycle'),
        now() - interval '2 days', now() - interval '2 days', '{}'::jsonb
      ) returning id`

      await tx`update public.reward_pool_items
      set reward_name = 'Renamed after issue'
      where id = ${row.upgrade.id}::uuid`
      const [snapshotPreview] = await tx`
      select * from private.reward_window_upgrade(${first.id}::uuid, now())`
      assert.equal(
        snapshotPreview.reward_name,
        originalUpgradeName,
        "issued snapshot beats a later rename"
      )

      await tx`update public.reward_pool_items set is_active = false
      where id = ${row.upgrade.id}::uuid`
      const stalePreview = await tx`
      select * from private.reward_window_upgrade(${first.id}::uuid, now())`
      assert.equal(
        stalePreview.length,
        0,
        "a deactivated upgrade item produces no upgrade"
      )
      await tx`update public.reward_pool_items set is_active = true
      where id = ${row.upgrade.id}::uuid`

      const [collected] = await tx`
      select * from private.redeem_self_service_reward_transition(
        ${first.id}::uuid, ${row.customer_id}::uuid, null, null
      )`
      assert.equal(collected.reward_name, originalUpgradeName)
      const [stored] = await tx`
      select status, reward_pool_item_id, reward_name,
             metadata->>'upgraded_from' as upgraded_from
      from public.reward_events where id = ${first.id}::uuid`
      assert.equal(stored.status, "redeemed")
      assert.equal(stored.reward_pool_item_id, row.upgrade.id)
      assert.equal(stored.reward_name, originalUpgradeName)
      assert.equal(stored.upgraded_from, row.original.id)

      const [second] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        reward_pool_item_id, status, source, reward_name, reward_terms,
        reward_policy_version, cycle_number, created_at, updated_at, metadata
      ) values (
        ${row.merchant_id}::uuid, ${row.customer_id}::uuid,
        ${row.membership_id}::uuid, ${row.card_id}::uuid,
        ${row.original.id}::uuid, 'unlocked', 'stamp_cycle',
        ${row.original.reward_name}, ${row.original.reward_terms}, 'v2',
        (select coalesce(max(cycle_number), 0) + 1
         from public.reward_events
         where membership_id = ${row.membership_id}::uuid
           and source = 'stamp_cycle'),
        now() - interval '2 days', now() - interval '2 days', '{}'::jsonb
      ) returning id`
      await expectCode(tx, "NBR01", async (savepoint) => {
        await savepoint`select * from private.redeem_self_service_reward_transition(
        ${second.id}::uuid, ${row.customer_id}::uuid, null, null
      )`
      })
      const [stillOpen] = await tx`
      select status from public.reward_events where id = ${second.id}::uuid`
      assert.equal(
        stillOpen.status,
        "unlocked",
        "NBR01 leaves the second reward untouched"
      )
    })
  }
)
