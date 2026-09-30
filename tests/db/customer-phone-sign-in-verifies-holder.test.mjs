import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * A wallet that holds a phone without phone_verified_at (a legacy row, or an
 * attach that stopped half way) is the wallet phone sign-in and join open for
 * that number: whoever proves the number gets the wallet that holds it. The
 * sign-in has just proven possession, so `verify_customer_phone_on_sign_in`
 * marks that wallet's phone verified with a `customer_phone_verified` audit
 * row, under the customer row lock (QA BUG-031).
 *
 * Another wallet proving the same number is still told it belongs to another
 * wallet (`contact_conflict`), and an erased row is never verified.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

async function unverifiedHolder(tx, { erased = false } = {}) {
  const id = randomUUID()
  const email = erased
    ? `erased+${id.replaceAll("-", "")}@privacy.invalid`
    : `holder-${id}@example.test`
  const phoneHmac = hex64()
  await tx`
    insert into public.customers (
      id, email, email_hmac, email_verified_at,
      phone_hmac, phone_ciphertext, phone_last4, phone_country, phone_verified_at
    ) values (
      ${id}::uuid, ${email}, ${erased ? null : hex64()}, ${erased ? null : new Date()},
      ${phoneHmac}, ${`v1.${randomUUID()}`}, '0149', 'GB', null
    )`
  return { id, phoneHmac }
}

async function verify(tx, customerId, phoneHmac, surface = "home_login") {
  const [row] = await tx`
    select public.verify_customer_phone_on_sign_in(
      ${customerId}::uuid, ${phoneHmac}, ${surface}
    ) as status`
  return row.status
}

async function read(tx, customerId) {
  const [row] = await tx`
    select phone_verified_at is not null as verified, phone_hmac
    from public.customers where id = ${customerId}::uuid`
  const audits = await tx`
    select action, actor_type, metadata from public.audit_logs
    where customer_id = ${customerId}::uuid
      and action in ('customer_phone_verified', 'customer_phone_attached')`
  return { ...row, audits: audits.map((audit) => ({ ...audit })) }
}

test(
  "Given a live wallet holds a phone unverified When phone sign-in proves it Then the phone is verified once, with one audit row",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const holder = await unverifiedHolder(tx)

      assert.equal(await verify(tx, holder.id, holder.phoneHmac), "verified")
      assert.equal(
        await verify(tx, holder.id, holder.phoneHmac),
        "already_verified"
      )

      assert.deepEqual(await read(tx, holder.id), {
        verified: true,
        phone_hmac: holder.phoneHmac,
        audits: [
          {
            action: "customer_phone_verified",
            actor_type: "customer",
            metadata: { surface: "home_login", reason: "phone_sign_in" },
          },
        ],
      })
    })
  }
)

test(
  "Given a wallet holds a phone unverified or verified When another wallet proves that phone Then the attach is a contact conflict",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const holder = await unverifiedHolder(tx)
      const [other] = await tx`
        insert into public.customers (email, email_hmac, email_verified_at)
        values (${`other-${randomUUID()}@example.test`}, ${hex64()}, now())
        returning id::text as id`
      const attach = async () => {
        const [row] = await tx`
          select public.attach_verified_customer_phone(
            ${other.id}::uuid, ${holder.phoneHmac}, ${`v1.${randomUUID()}`},
            '0149', 'GB', 'profile'
          ) as status`
        return row.status
      }

      assert.equal(await attach(), "contact_conflict")
      assert.equal(await verify(tx, holder.id, holder.phoneHmac), "verified")
      assert.equal(await attach(), "contact_conflict")

      const [otherRow] = await tx`
        select phone_hmac from public.customers where id = ${other.id}::uuid`
      assert.equal(otherRow.phone_hmac, null)
    })
  }
)

test(
  "Given an erased row or a changed phone When sign-in verification runs Then nothing is verified or audited",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const erased = await unverifiedHolder(tx, { erased: true })
      assert.equal(
        await verify(tx, erased.id, erased.phoneHmac),
        "wallet_unavailable"
      )
      assert.deepEqual(await read(tx, erased.id), {
        verified: false,
        phone_hmac: erased.phoneHmac,
        audits: [],
      })

      const holder = await unverifiedHolder(tx)
      assert.equal(await verify(tx, holder.id, hex64()), "phone_changed")
      assert.equal(
        await verify(tx, randomUUID(), hex64()),
        "wallet_unavailable"
      )
      assert.deepEqual(await read(tx, holder.id), {
        verified: false,
        phone_hmac: holder.phoneHmac,
        audits: [],
      })
    })
  }
)

test(
  "Given a caller that is not the service role or an unknown surface When sign-in verification runs Then it is refused",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const holder = await unverifiedHolder(tx)
      await assert.rejects(
        verify(tx, holder.id, holder.phoneHmac, "admin"),
        /Unsupported contact surface/
      )
    })
    await inRolledBackTxn(async (tx) => {
      const holder = await unverifiedHolder(tx)
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await assert.rejects(
        verify(tx, holder.id, holder.phoneHmac),
        /requires the service role/
      )
    })
    await inRolledBackTxn(async (tx) => {
      const [grants] = await tx`
        select has_function_privilege('anon', p.oid, 'execute') as anon_exec,
               has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
               has_function_privilege('service_role', p.oid, 'execute') as service_exec
        from pg_proc p
        where p.oid = 'public.verify_customer_phone_on_sign_in(uuid, text, text)'::regprocedure`
      assert.deepEqual(
        { ...grants },
        { anon_exec: false, auth_exec: false, service_exec: true }
      )
    })
  }
)
