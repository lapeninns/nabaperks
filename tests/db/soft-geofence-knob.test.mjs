import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * merchant soft geofence knob — live-DB tier.
 *
 * The soft-geofence trigger stamp was CHECK-pinned to 3; the stamping RPC
 * already read it through coalesce(value, 3). This suite pins the widened
 * 1–99 bound and the behavior that makes the knob real: with a configured
 * trigger of N, an out-of-range stamp on cycle stamp N records the
 * self_service_geofence_out_of_range fraud flag (carrying N in metadata),
 * and venues left at the default keep today's stamp-3 behavior exactly.
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

// ~90km from the seeded Girton venue — unambiguously out of any 25–1000m radius.
const FAR = { latitude: 51.5074, longitude: -0.1278 }

async function joinAndBackdateFirstStamp(tx, venue) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, created_at, updated_at)
    values (${`geofence-${randomUUID()}@test.local`}, now(), 'Geofence Knob', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, '2026-06-06',
      ${venue.latitude}, ${venue.longitude})`

  // One-stamp-per-business-day: age the first stamp so the next one lands.
  await tx`
    update public.stamp_events
    set earned_business_date = (now() at time zone 'Europe/London')::date - 1
    where membership_id = ${joined.membership_id}::uuid`

  return { customerId: customer.id, membershipId: joined.membership_id }
}

async function farStamp(tx, fixture) {
  await tx`
    select * from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
      ${FAR.latitude}, ${FAR.longitude}, 10, 'granted', 900)`
}

/**
 * The SQLSTATE a far stamp raises, or null when it collects.
 *
 * Since 20260805100100 an out-of-range position REFUSES instead of flagging, so
 * the knob is now observed through the refusal rather than through a
 * fraud_flags row — a row written inside the refusing transaction is rolled
 * back with it.
 */
async function farStampSqlstate(tx, fixture) {
  try {
    await tx.savepoint(async (sp) => {
      await farStamp(sp, fixture)
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

async function earnedCount(tx, membershipId) {
  const [row] = await tx`
    select count(*)::int as n from public.stamp_events
    where membership_id = ${membershipId}::uuid and event_type = 'earned'`
  return row.n
}

test("the trigger bound is 1–99 at the SQL layer", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [venue] = await tx.unsafe(PICK)
    assert.ok(venue, "the seeded journey venue exists")

    for (const bad of [0, 100]) {
      let refused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`update public.merchant_locations
                   set soft_geofence_trigger_stamp_number = ${bad}
                   where id = ${venue.location_id}::uuid`
        })
      } catch (error) {
        refused =
          error?.code === "23514" ||
          /check constraint/i.test(String(error.message))
      }
      assert.ok(refused, `${bad} must violate the 1–99 CHECK`)
    }

    await tx`update public.merchant_locations
             set soft_geofence_trigger_stamp_number = 7
             where id = ${venue.location_id}::uuid`
    const [row] = await tx`
      select soft_geofence_trigger_stamp_number from public.merchant_locations
      where id = ${venue.location_id}::uuid`
    assert.equal(
      row.soft_geofence_trigger_stamp_number,
      7,
      "an in-range value persists"
    )
  })
})

test(
  "a configured trigger of 2 requires a verified location from visit 2",
  { skip },
  async () => {
    // The knob still decides WHEN verification starts; what changed in
    // 20260805100100 is what happens then — a refusal, not a flag.
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      await tx`update public.merchant_locations
             set soft_geofence_trigger_stamp_number = 2, require_geofence = true
             where id = ${venue.location_id}::uuid`

      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      const code = await farStampSqlstate(tx, fixture) // visit 2, far away

      assert.equal(
        code,
        "NBS10",
        "verification starts at the configured visit, not a hardcoded 3"
      )
      assert.equal(
        await earnedCount(tx, fixture.membershipId),
        1,
        "the refused stamp did not land"
      )
    })
  }
)

test(
  "the default (3) exempts visits 1-2 and requires verification from visit 3",
  { skip },
  async () => {
    // The first two visits of a membership are exempt outright, so joining and
    // the first return are never gated on a location permission prompt.
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      await tx`update public.merchant_locations
             set require_geofence = true
             where id = ${venue.location_id}::uuid`

      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      // Visit 2, far away — exempt, so it still collects.
      assert.equal(
        await farStampSqlstate(tx, fixture),
        null,
        "visit 2 is exempt for a default venue"
      )
      assert.equal(await earnedCount(tx, fixture.membershipId), 2)

      await tx`
      update public.stamp_events
      set earned_business_date = earned_business_date - 1
      where membership_id = ${fixture.membershipId}::uuid`

      // Visit 3 — the first verified visit.
      assert.equal(
        await farStampSqlstate(tx, fixture),
        "NBS10",
        "visit 3 must present a location that is actually the venue"
      )
      assert.equal(
        await earnedCount(tx, fixture.membershipId),
        2,
        "the refused stamp did not land"
      )
    })
  }
)
