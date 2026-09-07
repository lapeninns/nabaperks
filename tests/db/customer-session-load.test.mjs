import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * touch_customer_session_and_load — live-DB tier.
 *
 * One hop replaces "touch, then select the customer". It must behave exactly
 * like touch_customer_session for validity (it calls it), and must never
 * return identity columns for a session that is not active.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const deviceHash = () => randomBytes(32).toString("hex")
const PII_COLUMNS = [
  "id",
  "auth_user_id",
  "email",
  "email_verified_at",
  "full_name",
  "date_of_birth",
  "date_of_birth_verified_at",
  "phone_last4",
  "phone_country",
  "created_at",
]

after(async () => {
  await closeDb()
})

async function mintSession(tx, device) {
  const [customer] = await tx`
    insert into public.customers (
      email, email_verified_at, phone_last4, phone_country, created_at, updated_at
    )
    values (
      ${`load-${randomUUID()}@test.local`}, now(), '0123', 'GB', now(), now()
    )
    returning id`
  const sessionId = randomUUID()
  await tx`select public.register_customer_session(
    ${customer.id}::uuid, ${sessionId}::uuid, now() + interval '30 days',
    ${device}, 'new_identity')`
  return { customerId: customer.id, sessionId }
}

async function load(tx, customerId, sessionId, device) {
  const rows = await tx`select * from public.touch_customer_session_and_load(
    ${customerId}::uuid, ${sessionId}::uuid, ${device})`
  assert.equal(rows.length, 1, "exactly one row")
  return rows[0]
}

function assertNoPii(row) {
  for (const column of PII_COLUMNS) {
    assert.equal(row[column], null, `${column} must be null when not active`)
  }
}

test(
  "session load: an active session returns the masked customer row and touches once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const device = deviceHash()
      const { customerId, sessionId } = await mintSession(tx, device)
      await tx`update public.customer_sessions
      set last_seen_at = now() - interval '1 day' where id = ${sessionId}`
      await tx`update public.customer_otp_trusted_devices
      set trusted_until = now() + interval '1 day'
      where customer_id = ${customerId}::uuid and device_hash = ${device}`
      const [before] = await tx`select expires_at from public.customer_sessions
      where id = ${sessionId}`

      const row = await load(tx, customerId, sessionId, device)
      assert.equal(row.status, "active")
      assert.equal(row.id, customerId)
      assert.match(row.email, /@test\.local$/)
      assert.equal(row.phone_last4, "0123")
      assert.equal(row.phone_country, "GB")
      assert.equal(row.date_of_birth, null)
      assert.notEqual(row.created_at, null)

      const [afterTouch] = await tx`
      select expires_at, last_seen_at from public.customer_sessions
      where id = ${sessionId}`
      assert.ok(
        new Date(afterTouch.last_seen_at).getTime() > Date.now() - 60_000,
        "last_seen_at advanced"
      )
      assert.equal(
        new Date(afterTouch.expires_at).getTime(),
        new Date(before.expires_at).getTime(),
        "expiry is never slid"
      )
      const [trust] = await tx`select trusted_until
      from public.customer_otp_trusted_devices
      where customer_id = ${customerId}::uuid and device_hash = ${device}`
      assert.ok(
        new Date(trust.trusted_until).getTime() >
          Date.now() + 89 * 24 * 60 * 60 * 1000,
        "the trusted-device slide still happens, through the delegated touch"
      )
    })
  }
)

test(
  "session load: revoked, expired, wrong-device and malformed calls are inactive with no identity leak",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const device = deviceHash()
      const { customerId, sessionId } = await mintSession(tx, device)

      const wrongDevice = await load(tx, customerId, sessionId, deviceHash())
      assert.equal(wrongDevice.status, "inactive")
      assertNoPii(wrongDevice)

      const malformed = await load(tx, customerId, sessionId, "abc")
      assert.equal(malformed.status, "inactive")
      assertNoPii(malformed)

      const nullIds =
        await tx`select * from public.touch_customer_session_and_load(
      null, null, ${device})`
      assert.equal(nullIds[0].status, "inactive")
      assertNoPii(nullIds[0])

      await tx`update public.customer_sessions
      set expires_at = now() - interval '1 minute' where id = ${sessionId}`
      const expired = await load(tx, customerId, sessionId, device)
      assert.equal(expired.status, "inactive")
      assertNoPii(expired)

      await tx`update public.customer_sessions
      set expires_at = now() + interval '30 days' where id = ${sessionId}`
      await tx`select public.revoke_customer_session(${customerId}::uuid, ${sessionId}::uuid)`
      const revoked = await load(tx, customerId, sessionId, device)
      assert.equal(revoked.status, "inactive")
      assertNoPii(revoked)
    })
  }
)

test("session load: service role only", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [row] = await tx`select
      has_function_privilege('public', 'public.touch_customer_session_and_load(uuid,uuid,text)', 'execute') as public_can,
      has_function_privilege('anon', 'public.touch_customer_session_and_load(uuid,uuid,text)', 'execute') as anon_can,
      has_function_privilege('authenticated', 'public.touch_customer_session_and_load(uuid,uuid,text)', 'execute') as authenticated_can,
      has_function_privilege('service_role', 'public.touch_customer_session_and_load(uuid,uuid,text)', 'execute') as service_can`
    assert.equal(row.public_can, false)
    assert.equal(row.anon_can, false)
    assert.equal(row.authenticated_can, false)
    assert.equal(row.service_can, true)

    const device = deviceHash()
    const { customerId, sessionId } = await mintSession(tx, device)
    await assert.rejects(
      () =>
        tx.savepoint(async (sp) => {
          await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
          await sp`select * from public.touch_customer_session_and_load(
            ${customerId}::uuid, ${sessionId}::uuid, ${device})`
        }),
      /service role required/i
    )
  })
})
