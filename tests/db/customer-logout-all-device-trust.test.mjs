import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * "Log out on all devices" and device trust — live-DB tier (QA BUG-011,
 * 38c42a1..2c45031).
 *
 * The remedy for a lost or shared phone must also withdraw every device's
 * sign-in trust, so a device the owner logged out is not "recognised" on its
 * next sign-in. A fresh verified sign-in re-establishes trust as normal.
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

test(
  "log out on all devices: withdraws every device's sign-in trust, and a fresh sign-in restores it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await insertCustomer(tx)
      const other = await insertCustomer(tx)
      const phone = deviceHash()
      const laptop = deviceHash()
      const otherDevice = deviceHash()

      await register(tx, customer.id, randomUUID(), phone, "verified_email")
      await register(tx, customer.id, randomUUID(), laptop, "verified_phone")
      await register(tx, other.id, randomUUID(), otherDevice, "verified_email")

      const isTrusted = async (customerId, device) => {
        const [{ customer_auth_device_is_trusted: trusted }] = await tx`
          select public.customer_auth_device_is_trusted(
            ${customerId}::uuid, ${device}
          )`
        return trusted
      }
      assert.equal(await isTrusted(customer.id, phone), true, "precondition")

      await tx`select public.revoke_all_customer_sessions(${customer.id}::uuid)`

      const [{ unrevoked }] = await tx`
        select count(*)::int as unrevoked
        from public.customer_otp_trusted_devices
        where customer_id = ${customer.id}::uuid and revoked_at is null`
      assert.equal(unrevoked, 0, "no trusted-device row survives log-out-all")
      assert.equal(
        await isTrusted(customer.id, phone),
        false,
        "the logged-out device is no longer recognised"
      )
      assert.equal(
        await isTrusted(other.id, otherDevice),
        true,
        "another customer's device trust is untouched"
      )

      // A verified sign-in on the same device re-establishes trust normally.
      await register(tx, customer.id, randomUUID(), phone, "verified_email")
      assert.equal(
        await isTrusted(customer.id, phone),
        true,
        "a fresh verified sign-in restores that device's trust"
      )
    })
  }
)
