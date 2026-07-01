import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "card stamp display dates are scoped to the active cycle and sorted by UK business date",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)

      await tx`
      insert into public.stamp_events (
        merchant_id,
        customer_id,
        membership_id,
        loyalty_card_id,
        event_type,
        stamps_delta,
        created_at,
        earned_business_date,
        cycle_number
      )
      values
        (
          ${fixture.merchantId}::uuid,
          ${fixture.customerId}::uuid,
          ${fixture.membershipId}::uuid,
          ${fixture.cardId}::uuid,
          'earned',
          1,
          timestamptz '2026-07-01 12:00:00+00',
          date '2026-07-01',
          1
        ),
        (
          ${fixture.merchantId}::uuid,
          ${fixture.customerId}::uuid,
          ${fixture.membershipId}::uuid,
          ${fixture.cardId}::uuid,
          'earned',
          1,
          timestamptz '2026-06-29 12:00:00+00',
          date '2026-06-29',
          1
        ),
        (
          ${fixture.merchantId}::uuid,
          ${fixture.customerId}::uuid,
          ${fixture.membershipId}::uuid,
          ${fixture.cardId}::uuid,
          'earned',
          1,
          timestamptz '2026-06-30 12:00:00+00',
          date '2026-06-30',
          1
        ),
        (
          ${fixture.merchantId}::uuid,
          ${fixture.customerId}::uuid,
          ${fixture.membershipId}::uuid,
          ${fixture.cardId}::uuid,
          'earned',
          1,
          timestamptz '2026-06-28 12:00:00+00',
          date '2026-06-28',
          2
        )`

      const rows = await tx`
      select earned_business_date::text as earned_business_date
      from public.stamp_events
      where membership_id = ${fixture.membershipId}::uuid
        and event_type = 'earned'
        and cycle_number = 1
      order by earned_business_date asc, created_at asc, id asc`

      assert.deepEqual(
        rows.map((row) => row.earned_business_date),
        ["2026-06-29", "2026-06-30", "2026-07-01"]
      )
    })
  }
)
