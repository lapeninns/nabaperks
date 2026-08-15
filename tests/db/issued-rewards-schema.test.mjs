import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  actAsInternalAdmin,
  actAsMerchantOwner,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

/**
 * rewards issued source rails — schema/constraint tier.
 *
 * The 20260704090000 schema migration deliverable: source + birthday_year
 * columns and their coherence/uniqueness constraints (R-1/R-2), the loyalty_card
 * birthday config columns + save RPC (R-11), the notification ledger twin
 * (R-12), and the GDPR export fields (R-13).
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

async function insertReward(tx, fixture, source, birthdayYear, id = randomUUID()) {
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      status, source, birthday_year, reward_name, reward_terms,
      redeemable_from, created_at, updated_at)
    values (
      ${id}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      'unlocked', ${source}, ${birthdayYear}, 'Reward', 'Subject to availability.',
      public.uk_business_date(now()), now(), now())`
  return id
}

test("R-1: source defaults to stamp_cycle and rejects an unknown value", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const [row] = await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        status, reward_name, reward_terms, created_at, updated_at)
      values (
        ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
        'unlocked', 'Reward', 'Terms', now(), now())
      returning source`
    assert.equal(row.source, "stamp_cycle", "source defaults to stamp_cycle")

    let rejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`
          insert into public.reward_events (
            merchant_id, customer_id, membership_id, loyalty_card_id,
            status, source, reward_name, reward_terms, created_at, updated_at)
          values (
            ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
            ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
            'unlocked', 'not_a_source', 'Reward', 'Terms', now(), now())`
      })
    } catch {
      rejected = true
    }
    assert.ok(rejected, "an unknown source is rejected by the CHECK")
  })
})

test("R-1: birthday_year is coherent with source", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    // birthday_month requires a birthday_year.
    let missingYearRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await insertReward(sp, fixture, "birthday_month", null)
      })
    } catch {
      missingYearRejected = true
    }
    assert.ok(missingYearRejected, "birthday_month without birthday_year is rejected")

    // A non-birthday source must not carry a birthday_year.
    let strayYearRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await insertReward(sp, fixture, "stamp_cycle", 2026)
      })
    } catch {
      strayYearRejected = true
    }
    assert.ok(strayYearRejected, "stamp_cycle with a birthday_year is rejected")

    // The coherent shape is accepted.
    await insertReward(tx, fixture, "birthday_month", 2026)
    const [row] = await tx`
      select birthday_year from public.reward_events
      where source = 'birthday_month' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(row.birthday_year, 2026)
  })
})

test("R-2: at most one birthday reward per merchant+customer+year", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await insertReward(tx, fixture, "birthday_month", 2026)

    let duplicateRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await insertReward(sp, fixture, "birthday_month", 2026)
      })
    } catch {
      duplicateRejected = true
    }
    assert.ok(duplicateRejected, "a second birthday reward for the same year is rejected")

    // A different year is allowed.
    await insertReward(tx, fixture, "birthday_month", 2027)
    const [{ n }] = await tx`
      select count(*)::int as n from public.reward_events
      where source = 'birthday_month' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(n, 2, "two birthday rewards across two years coexist")
  })
})

test("R-11: loyalty_cards birthday CHECK enforces enabled ⇒ name+terms and bounds", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    // Enabled without name/terms is rejected.
    let enabledEmptyRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`
          update public.loyalty_cards set birthday_reward_enabled = true
          where id = ${fixture.cardId}::uuid`
      })
    } catch {
      enabledEmptyRejected = true
    }
    assert.ok(enabledEmptyRejected, "enabling without name/terms is rejected")

    // Terms below the lower bound are rejected.
    let shortTermsRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`
          update public.loyalty_cards
          set birthday_reward_enabled = true,
              birthday_reward_name = 'Birthday drink',
              birthday_reward_terms = 'too short'
          where id = ${fixture.cardId}::uuid`
      })
    } catch {
      shortTermsRejected = true
    }
    assert.ok(shortTermsRejected, "terms shorter than the lower bound are rejected")

    // A valid enabled config is accepted, and values persist while disabled.
    await tx`
      update public.loyalty_cards
      set birthday_reward_enabled = true,
          birthday_reward_name = 'Birthday drink',
          birthday_reward_terms = 'A free drink in your birthday month, on the house.'
      where id = ${fixture.cardId}::uuid`
    await tx`
      update public.loyalty_cards set birthday_reward_enabled = false
      where id = ${fixture.cardId}::uuid`
    const [card] = await tx`
      select birthday_reward_enabled, birthday_reward_name
      from public.loyalty_cards where id = ${fixture.cardId}::uuid`
    assert.equal(card.birthday_reward_enabled, false)
    assert.equal(card.birthday_reward_name, "Birthday drink", "name persists while disabled")
  })
})

test("R-11: save_loyalty_card_birthday_reward is owner-gated and validates terms", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    await actAsMerchantOwner(tx, fixture.ownerUserId)
    const [saved] = await tx`
      select * from public.save_loyalty_card_birthday_reward(
        ${fixture.merchantId}::uuid, ${fixture.cardId}::uuid, true,
        'Birthday drink', 'A free drink in your birthday month, on the house.')`
    assert.equal(saved.birthday_reward_enabled, true, "owner enables the birthday reward")
    assert.equal(saved.birthday_reward_name, "Birthday drink")

    // Enabling without terms is refused.
    let termsRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`
          select * from public.save_loyalty_card_birthday_reward(
            ${fixture.merchantId}::uuid, ${fixture.cardId}::uuid, true, 'X', null)`
      })
    } catch (error) {
      termsRejected = /terms|required/i.test(String(error.message))
    }
    assert.ok(termsRejected, "enabling without terms is rejected")

    // A non-owner is refused.
    await actAsMerchantOwner(tx, randomUUID())
    let ownerRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`
          select * from public.save_loyalty_card_birthday_reward(
            ${fixture.merchantId}::uuid, ${fixture.cardId}::uuid, false,
            'Birthday drink', 'A free drink in your birthday month, on the house.')`
      })
    } catch (error) {
      ownerRejected = /owner|access|privilege/i.test(String(error.message))
    }
    assert.ok(ownerRejected, "a non-owner cannot save the birthday reward")
  })
})

test("R-12: the two issued notification types are marketing and enqueue cleanly", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    for (const eventType of ["birthday_reward_issued", "merchant_reward_received"]) {
      const [{ category }] = await tx`
        select public.notification_event_category(${eventType}) as category`
      assert.equal(category, "marketing", `${eventType} is a marketing event`)
    }

    const [enqueued] = await tx`
      select public.enqueue_notification_event(
        'birthday_reward_issued',
        ${fixture.customerId}::uuid,
        ${fixture.merchantId}::uuid,
        ${fixture.membershipId}::uuid,
        null::uuid, null::integer, null::date, now(),
        ${"birthday_reward_issued:test:" + randomUUID()},
        '{}'::jsonb, '{}'::jsonb) as id`
    const [row] = await tx`
      select category from public.notification_events where id = ${enqueued.id}::uuid`
    assert.equal(row.category, "marketing", "the enqueued event lands as marketing")
  })
})

test("R-13: admin_export_customer_data includes source and birthday_year", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await insertReward(tx, fixture, "birthday_month", 2026)
    const emailHmac = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")
    const [invite] = await tx`
      select * from public.create_merchant_reward_invite(
        ${fixture.merchantId}::uuid,
        ${emailHmac}, null,
        'r***@example.com', null,
        'Invite reward',
        'Subject to availability for this invite.',
        null, 30, ${randomUUID().replace(/-/g, "")})`
    await tx`
      select * from public.attach_matched_reward_invites(
        ${fixture.customerId}::uuid, null, ${emailHmac}, null)`

    await actAsInternalAdmin(tx, fixture.adminUserId)
    const [{ payload }] = await tx`
      select public.admin_export_customer_data(
        ${fixture.customerId}::uuid, ${fixture.merchantId}::uuid,
        'email', 'GDPR export test notes') as payload`

    // v2 nests every governed relation under `sections.<export_section>.rows`.
    const rewards = payload.sections.reward_events.rows
    assert.ok(Array.isArray(rewards) && rewards.length > 0, "export carries reward events")
    const birthday = rewards.find((r) => r.source === "birthday_month")
    assert.ok(birthday, "the birthday reward is exported with its source")
    assert.equal(birthday.birthday_year, 2026, "birthday_year is exported")

    const invites = payload.sections.pending_reward_invites.rows
    assert.ok(Array.isArray(invites), "export carries pending reward invites")
    const exportedInvite = invites.find((row) => row.id === invite.invite_id)
    assert.ok(exportedInvite, "the attached invite is exported")
    assert.equal(exportedInvite.status, "attached")
  })
})
