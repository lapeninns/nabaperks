import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { currentTradingDay } from "./helpers/trading-day.mjs"

/**
 * Trading-day fixture dates — live-DB tier.
 *
 * The stamp guards compare `earned_business_date` with the venue trading date,
 * which rolls over at the location's `trading_day_starts_at`, not at UK
 * midnight. Fixtures that aged stamps to "UK calendar date - 1" collided with
 * the current trading day between 00:00 and the trading-day start and failed
 * with NBS01. This suite moves the trading-day start to the latest permitted
 * time (12:00) so the gap between the UK date and the trading date exists
 * whenever it runs before noon, and proves the shared helper matches what the
 * stamp RPC writes and that a stamp aged by it leaves "today" free.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id,
         l.id as location_id, l.latitude, l.longitude
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.merchant_locations l on l.id = lc.location_id
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

async function joinWithFirstStamp(tx, venue) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, created_at, updated_at)
    values (${`trading-day-${randomUUID()}@test.local`}, now(), 'Trading Day', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, '2026-06-06',
      ${venue.latitude}, ${venue.longitude})`
  return { customerId: customer.id, membershipId: joined.membership_id }
}

test(
  "the trading-day helper matches the date the stamp guard records, at any hour",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      assert.ok(venue, "the seeded Girton venue exists")
      await tx`update public.merchant_locations
               set trading_day_starts_at = time '12:00'
               where merchant_id = ${venue.merchant_id}::uuid`

      const { tradingDate, startsAt } = await currentTradingDay(
        tx,
        venue.merchant_id
      )
      const [{ now }] = await tx`select now() as now`
      assert.ok(startsAt <= now, "the current trading day has started")
      assert.ok(
        now - startsAt < 25 * 60 * 60 * 1000,
        "the current trading day began within the last trading day"
      )

      const fixture = await joinWithFirstStamp(tx, venue)
      const [first] = await tx`
        select earned_business_date from public.stamp_events
        where membership_id = ${fixture.membershipId}::uuid and event_type = 'earned'`
      assert.equal(
        first.earned_business_date.getTime(),
        tradingDate.getTime(),
        "the stamp RPC records the venue trading date the helper reports"
      )
    })
  }
)

test(
  "a stamp aged to the previous trading day leaves the current one free",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      await tx`update public.merchant_locations
               set trading_day_starts_at = time '12:00',
                   soft_geofence_trigger_stamp_number = 3
               where merchant_id = ${venue.merchant_id}::uuid`
      const fixture = await joinWithFirstStamp(tx, venue)

      await tx`
        update public.stamp_events
        set earned_business_date = public.venue_trading_date(merchant_id, now()) - 1
        where membership_id = ${fixture.membershipId}::uuid`

      const [second] = await tx`
        select * from public.issue_self_service_stamp(
          ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
          ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
      assert.equal(second.new_stamp_count, 2, "the second visit collects")

      let refusal = null
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select * from public.issue_self_service_stamp(
              ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
              ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
        })
      } catch (error) {
        refusal = error.code ?? String(error.message)
      }
      assert.equal(
        refusal,
        "NBS01",
        "the daily limit still refuses a second stamp in the same trading day"
      )
    })
  }
)
