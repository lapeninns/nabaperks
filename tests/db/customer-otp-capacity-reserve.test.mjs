import { randomBytes, randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const hash = () => randomBytes(32).toString("hex")

test(
  "verified OTP and active-session devices receive scoped trust",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phoneHmac = hash()
      const verifiedDevice = hash()
      const activeSessionDevice = hash()
      const strangerDevice = hash()
      const [customer] = await tx`
      insert into public.customers (
        email, email_verified_at, phone_hmac, phone_last4, phone_country,
        created_at, updated_at
      ) values (
        ${`otp-reserve-${randomUUID()}@test.local`}, now(), ${phoneHmac},
        '0123', 'GB', now() - interval '8 days', now()
      ) returning id`

      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      assert.ok(merchant, "a seeded merchant is available")
      await tx`insert into public.customer_memberships (merchant_id, customer_id)
      values (${merchant.id}::uuid, ${customer.id}::uuid)`

      await tx`select public.register_customer_session(
      ${customer.id}::uuid,
      ${randomUUID()}::uuid,
      now() + interval '30 days',
      ${verifiedDevice}
    )`
      await tx`update public.customer_otp_trusted_devices
      set trusted_at = now() - interval '8 days'
      where customer_id = ${customer.id}::uuid
        and device_hash = ${verifiedDevice}`

      const [{ customer_otp_device_is_trusted: verified }] = await tx`
      select public.customer_otp_device_is_trusted(${phoneHmac}, ${verifiedDevice})`
      const [{ customer_otp_device_is_trusted: stranger }] = await tx`
      select public.customer_otp_device_is_trusted(${phoneHmac}, ${strangerDevice})`
      assert.equal(verified, true)
      assert.equal(stranger, false)

      const sessionId = randomUUID()
      await tx`select public.register_customer_session(
      ${customer.id}::uuid,
      ${sessionId}::uuid,
      now() + interval '30 days'
    )`
      const [{ touch_customer_session: active }] = await tx`
      select public.touch_customer_session(
        ${customer.id}::uuid, ${sessionId}::uuid, ${activeSessionDevice}
      )`
      assert.equal(active, true)

      await tx`update public.customer_otp_trusted_devices
      set trusted_at = now() - interval '8 days'
      where customer_id = ${customer.id}::uuid
        and device_hash = ${activeSessionDevice}`

      const [{ customer_otp_device_is_trusted: bootstrapped }] = await tx`
      select public.customer_otp_device_is_trusted(
        ${phoneHmac}, ${activeSessionDevice}
      )`
      assert.equal(bootstrapped, true)
    })
  }
)

test(
  "anonymous saturation preserves a bounded established-customer reserve",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phoneHmac = hash()
      const deviceHash = hash()
      const [customer] = await tx`
      insert into public.customers (
        email, email_verified_at, phone_hmac, phone_last4, phone_country,
        created_at, updated_at
      ) values (
        ${`otp-admission-${randomUUID()}@test.local`}, now(), ${phoneHmac},
        '0789', 'GB', now() - interval '8 days', now()
      ) returning id`
      const [merchant] =
        await tx`select id from public.merchants order by created_at limit 1`
      await tx`insert into public.customer_memberships (merchant_id, customer_id)
      values (${merchant.id}::uuid, ${customer.id}::uuid)`
      await tx`select public.register_customer_session(
      ${customer.id}::uuid,
      ${randomUUID()}::uuid,
      now() + interval '30 days',
      ${deviceHash}
    )`
      await tx`update public.customer_otp_trusted_devices
      set trusted_at = now() - interval '8 days'
      where customer_id = ${customer.id}::uuid`
      const recognisedPhoneBucket = hash()

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await tx`select public.admit_customer_otp_dispatch(
        'wallet', ${hash()}, ${hash()}, ${hash()}, ${hash()}, ${hash()}
      )`
      }

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.admit_customer_otp_dispatch(
          'wallet', ${hash()}, ${hash()}, ${hash()}, ${hash()}, ${hash()}
        )`
          ),
        /rate limit exceeded/i
      )

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const [{ admit_customer_otp_dispatch: recognised }] = await tx`
        select public.admit_customer_otp_dispatch(
          'wallet', ${recognisedPhoneBucket}, ${hash()}, ${hash()}, ${phoneHmac}, ${deviceHash}
        )`
        assert.equal(recognised, true)
      }

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.admit_customer_otp_dispatch(
          'wallet', ${recognisedPhoneBucket}, ${hash()}, ${hash()}, ${phoneHmac}, ${deviceHash}
        )`
          ),
        /rate limit exceeded/i,
        "one recognised phone cannot monopolise the reserve"
      )
    })
  }
)

test(
  "invalid, expired, and erased device trust fails closed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phoneHmac = hash()
      const deviceHash = hash()
      const [customer] = await tx`
      insert into public.customers (
        email, email_verified_at, phone_hmac, phone_last4, phone_country,
        created_at, updated_at
      ) values (
        ${`otp-expiry-${randomUUID()}@test.local`}, now(), ${phoneHmac},
        '0456', 'GB', now(), now()
      ) returning id`

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.register_customer_session(
          ${customer.id}::uuid,
          ${randomUUID()}::uuid,
          now() + interval '30 days',
          ${"not-a-device-hash"}
        )`
          ),
        /invalid customer session/i
      )

      await tx`select public.register_customer_session(
      ${customer.id}::uuid,
      ${randomUUID()}::uuid,
      now() + interval '30 days',
      ${deviceHash}
    )`
      await tx`update public.customer_otp_trusted_devices
      set trusted_at = now() - interval '91 days',
          trusted_until = now() - interval '1 day'
      where customer_id = ${customer.id}::uuid`
      const [{ customer_otp_device_is_trusted: expired }] = await tx`
      select public.customer_otp_device_is_trusted(${phoneHmac}, ${deviceHash})`
      assert.equal(expired, false)

      await tx`update public.customer_otp_trusted_devices
      set trusted_until = now() + interval '90 days'
      where customer_id = ${customer.id}::uuid`
      await tx`select set_config('app.customer_erasure', 'true', true)`
      await tx`update public.customers
      set phone_hmac = null, phone_ciphertext = null, phone_last4 = null,
          phone_country = null, phone_verified_at = null
      where id = ${customer.id}::uuid`
      const [{ rows }] = await tx`
      select count(*)::int as rows
      from public.customer_otp_trusted_devices
      where customer_id = ${customer.id}::uuid`
      assert.equal(rows, 0)
    })
  }
)
