import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-customer-card-stamp — live-DB invariant tier.
 *
 * Proves the crown-jewel ledger invariant mocks cannot enforce: at most one
 * earned stamp per membership per UK business day (CS-1/CS-2/CS-3). Runs the
 * real `issue_self_service_stamp` RPC inside a rolled-back transaction, so the
 * seed is untouched and the test is repeatable.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK_MEMBERSHIP = /* sql */ `
  select cm.id as membership_id, cm.customer_id
  from public.customer_memberships cm
  join public.merchants mer on mer.id = cm.merchant_id
  where mer.status in ('trial', 'active')
    and (
      mer.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = mer.id and bc.status in ('trial', 'active')
      )
    )
  order by cm.created_at
  limit 1`

test(
  "CS-1/CS-2: a second same-day stamp is rejected, leaving exactly one earned row",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK_MEMBERSHIP)
      assert.ok(m, "a billing-eligible seeded membership exists")

      // Repeatability: clear any earned stamp for this membership today.
      await tx`
        delete from public.stamp_events
        where membership_id = ${m.membership_id}
          and event_type = 'earned'
          and earned_business_date = (now() at time zone 'Europe/London')::date`

      // First stamp today succeeds.
      const r1 = await tx`
        select * from public.issue_self_service_stamp(
          ${m.membership_id}::uuid, ${m.customer_id}::uuid)`
      assert.ok(
        (r1[0]?.new_stamp_count ?? 0) >= 1,
        "first stamp advances the cycle count"
      )

      // Second stamp the same UK day must be rejected. Use a savepoint so the
      // RPC's exception does not abort the outer transaction.
      let rejection = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select * from public.issue_self_service_stamp(
              ${m.membership_id}::uuid, ${m.customer_id}::uuid)`
        })
      } catch (error) {
        rejection = String(error.message)
      }
      assert.match(
        rejection,
        /Stamp already issued/,
        "the second same-day stamp must be rejected"
      )

      // CS-1: exactly one earned row exists for today.
      const [{ n }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${m.membership_id}
          and event_type = 'earned'
          and earned_business_date = (now() at time zone 'Europe/London')::date`
      assert.equal(n, 1, "exactly one earned stamp for this UK business day")
    })
  }
)
