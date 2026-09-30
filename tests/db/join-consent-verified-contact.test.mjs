import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

// QA BUG-033 and BUG-034 (38c42a1..2c45031): a join with marketing opt-in
// records consent only for contacts the wallet has verified. A staged or
// legacy phone (phone_hmac without phone_verified_at) gets no SMS or WhatsApp
// row, and a saved but unconfirmed email gets no email row.

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

const POLICY = "2026-09-28.1"

const hex64 = () => randomUUID().replaceAll("-", "").padEnd(64, "0")

async function joinFixture(tx) {
  const [fixture] = await tx`
    select qr.qr_id, merchants.business_slug
    from public.qr_codes qr
    join public.merchants merchants on merchants.id = qr.merchant_id
    where qr.is_active and qr.destination_type = 'join'
    order by qr.created_at limit 1`
  assert.ok(fixture)
  return fixture
}

async function walletWith(tx, { email, emailVerified, phone, phoneVerified }) {
  const address = email ? `join-consent-${randomUUID()}@test.local` : null
  const [customer] = await tx`
    insert into public.customers (
      email, email_hmac, email_verified_at,
      phone_hmac, phone_last4, phone_verified_at,
      created_at, updated_at
    )
    values (
      ${address},
      ${address ? hex64() : null},
      ${emailVerified ? tx`now()` : null},
      ${phone ? hex64() : null},
      ${phone ? "0123" : null},
      ${phoneVerified ? tx`now()` : null},
      now(), now()
    )
    returning id`
  return customer.id
}

async function joinedChannels(tx, fixture, customerId, optIn) {
  await tx`
    select * from public.join_customer_membership(
      ${customerId}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
      ${optIn}, ${POLICY})`
  const rows = await tx`
    select channel || ':' || consent_status as entry
    from public.consent_records
    where customer_id = ${customerId}::uuid and source = 'customer_join'
    order by channel`
  return rows.map((row) => row.entry)
}

test(
  "Given a verified email and a phone that was never verified When the wallet joins with marketing opt-in Then only the email channel is recorded",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinFixture(tx)
      const customerId = await walletWith(tx, {
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: false,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, customerId, true), [
        "email:opted_in",
      ])
    })
  }
)

test(
  "Given a verified phone and an unconfirmed email When the wallet joins with marketing opt-in Then only SMS and WhatsApp are recorded",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinFixture(tx)
      const customerId = await walletWith(tx, {
        email: true,
        emailVerified: false,
        phone: true,
        phoneVerified: true,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, customerId, true), [
        "sms:opted_in",
        "whatsapp:opted_in",
      ])
    })
  }
)

test(
  "Given wallets whose contacts are verified When they join Then opt-in records every verified channel and opt-out records none",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinFixture(tx)
      const both = await walletWith(tx, {
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, both, true), [
        "email:opted_in",
        "sms:opted_in",
        "whatsapp:opted_in",
      ])

      const phoneOnly = await walletWith(tx, {
        email: false,
        phone: true,
        phoneVerified: true,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, phoneOnly, true), [
        "sms:opted_in",
        "whatsapp:opted_in",
      ])

      const emailOnly = await walletWith(tx, {
        email: true,
        emailVerified: true,
        phone: false,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, emailOnly, true), [
        "email:opted_in",
      ])

      const declined = await walletWith(tx, {
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: false,
      })
      assert.deepEqual(await joinedChannels(tx, fixture, declined, false), [])
    })
  }
)
