import assert from "node:assert/strict"
import { after, test } from "node:test"

import { ageEarnedStamps } from "../../scripts/check-staging-release.mjs"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

// The staging journey moves every earned stamp of its synthetic membership two
// UK business days back before the next stamp. Earned rows two days apart
// then swap into each other's date, and stamp_events_one_earned_per_business_day_idx
// is checked row by row. When the scan meets the newer row first (heap order),
// a single shifting UPDATE collides with 23505 and the release proof fails
// at random.
test(
  "staging stamp ageing never collides on the one-earned-stamp-per-day index",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)

      // Newer row first, so it sits first in the heap.
      for (const earned of ["2026-07-03", "2026-07-01"]) {
        await tx`
          insert into public.stamp_events (
            merchant_id, customer_id, membership_id, loyalty_card_id,
            location_id, event_type, stamps_delta, created_at,
            earned_business_date, cycle_number
          ) values (
            ${fixture.merchantId}::uuid,
            ${fixture.customerId}::uuid,
            ${fixture.membershipId}::uuid,
            ${fixture.cardId}::uuid,
            ${fixture.locationId}::uuid,
            'earned',
            1,
            ${`${earned} 12:00:00+00`}::timestamptz,
            ${earned}::date,
            1
          )`
      }

      // Make the planner visit rows in heap order, as a sequential scan does
      // on a hosted database, instead of the date-ordered unique index.
      await tx`set local enable_indexscan = off`
      await tx`set local enable_indexonlyscan = off`

      await ageEarnedStamps(tx, fixture.membershipId)

      await tx`reset enable_indexscan`
      await tx`reset enable_indexonlyscan`

      const rows = await tx`
        select earned_business_date::text as earned
        from public.stamp_events
        where membership_id = ${fixture.membershipId}::uuid
          and event_type = 'earned'
        order by earned_business_date`
      assert.deepEqual(
        rows.map((row) => row.earned),
        ["2026-06-29", "2026-07-01"]
      )
    })
  }
)
