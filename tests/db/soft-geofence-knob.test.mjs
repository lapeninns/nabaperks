import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-merchant-soft-geofence-knob — live-DB tier.
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

async function geofenceFlags(tx, membershipId) {
  return tx`
    select metadata from public.fraud_flags
    where membership_id = ${membershipId}::uuid
      and signal = 'self_service_geofence_out_of_range'`
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
        refused = error?.code === "23514" || /check constraint/i.test(String(error.message))
      }
      assert.ok(refused, `${bad} must violate the 1–99 CHECK`)
    }

    await tx`update public.merchant_locations
             set soft_geofence_trigger_stamp_number = 7
             where id = ${venue.location_id}::uuid`
    const [row] = await tx`
      select soft_geofence_trigger_stamp_number from public.merchant_locations
      where id = ${venue.location_id}::uuid`
    assert.equal(row.soft_geofence_trigger_stamp_number, 7, "an in-range value persists")
  })
})

test("a configured trigger of 2 fires the soft check on cycle stamp 2", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [venue] = await tx.unsafe(PICK)
    await tx`update public.merchant_locations
             set soft_geofence_trigger_stamp_number = 2
             where id = ${venue.location_id}::uuid`

    const fixture = await joinAndBackdateFirstStamp(tx, venue)
    await farStamp(tx, fixture) // cycle stamp 2, far away

    const flags = await geofenceFlags(tx, fixture.membershipId)
    assert.equal(flags.length, 1, "the out-of-range flag is recorded at the configured stamp")
    assert.equal(
      flags[0].metadata.cycle_stamp_number,
      2,
      "the flag carries the configured cycle stamp number"
    )
    assert.equal(
      flags[0].metadata.reason,
      "cycle_stamp_2_soft_geofence",
      "the flag reason reflects the configured trigger, not a hardcoded 3"
    )
  })
})

test("the default keeps today's behavior: no flag at stamp 2, flag at stamp 3", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [venue] = await tx.unsafe(PICK)
    // Default (3) — untouched.
    const fixture = await joinAndBackdateFirstStamp(tx, venue)

    await farStamp(tx, fixture) // cycle stamp 2 — before the trigger
    assert.equal(
      (await geofenceFlags(tx, fixture.membershipId)).length,
      0,
      "stamp 2 does not fire the check for a default venue"
    )

    await tx`
      update public.stamp_events
      set earned_business_date = earned_business_date - 1
      where membership_id = ${fixture.membershipId}::uuid`
    await farStamp(tx, fixture) // cycle stamp 3 — the default trigger

    const flags = await geofenceFlags(tx, fixture.membershipId)
    assert.equal(flags.length, 1, "stamp 3 fires the check for a default venue")
    assert.equal(flags[0].metadata.cycle_stamp_number, 3, "the flag records stamp 3")
  })
})
