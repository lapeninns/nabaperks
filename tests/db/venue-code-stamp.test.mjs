import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * venue code stamp — live-DB tier.
 *
 * The RPCs of 20260908100000. A wrong code is a returned status whose ledger
 * survives; five of them lock the membership out; a right code is honoured
 * only after a server-recorded location refusal, and then issues the stamp
 * through the shared transaction with every non-location refusal intact.
 * The owner reads and resets the code only for a venue they own.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, m.owner_user_id, q.qr_id,
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
    values (${`venue-code-${randomUUID()}@test.local`}, now(), 'Venue Code', now(), now())
    returning id`
  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, '2026-06-06',
      ${venue.latitude}, ${venue.longitude})`
  await tx`
    update public.stamp_events
    set earned_business_date = (now() at time zone 'Europe/London')::date - 1
    where membership_id = ${joined.membership_id}::uuid`
  await tx`update public.merchant_locations
           set soft_geofence_trigger_stamp_number = 2, require_geofence = true
           where id = ${venue.location_id}::uuid`
  return { customerId: customer.id, membershipId: joined.membership_id }
}

/** A far scan that is refused, then recorded — exactly what the app does. */
async function refuseFarScan(tx, fixture) {
  let code = null
  try {
    await tx.savepoint(async (sp) => {
      await sp`select * from public.issue_self_service_stamp(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
        ${FAR.latitude}, ${FAR.longitude}, 10, 'granted', 900)`
    })
  } catch (error) {
    code = error.code ?? null
  }
  assert.equal(code, "NBS10", "the far scan is refused")
  await tx`select public.record_stamp_location_refusal(
    ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid, 'location_out_of_range')`
}

async function todaysCode(tx, merchantId) {
  const [row] =
    await tx`select private.venue_code_for(${merchantId}::uuid) as code`
  return row.code
}

function wrongCode(code) {
  return String((Number(code) + 1) % 1000000).padStart(6, "0")
}

async function enterCode(tx, venue, fixture, code) {
  const [row] = await tx`select * from public.issue_venue_code_stamp(
    ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid, ${venue.qr_id},
    ${code}, null, 0)`
  return row
}

async function enterCodeSqlstate(tx, venue, fixture, code) {
  try {
    await tx.savepoint(async (sp) => {
      await enterCode(sp, venue, fixture, code)
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

async function consumeSqlstate(tx, fixture) {
  try {
    await tx.savepoint(async (sp) => {
      await sp`select public.consume_venue_code_attempt(
        ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid, null, null)`
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

async function receipts(tx, membershipId) {
  return tx`select * from public.venue_code_stamp_receipts
            where membership_id = ${membershipId}::uuid`
}

async function earnedCount(tx, membershipId) {
  const [row] = await tx`
    select count(*)::int as n from public.stamp_events
    where membership_id = ${membershipId}::uuid and event_type = 'earned'`
  return row.n
}

test(
  "a wrong code returns code_rejected, counts down, and writes a durable ledger row",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      assert.ok(venue, "the seeded journey venue exists")
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      await refuseFarScan(tx, fixture)
      const code = await todaysCode(tx, venue.merchant_id)

      const first = await enterCode(tx, venue, fixture, wrongCode(code))
      assert.equal(first.status, "code_rejected")
      assert.equal(first.attempts_remaining, 4)
      assert.equal(first.locked_until, null)
      assert.equal(first.stamp_event_id, null)

      const [ledger] = await tx`select * from public.venue_code_attempt_lockouts
                              where membership_id = ${fixture.membershipId}::uuid`
      assert.equal(
        ledger.failed_count,
        1,
        "the ledger committed with the returned status"
      )

      const [{ n: rejected }] = await tx`
      select count(*)::int as n from public.product_events
      where membership_id = ${fixture.membershipId}::uuid
        and event_name = 'venue_code_rejected'`
      assert.equal(rejected, 1)
      assert.equal(
        await earnedCount(tx, fixture.membershipId),
        1,
        "no stamp landed"
      )
      assert.equal((await receipts(tx, fixture.membershipId)).length, 0)
    })
  }
)

test(
  "five wrong codes lock the membership out; the attempt charge then refuses with NBC01",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      await refuseFarScan(tx, fixture)
      const code = await todaysCode(tx, venue.merchant_id)

      let last
      for (let attempt = 0; attempt < 5; attempt += 1) {
        last = await enterCode(tx, venue, fixture, wrongCode(code))
      }
      assert.equal(last.status, "locked_out")
      assert.equal(last.attempts_remaining, 0)
      assert.ok(last.locked_until, "locked_until is set")

      assert.equal(await consumeSqlstate(tx, fixture), "NBC01")

      // Even the right code is withheld while locked.
      const locked = await enterCode(tx, venue, fixture, code)
      assert.equal(locked.status, "locked_out")
      assert.equal(await earnedCount(tx, fixture.membershipId), 1)
    })
  }
)

test(
  "the right code without a recent recorded refusal is NBS14 and leaves no receipt",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      const code = await todaysCode(tx, venue.merchant_id)

      assert.equal(await enterCodeSqlstate(tx, venue, fixture, code), "NBS14")
      assert.equal((await receipts(tx, fixture.membershipId)).length, 0)
      assert.equal(await earnedCount(tx, fixture.membershipId), 1)
    })
  }
)

test(
  "the right code after a recorded refusal issues a venue-code stamp with full evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      await refuseFarScan(tx, fixture)
      // A wrong try first, so the reset of the ledger is observable.
      const code = await todaysCode(tx, venue.merchant_id)
      await enterCode(tx, venue, fixture, wrongCode(code))

      const result = await enterCode(tx, venue, fixture, code)
      assert.equal(result.status, "issued")
      assert.equal(result.new_stamp_count, 2)
      assert.ok(result.stamp_event_id)

      const [stamp] = await tx`select metadata from public.stamp_events
                             where id = ${result.stamp_event_id}::uuid`
      assert.equal(stamp.metadata.source, "self_service_qr", "it is a visit")
      assert.equal(stamp.metadata.geo_verification, "venue_code")
      assert.equal(stamp.metadata.geo_flagged, false)
      assert.equal(stamp.metadata.presence_evidence.kind, "venue_code")
      assert.equal(
        stamp.metadata.presence_evidence.original_failure_reason,
        "location_out_of_range"
      )
      assert.equal(
        "latitude" in stamp.metadata,
        false,
        "no coordinates recorded"
      )

      const rows = await receipts(tx, fixture.membershipId)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].stamp_event_id, result.stamp_event_id)
      assert.equal(rows[0].original_failure_reason, "location_out_of_range")
      assert.ok(
        rows[0].refusal_flag_id,
        "the receipt names the refusal it answered"
      )

      const [flag] = await tx`select status, metadata from public.fraud_flags
                            where id = ${rows[0].refusal_flag_id}::uuid`
      assert.equal(flag.status, "reviewed")
      assert.equal(flag.metadata.reviewed_by, "venue_code")

      const [{ n: audits }] = await tx`
      select count(*)::int as n from public.audit_logs
      where target_id = ${result.stamp_event_id}::uuid
        and action = 'venue_code_stamp_issued'`
      assert.equal(audits, 1)

      const [{ n: ledgerRows }] = await tx`
      select count(*)::int as n from public.venue_code_attempt_lockouts
      where membership_id = ${fixture.membershipId}::uuid`
      assert.equal(ledgerRows, 0, "a right code clears the ledger")
    })
  }
)

test(
  "the daily limit, QR proof and code format still refuse; a refused stamp leaves no receipt",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      await refuseFarScan(tx, fixture)
      const code = await todaysCode(tx, venue.merchant_id)

      assert.equal(
        await enterCodeSqlstate(tx, venue, fixture, "12345"),
        "NBC02"
      )
      assert.equal(
        await enterCodeSqlstate(tx, venue, fixture, "abcdef"),
        "NBC02"
      )

      const bogusQr = await (async () => {
        try {
          await tx.savepoint(async (sp) => {
            await sp`select * from public.issue_venue_code_stamp(
            ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
            'not-a-real-qr', ${code}, null, 0)`
          })
          return null
        } catch (error) {
          return error.code ?? null
        }
      })()
      assert.equal(bogusQr, "NBS08")
      assert.equal((await receipts(tx, fixture.membershipId)).length, 0)

      // A GPS retry that won the race: the code then meets the daily limit.
      await tx`select * from public.issue_self_service_stamp(
      ${fixture.membershipId}::uuid, ${fixture.customerId}::uuid,
      ${venue.latitude}, ${venue.longitude}, 10, 'granted', 900)`
      assert.equal(await enterCodeSqlstate(tx, venue, fixture, code), "NBS01")
      assert.equal(
        (await receipts(tx, fixture.membershipId)).length,
        0,
        "no receipt survives a refusal"
      )
      assert.equal(await earnedCount(tx, fixture.membershipId), 2)
    })
  }
)

/**
 * Run `fn` with the request JWT claims of a given caller. The local test role
 * cannot `set session authorization`, so the grant itself is proved by
 * rpc-execute-privilege-containment; what this exercises is the function's
 * own auth.uid()/is_merchant_owner gate. Claims are restored afterwards.
 */
async function withJwtClaims(tx, { role, sub }, fn) {
  await tx`select set_config('request.jwt.claim.role', ${role}, true),
                  set_config('request.jwt.claim.sub', ${sub ?? ""}, true)`
  try {
    return await fn()
  } finally {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true),
                    set_config('request.jwt.claim.sub', '', true)`
  }
}

async function ownerRpc(tx, fn, merchantId, ownerUserId) {
  return withJwtClaims(
    tx,
    { role: "authenticated", sub: ownerUserId },
    async () => {
      const [row] = await tx.unsafe(
        `select * from public.${fn}('${merchantId}'::uuid)`
      )
      return row
    }
  )
}

async function deniedSqlstate(tx, fn, merchantId, claims) {
  try {
    await withJwtClaims(tx, claims, async () => {
      await tx.savepoint(async (sp) => {
        await sp.unsafe(`select * from public.${fn}('${merchantId}'::uuid)`)
      })
    })
    return null
  } catch (error) {
    return error.code ?? null
  }
}

test(
  "the owner reads and resets the code; a reset invalidates the old code at once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)
      assert.ok(venue.owner_user_id, "the seeded venue has an owner")
      const fixture = await joinAndBackdateFirstStamp(tx, venue)
      await refuseFarScan(tx, fixture)

      const before = await ownerRpc(
        tx,
        "get_venue_code_today",
        venue.merchant_id,
        venue.owner_user_id
      )
      assert.match(before.code, /^[0-9]{6}$/)
      assert.ok(before.rotates_at, "the owner is told when it changes")
      assert.equal(before.code, await todaysCode(tx, venue.merchant_id))

      const rotated = await ownerRpc(
        tx,
        "rotate_venue_code",
        venue.merchant_id,
        venue.owner_user_id
      )
      assert.notEqual(rotated.code, before.code, "a reset changes the code")

      const stale = await enterCode(tx, venue, fixture, before.code)
      assert.equal(
        stale.status,
        "code_rejected",
        "the old code stops working at once"
      )
      const fresh = await enterCode(tx, venue, fixture, rotated.code)
      assert.equal(fresh.status, "issued")

      const [audit] = await tx`select metadata from public.audit_logs
        where merchant_id = ${venue.merchant_id}::uuid and action = 'venue_code_reset'`
      assert.ok(audit, "the reset is audited")
      assert.equal(
        "code" in audit.metadata,
        false,
        "the audit never carries the code"
      )
    })
  }
)

test(
  "a non-owner and an anonymous caller cannot read or reset the code",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [venue] = await tx.unsafe(PICK)

      for (const claims of [
        { role: "authenticated", sub: randomUUID() },
        { role: "anon", sub: "" },
      ]) {
        for (const fn of ["get_venue_code_today", "rotate_venue_code"]) {
          assert.equal(
            await deniedSqlstate(tx, fn, venue.merchant_id, claims),
            "42501",
            `${claims.role} is refused by ${fn}`
          )
        }
      }
    })
  }
)
