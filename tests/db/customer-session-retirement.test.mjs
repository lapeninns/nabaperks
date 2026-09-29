import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Session retirement — live-DB tier (QA BUG-010, 38c42a1..2c45031).
 *
 * Sessions last until the customer logs out, so nothing else ends them. A new
 * sign-in on a device therefore retires that device's earlier sessions for the
 * same customer, so a session the browser can no longer present does not stay
 * a live credential. Other devices keep theirs, and nothing expires by idling.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const deviceHash = () => randomBytes(32).toString("hex")

after(async () => {
  await closeDb()
})

async function insertCustomer(tx) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`retire-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  return customer
}

async function register(tx, customerId, sessionId, device, source) {
  await tx`select public.register_customer_session(
    ${customerId}::uuid, ${sessionId}::uuid, 'infinity', ${device}, ${source})`
}

async function touch(tx, customerId, sessionId, device) {
  const [{ touch_customer_session: active }] = await tx`
    select public.touch_customer_session(
      ${customerId}::uuid, ${sessionId}::uuid, ${device}
    )`
  return active
}

test(
  "session retirement: signing in again on a device retires only that device's earlier session",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await insertCustomer(tx)
      const other = await insertCustomer(tx)
      const phone = deviceHash()
      const laptop = deviceHash()
      const first = randomUUID()
      const second = randomUUID()
      const laptopSession = randomUUID()
      const otherSession = randomUUID()

      await register(tx, customer.id, first, phone, "verified_email")
      await register(tx, customer.id, laptopSession, laptop, "verified_phone")
      // Another customer on the same browser is a different wallet: untouched.
      await register(tx, other.id, otherSession, phone, "verified_email")

      // The same device signs in again, e.g. after its cookies were cleared.
      await register(tx, customer.id, second, phone, "verified_phone")

      const rows = await tx`
        select id, revoked_at is null as active
        from public.customer_sessions
        where customer_id = ${customer.id}::uuid and device_hash = ${phone}`
      assert.equal(rows.length, 2)
      assert.deepEqual(
        rows.filter((row) => row.active).map((row) => row.id),
        [second],
        "one active session per customer and device: the new one"
      )

      assert.equal(
        await touch(tx, customer.id, first, phone),
        false,
        "the superseded session no longer opens the wallet"
      )
      assert.equal(
        await touch(tx, customer.id, second, phone),
        true,
        "the session in the browser's new cookie keeps working"
      )
      assert.equal(
        await touch(tx, customer.id, laptopSession, laptop),
        true,
        "a second device keeps its session"
      )
      assert.equal(
        await touch(tx, other.id, otherSession, phone),
        true,
        "another customer's session on the same device is untouched"
      )

      // The new session is still open-ended: no idle bound was added.
      const [{ expires_at_infinite: stillOpen }] = await tx`
        select expires_at = 'infinity'::timestamptz as expires_at_infinite
        from public.customer_sessions where id = ${second}::uuid`
      assert.equal(stillOpen, true, "sessions still last until log-out")
    })
  }
)

test(
  "session retirement: an idle session is not expired by age alone",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await insertCustomer(tx)
      const device = deviceHash()
      const sessionId = randomUUID()
      await register(tx, customer.id, sessionId, device, "verified_email")
      await tx`
        update public.customer_sessions
        set created_at = now() - interval '800 days',
            last_seen_at = now() - interval '800 days'
        where id = ${sessionId}::uuid`

      assert.equal(
        await touch(tx, customer.id, sessionId, device),
        true,
        "no idle expiry: a session lasts until the customer logs out"
      )
    })
  }
)
