import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const bucket = () => randomBytes(32).toString("hex")

async function seedBucket(tx, key, count) {
  await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
  values (${key}, ${count}, now() + interval '15 minutes')`
}

async function bucketCount(tx, key) {
  const [row] = await tx`select count from public.rate_limit_buckets
  where bucket_key = ${key}`
  return row?.count ?? null
}

test(
  "a phone admits five OTP guesses per identity, then refuses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phone = bucket()
      const identity = bucket()

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await tx`select public.admit_customer_otp_verify(${phone}, ${identity})`
      }

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) =>
              sp`select public.admit_customer_otp_verify(${phone}, ${identity})`
          ),
        /rate limit exceeded/i
      )
    })
  }
)

test(
  "a saturated phone refuses guesses from a fresh identity",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phone = bucket()
      await seedBucket(tx, phone, 5)

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) =>
              sp`select public.admit_customer_otp_verify(${phone}, ${bucket()})`
          ),
        /rate limit exceeded/i
      )
    })
  }
)

test("a refused guess rolls back the phone debit", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const phone = bucket()
    const identity = bucket()
    await seedBucket(tx, phone, 4)
    await seedBucket(tx, identity, 5)

    await assert.rejects(
      () =>
        tx.savepoint(
          (sp) =>
            sp`select public.admit_customer_otp_verify(${phone}, ${identity})`
        ),
      /rate limit exceeded/i
    )
    assert.equal(await bucketCount(tx, phone), 4)
  })
})

test("malformed buckets are refused before any debit", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await assert.rejects(
      () =>
        tx.savepoint(
          (sp) =>
            sp`select public.admit_customer_otp_verify('nope', ${bucket()})`
        ),
      /invalid customer otp verify admission input/i
    )
  })
})

test(
  "admit_customer_otp_verify is executable by the service role only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`select
      has_function_privilege('anon', 'public.admit_customer_otp_verify(text, text)', 'execute') as anon_can,
      has_function_privilege('authenticated', 'public.admit_customer_otp_verify(text, text)', 'execute') as authenticated_can,
      has_function_privilege('service_role', 'public.admit_customer_otp_verify(text, text)', 'execute') as service_can`
      assert.equal(row.anon_can, false)
      assert.equal(row.authenticated_can, false)
      assert.equal(row.service_can, true)
    })
  }
)
