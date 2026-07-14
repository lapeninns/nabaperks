import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * rewards customer birthday — live-DB invariant tier for
 * `issue_birthday_rewards`. R-1 happy path · R-2 idempotent · R-3 every gate ·
 * R-4 per-customer + sweep.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

/** Make the fixture's member eligible: DOB in the current London month (adult),
 *  a recent visit, and an enabled birthday reward on the card. */
async function makeEligible(tx, fixture) {
  await tx`
    update public.customers
    set date_of_birth = make_date(
          (extract(year from now())::int - 30),
          extract(month from (now() at time zone 'Europe/London'))::int, 15),
        full_name = 'Birthday Member', email_verified_at = now()
    where id = ${fixture.customerId}::uuid`
  await tx`
    update public.customer_memberships
    set last_visit_at = now()
    where id = ${fixture.membershipId}::uuid`
  await tx`
    update public.loyalty_cards
    set birthday_reward_enabled = true,
        birthday_reward_name = 'Birthday drink',
        birthday_reward_terms = 'A free drink in your birthday month, on the house.'
    where id = ${fixture.cardId}::uuid`
}

async function issue(tx, fixture, sweep = false) {
  const [row] = await tx`
    select public.issue_birthday_rewards(
      now(), ${sweep ? null : fixture.customerId}::uuid) as count`
  return row.count
}

test("R-1: an eligible member is issued one birthday reward with the right shape + side effects", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await makeEligible(tx, fixture)

    assert.equal(await issue(tx, fixture), 1, "one reward issued")

    const [r] = await tx`
      select source, birthday_year, reward_name, status, cycle_number,
             redeemable_from, expires_at
      from public.reward_events
      where source = 'birthday_month' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(r.source, "birthday_month")
    assert.equal(r.status, "unlocked")
    assert.equal(r.reward_name, "Birthday drink")
    assert.equal(r.cycle_number, null)

    const [{ y, d, exp }] = await tx`
      select extract(year from now() at time zone 'Europe/London')::int as y,
             public.uk_business_date(now()) as d,
             (date_trunc('month', now() at time zone 'Europe/London') + interval '1 month')
               at time zone 'Europe/London' as exp`
    assert.equal(r.birthday_year, y, "birthday_year is the London year")
    assert.equal(r.redeemable_from.getTime(), d.getTime(), "redeemable today")
    assert.equal(
      new Date(r.expires_at).getTime(),
      new Date(exp).getTime(),
      "expires at the first instant of next London month"
    )

    const [{ n: notif }] = await tx`
      select count(*)::int as n from public.notification_events
      where event_type = 'birthday_reward_issued' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(notif, 1, "a birthday_reward_issued notification is enqueued")

    const [{ n: evt }] = await tx`
      select count(*)::int as n from public.product_events
      where event_name = 'reward_issued' and customer_id = ${fixture.customerId}::uuid
        and metadata->>'source' = 'birthday_month'`
    assert.equal(evt, 1, "a reward_issued product event is recorded")
  })
})

test("R-2: issuance is idempotent and a cancelled reward does not free a re-issue", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await makeEligible(tx, fixture)

    assert.equal(await issue(tx, fixture), 1)
    assert.equal(await issue(tx, fixture), 0, "second run issues nothing")

    await tx`
      update public.reward_events
      set status = 'cancelled',
          cancelled_reason = 'Cancelled by the venue (test fixture).'
      where source = 'birthday_month' and customer_id = ${fixture.customerId}::uuid`
    assert.equal(await issue(tx, fixture), 0, "a cancelled birthday reward still blocks re-issue")
  })
})

const GATES = [
  ["disabled card", async (tx, f) => tx`update public.loyalty_cards set birthday_reward_enabled = false where id = ${f.cardId}::uuid`],
  ["inactive merchant", async (tx, f) => tx`update public.merchants set status = 'paused' where id = ${f.merchantId}::uuid`],
  ["billing required but absent", async (tx, f) => tx`update public.merchants set requires_billing = true where id = ${f.merchantId}::uuid`],
  ["billing cancelled", async (tx, f) => {
    await tx`update public.merchants set requires_billing = true where id = ${f.merchantId}::uuid`
    await tx`insert into public.billing_customers (merchant_id, stripe_customer_id, stripe_subscription_id, status)
             values (${f.merchantId}::uuid, ${"cus_b_" + f.merchantId.slice(0, 8)}, ${"sub_b_" + f.merchantId.slice(0, 8)}, 'cancelled')`
  }],
  ["wrong birthday month", async (tx, f) => tx`update public.customers set date_of_birth = make_date(1996, case when extract(month from now() at time zone 'Europe/London') = 1 then 2 else 1 end, 15) where id = ${f.customerId}::uuid`],
  ["null DOB", async (tx, f) => tx`update public.customers set date_of_birth = null where id = ${f.customerId}::uuid`],
  ["under 18", async (tx, f) => tx`update public.customers set date_of_birth = make_date((extract(year from now())::int - 10), extract(month from (now() at time zone 'Europe/London'))::int, 15) where id = ${f.customerId}::uuid`],
  ["dormant over 12 months", async (tx, f) => tx`update public.customer_memberships set last_visit_at = now() - interval '13 months' where id = ${f.membershipId}::uuid`],
]

for (const [label, breakIt] of GATES) {
  test(`R-3: no birthday reward when — ${label}`, { skip }, async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await makeEligible(tx, fixture)
      await breakIt(tx, fixture)
      assert.equal(await issue(tx, fixture), 0, `${label} → zero issued`)
      const [{ n }] = await tx`
        select count(*)::int as n from public.reward_events
        where source = 'birthday_month' and customer_id = ${fixture.customerId}::uuid`
      assert.equal(n, 0)
    })
  })
}

test("R-4: the null-arg sweep issues for every eligible member", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await makeEligible(tx, fixture)

    // A second eligible member on the same merchant/card.
    const authId = randomUUID()
    const customer2 = randomUUID()
    const membership2 = randomUUID()
    await tx`insert into auth.users (id) values (${authId}::uuid)`
    await tx`
      insert into public.customers (id, auth_user_id, email, full_name, date_of_birth, email_verified_at)
      values (${customer2}::uuid, ${authId}::uuid, ${"bday2-" + customer2.slice(0, 8) + "@example.test"},
        'Second Member',
        make_date((extract(year from now())::int - 25), extract(month from (now() at time zone 'Europe/London'))::int, 10),
        now())`
    await tx`
      insert into public.customer_memberships (id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number, last_visit_at)
      values (${membership2}::uuid, ${fixture.merchantId}::uuid, ${customer2}::uuid, 0, 0, 1, now())`

    assert.equal(await issue(tx, fixture, true), 2, "the sweep issues for both eligible members")
  })
})
