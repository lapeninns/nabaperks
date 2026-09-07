import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * visit-stamp private primitives — live-DB tier.
 *
 * 20260907100100 moves the stamp transaction into private.issue_visit_stamp
 * (and the QR wrapper body into private.issue_qr_visit_stamp) so the venue-code
 * fallback can bypass ONLY the location check. This suite proves:
 *
 *   - the public overloads behave exactly as before for self-service stamping;
 *   - no API role can reach the private functions;
 *   - presence evidence is honoured only from a receipt written in the SAME
 *     transaction — a fabricated p_presence is refused with 42501;
 *   - with a genuine receipt the location gate is skipped and nothing else is:
 *     the stamp is recorded as 'venue_code', the daily limit still applies, and
 *     the unverified grace budget is untouched;
 *   - private.visit_stamp_refusal_code agrees with the primitive's order.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id,
         lc.id as loyalty_card_id,
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

const PRIVATE_STAMP =
  "private.issue_visit_stamp(uuid, uuid, numeric, numeric, numeric, text, integer, text, jsonb)"
const PRIVATE_QR_STAMP =
  "private.issue_qr_visit_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer, text, jsonb)"
const PRIVATE_REFUSAL = "private.visit_stamp_refusal_code(uuid)"

async function joinAndBackdateFirstStamp(tx, venue) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, full_name, created_at, updated_at)
    values (${`primitive-${randomUUID()}@test.local`}, now(), 'Primitive Proof', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, '2026-06-06',
      ${venue.latitude}, ${venue.longitude})`

  await tx`
    update public.stamp_events
    set earned_business_date = (now() at time zone 'Europe/London')::date - 1
    where membership_id = ${joined.membership_id}::uuid`

  return { customerId: customer.id, membershipId: joined.membership_id }
}

/** Force verification from visit 2 so the next stamp meets the location gate. */
async function requireLocationFromVisitTwo(tx, venue) {
  await tx`update public.merchant_locations
           set soft_geofence_trigger_stamp_number = 2, require_geofence = true
           where id = ${venue.location_id}::uuid`
}

async function sqlstateOf(tx, fn) {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp)
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

async function earnedRows(tx, membershipId) {
  return tx`
    select id, metadata from public.stamp_events
    where membership_id = ${membershipId}::uuid and event_type = 'earned'
    order by created_at asc`
}

// Rows written inside one transaction share the same now(), so "latest by
// created_at" is ambiguous; always address a stamp by the id the RPC returned.
async function stampById(tx, stampEventId) {
  const [row] = await tx`
    select id, metadata from public.stamp_events where id = ${stampEventId}::uuid`
  return row
}

async function writeReceipt(tx, venue, fixture, overrides = {}) {
  const [row] = await tx`
    insert into public.venue_code_stamp_receipts (
      merchant_id, location_id, customer_id, membership_id, loyalty_card_id,
      original_failure_reason, code_day, transaction_id
    ) values (
      ${venue.merchant_id}::uuid, ${venue.location_id}::uuid,
      ${fixture.customerId}::uuid, ${fixture.membershipId}::uuid,
      ${venue.loyalty_card_id}::uuid,
      'location_out_of_range', private.venue_code_day(now()),
      ${overrides.transactionId ?? tx`pg_current_xact_id()`}
    )
    returning id`
  return row.id
}

const PRESENCE = {
  kind: "venue_code",
  original_failure_reason: "location_out_of_range",
}

test(
  "no API role can execute the private stamp functions",
  { skip },
  async () => {
    const sql = db()
    for (const role of ["anon", "authenticated", "service_role"]) {
      const [row] = await sql`
      select
        has_function_privilege(${role}, ${PRIVATE_STAMP}, 'EXECUTE') as stamp,
        has_function_privilege(${role}, ${PRIVATE_QR_STAMP}, 'EXECUTE') as qr_stamp,
        has_function_privilege(${role}, ${PRIVATE_REFUSAL}, 'EXECUTE') as refusal`
      assert.equal(row.stamp, false, `${role} cannot call issue_visit_stamp`)
      assert.equal(
        row.qr_stamp,
        false,
        `${role} cannot call issue_qr_visit_stamp`
      )
      assert.equal(
        row.refusal,
        false,
        `${role} cannot call visit_stamp_refusal_code`
      )
    }
  }
)

test(
  "the public overloads keep their signatures and service-role-only grants",
  { skip },
  async () => {
    const rows = await db()`
    select pg_get_function_identity_arguments(p.oid) as args,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'issue_self_service_stamp'
    order by args`

    assert.deepEqual(
      rows.map((row) => row.args),
      [
        "p_membership_id uuid, p_customer_id uuid, p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric, p_location_status text, p_capture_elapsed_ms integer",
        "p_membership_id uuid, p_customer_id uuid, p_qr_id text, p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric, p_location_status text, p_capture_elapsed_ms integer, p_referral_bonuses_pre_drained integer",
      ],
      "exactly the two pinned overloads exist"
    )
    for (const row of rows) {
      assert.equal(row.service_role, true)
      assert.equal(row.authenticated, false)
      assert.equal(row.anon, false)
    }
  }
)

test(
  "self-service stamping is unchanged: far refuses NBS10, near verifies, metadata carries no presence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      assert.ok(venue, "the seeded journey venue exists")
      await requireLocationFromVisitTwo(tx, venue)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      const far = await sqlstateOf(
        tx,
        (sp) =>
          sp`select * from public.issue_self_service_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        ${FAR.latitude}, ${FAR.longitude}, 10, 'granted', 900)`
      )
      assert.equal(far, "NBS10", "out of range still refuses")

      const [near] = await tx`select * from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
      ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
      assert.equal(near.new_stamp_count, 2)
      assert.equal(near.geo_flagged, false)

      const stamp = await stampById(tx, near.stamp_event_id)
      assert.equal(stamp.metadata.source, "self_service_qr")
      assert.equal(stamp.metadata.geo_verification, "verified")
      assert.equal(stamp.metadata.location_status, "in_range")
      assert.equal(
        "presence_evidence" in stamp.metadata,
        false,
        "a GPS stamp never carries presence evidence"
      )
    })
  }
)

test(
  "the QR wrapper still demands venue QR proof (NBS08) and stamps through the shared transaction",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      const bogus = await sqlstateOf(
        tx,
        (sp) =>
          sp`select * from public.issue_self_service_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid, 'not-a-real-qr',
        ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900, 0)`
      )
      assert.equal(bogus, "NBS08")

      const [ok] = await tx`select * from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid, ${venue.qr_id},
      ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900, 0)`
      assert.equal(ok.new_stamp_count, 2)
      assert.ok(ok.stamp_event_id, "the QR path issues a real stamp")
    })
  }
)

test(
  "fabricated presence evidence is refused with 42501 and issues nothing",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      await requireLocationFromVisitTwo(tx, venue)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      const noReceipt = await sqlstateOf(
        tx,
        (sp) =>
          sp`select * from private.issue_visit_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        null, null, null, 'venue_code', null, 'test', ${PRESENCE}::jsonb)`
      )
      assert.equal(
        noReceipt,
        "42501",
        "presence without a receipt is a privilege failure"
      )

      // A receipt from ANOTHER transaction is not evidence for this one.
      await writeReceipt(tx, venue, fixture, {
        transactionId: tx`(pg_current_xact_id()::text::bigint - 1)::text::xid8`,
      })
      const staleReceipt = await sqlstateOf(
        tx,
        (sp) =>
          sp`select * from private.issue_visit_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        null, null, null, 'venue_code', null, 'test', ${PRESENCE}::jsonb)`
      )
      assert.equal(
        staleReceipt,
        "42501",
        "a receipt from a different transaction is refused"
      )

      const rows = await earnedRows(tx, fixture.membershipId)
      assert.equal(rows.length, 1, "no stamp landed")
    })
  }
)

test(
  "an in-transaction receipt bypasses only location: 'venue_code' stamp, daily limit kept, grace untouched",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      await requireLocationFromVisitTwo(tx, venue)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      const [{ n: unverifiedBefore }] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${fixture.membershipId}::uuid
        and metadata->>'geo_verification' = 'unverified'`

      const receiptId = await writeReceipt(tx, venue, fixture)
      const [result] = await tx`select * from private.issue_visit_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
      null, null, null, 'venue_code', null, 'test-actor', ${PRESENCE}::jsonb)`

      assert.equal(
        result.new_stamp_count,
        2,
        "the stamp landed despite no location"
      )
      assert.equal(
        result.geo_flagged,
        false,
        "a code-confirmed visit is not flagged"
      )

      const stamp = await stampById(tx, result.stamp_event_id)
      assert.ok(stamp, "the returned stamp id names a real earned row")
      assert.equal(
        (await earnedRows(tx, fixture.membershipId)).length,
        2,
        "exactly one stamp was added"
      )
      assert.equal(stamp.metadata.source, "self_service_qr", "it is a visit")
      assert.equal(stamp.metadata.geo_verification, "venue_code")
      assert.notEqual(
        stamp.metadata.geo_verification,
        "verified",
        "never labelled GPS-verified"
      )
      assert.equal(stamp.metadata.location_status, "venue_code")
      assert.deepEqual(stamp.metadata.presence_evidence, PRESENCE)
      assert.equal(
        "latitude" in stamp.metadata,
        false,
        "no coordinates in metadata"
      )

      const [receipt] = await tx`
      select stamp_event_id from public.venue_code_stamp_receipts
      where id = ${receiptId}::uuid`
      assert.equal(
        receipt.stamp_event_id,
        result.stamp_event_id,
        "the receipt is linked to its stamp"
      )

      const [{ n: unverifiedAfter }] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${fixture.membershipId}::uuid
        and metadata->>'geo_verification' = 'unverified'`
      assert.equal(
        unverifiedAfter,
        unverifiedBefore,
        "the unverified grace budget is not consumed"
      )

      const [audit] = await tx`
      select actor_type, actor_id, metadata from public.audit_logs
      where target_id = ${fixture.membershipId}::uuid
        and action = 'stamp_issued'
        and metadata->>'geo_verification' = 'venue_code'`
      assert.ok(audit, "the code-confirmed stamp wrote its own audit row")
      assert.equal(audit.actor_type, "customer")
      assert.equal(audit.actor_id, "test-actor")
      assert.equal(audit.metadata.geo_verification, "venue_code")

      // The daily limit is not part of location and still applies.
      await writeReceipt(tx, venue, fixture)
      const again = await sqlstateOf(
        tx,
        (sp) =>
          sp`select * from private.issue_visit_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        null, null, null, 'venue_code', null, 'test-actor', ${PRESENCE}::jsonb)`
      )
      assert.equal(again, "NBS01", "one stamp per UK business day, code or not")
    })
  }
)

test(
  "private.visit_stamp_refusal_code agrees with the primitive",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)

      const [fresh] =
        await tx`select private.visit_stamp_refusal_code(${fixture.membershipId}::uuid) as code`
      assert.equal(fresh.code, null, "a stampable membership has no refusal")

      await tx`select * from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
      ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
      const [stamped] =
        await tx`select private.visit_stamp_refusal_code(${fixture.membershipId}::uuid) as code`
      assert.equal(stamped.code, "NBS01", "already stamped today")
      assert.equal(
        await sqlstateOf(
          tx,
          (sp) =>
            sp`select * from public.issue_self_service_stamp(
          ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
          ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
        ),
        "NBS01",
        "the primitive says the same"
      )

      await tx`update public.merchants set status = 'paused' where id = ${venue.merchant_id}::uuid`
      const [paused] =
        await tx`select private.visit_stamp_refusal_code(${fixture.membershipId}::uuid) as code`
      assert.equal(
        paused.code,
        "NBS04",
        "merchant status outranks the daily limit, as in the primitive"
      )

      const [ghost] =
        await tx`select private.visit_stamp_refusal_code(${randomUUID()}::uuid) as code`
      assert.equal(ghost.code, "42501")
    })
  }
)
