import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  actAsMerchantOwner,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

/**
 * rewards merchant sent — live-DB invariant tier for
 * `issue_merchant_direct_reward`. R-1 issue · R-2 tenancy/owner · R-3 billing ·
 * R-4 caps · R-5 bounds.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const NAME = "Manager's drink"
const TERMS = "A drink on us — thanks for being a regular."

function send(tx, merchantId, membershipId, overrides = {}) {
  return tx`
    select * from public.issue_merchant_direct_reward(
      ${merchantId}::uuid,
      ${membershipId}::uuid,
      ${overrides.name ?? NAME},
      ${overrides.terms ?? TERMS},
      ${overrides.days ?? 30},
      ${overrides.reason ?? "loyal regular"})`
}

async function expectRejection(tx, run, pattern) {
  let message = ""
  try {
    await tx.savepoint(run)
  } catch (error) {
    message = String(error.message)
  }
  assert.match(message, pattern)
}

test("R-1: an owner sends a direct reward with the full ledger + side effects", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    const [sent] = await send(tx, fixture.merchantId, fixture.membershipId)
    assert.ok(sent.reward_event_id, "returns the new reward id")

    const [r] = await tx`
      select source, status, reward_name, cycle_number, redeemable_from, expires_at,
             metadata->>'issued_by' as issued_by
      from public.reward_events where id = ${sent.reward_event_id}::uuid`
    assert.equal(r.source, "merchant_direct")
    assert.equal(r.status, "unlocked")
    assert.equal(r.reward_name, NAME)
    assert.equal(r.cycle_number, null)
    assert.equal(r.issued_by, "merchant_direct")

    const [{ d, exp }] = await tx`
      select public.uk_business_date(now()) as d, now() + interval '30 days' as exp`
    assert.equal(r.redeemable_from.getTime(), d.getTime(), "redeemable today")
    assert.equal(
      new Date(r.expires_at).getTime(),
      new Date(exp).getTime(),
      "expires now + 30 days"
    )

    const [{ n: evt }] = await tx`
      select count(*)::int as n from public.product_events
      where event_name = 'reward_sent' and membership_id = ${fixture.membershipId}::uuid`
    assert.equal(evt, 1, "a reward_sent product event is recorded")

    const [{ n: audit }] = await tx`
      select count(*)::int as n from public.audit_logs
      where action = 'direct_reward_issued' and target_id = ${sent.reward_event_id}::uuid`
    assert.equal(audit, 1, "a direct_reward_issued audit log is recorded")

    const [{ n: notif }] = await tx`
      select count(*)::int as n from public.notification_events
      where event_type = 'merchant_reward_received' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(notif, 1, "a merchant_reward_received notification is enqueued")
  })
})

test("R-2: a non-owner and a foreign membership are rejected", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    // Foreign membership: a second merchant's membership under this merchant id.
    const other = await createRewardPoolFixture(tx)
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, other.membershipId),
      /membership not found for merchant/i
    )

    // Non-owner (authenticated but not the owner).
    await actAsMerchantOwner(tx, randomUUID())
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId),
      /owner|access|privilege/i
    )
  })
})

test("R-3: the billing trio rejects a direct send", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await tx`update public.merchants set requires_billing = true where id = ${fixture.merchantId}::uuid`

    // requires_billing but no billing customer.
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId),
      /not active yet/i
    )

    // billing cancelled.
    await tx`
      insert into public.billing_customers (merchant_id, stripe_customer_id, stripe_subscription_id, status)
      values (${fixture.merchantId}::uuid, ${"cus_d_" + fixture.merchantId.slice(0, 8)}, ${"sub_d_" + fixture.merchantId.slice(0, 8)}, 'cancelled')`
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId),
      /unavailable/i
    )
  })
})

test("R-4: the per-membership and per-merchant daily caps reject", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    // First send succeeds; a same-day repeat to the same member is refused.
    await send(tx, fixture.merchantId, fixture.membershipId)
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId),
      /already been sent to this member today/i
    )

    // Drive the merchant to 100 today (attributed to member 1), then a fresh
    // member (0 today) still hits the per-merchant ceiling.
    const authId = randomUUID()
    const customer2 = randomUUID()
    const membership2 = randomUUID()
    await tx`insert into auth.users (id) values (${authId}::uuid)`
    await tx`
      insert into public.customers (id, auth_user_id, email, full_name, date_of_birth, email_verified_at)
      values (${customer2}::uuid, ${authId}::uuid, ${"send2-" + customer2.slice(0, 8) + "@example.test"}, 'Send Two', date '1990-01-01', now())`
    await tx`
      insert into public.customer_memberships (id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number)
      values (${membership2}::uuid, ${fixture.merchantId}::uuid, ${customer2}::uuid, 0, 0, 1)`

    // Backfill the merchant to 100 merchant_direct rewards today (member 1).
    await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        status, source, reward_name, reward_terms, redeemable_from, created_at, updated_at)
      select ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid, ${fixture.membershipId}::uuid,
             ${fixture.cardId}::uuid, 'unlocked', 'merchant_direct', 'Bulk',
             'Subject to availability.', public.uk_business_date(now()), now(), now()
      from generate_series(1, 99)`

    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, membership2),
      /daily.*limit|limit.*reached/i
    )
  })
})

test("R-5: out-of-range name / terms / expiry are rejected", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)

    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId, { terms: "too short" }),
      /terms/i
    )
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId, { name: "" }),
      /name/i
    )
    await expectRejection(
      tx,
      (sp) => send(sp, fixture.merchantId, fixture.membershipId, { days: 400 }),
      /expiry|365|days/i
    )
  })
})
