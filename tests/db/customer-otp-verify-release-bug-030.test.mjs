import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * QA BUG-030 (38c42a1..2c45031): only a rejected OTP code counts towards the
 * verify limit. admit_customer_otp_verify still reserves one attempt on the
 * phone and identity buckets before the provider check (and refuses once
 * either holds 5); release_customer_otp_verify gives that reservation back
 * when the provider approves the code.
 */
const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const bucket = () => randomBytes(32).toString("hex")

async function bucketCount(tx, key) {
  const [row] = await tx`select count from public.rate_limit_buckets
  where bucket_key = ${key}`
  return row?.count ?? null
}

const admit = (tx, phone, identity) =>
  tx`select public.admit_customer_otp_verify(${phone}, ${identity})`
const release = (tx, phone, identity) =>
  tx`select public.release_customer_otp_verify(${phone}, ${identity})`

test(
  "six approved codes in a row are all admitted when each is released",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phone = bucket()
      const identity = bucket()

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await admit(tx, phone, identity)
        await release(tx, phone, identity)
      }

      assert.equal(await bucketCount(tx, phone), 0)
      assert.equal(await bucketCount(tx, identity), 0)
    })
  }
)

test(
  "five rejected codes still exhaust the phone after approved ones",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const phone = bucket()

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const identity = bucket()
        await admit(tx, phone, identity)
        await release(tx, phone, identity)
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await admit(tx, phone, bucket())
      }

      assert.equal(await bucketCount(tx, phone), 5)
      await assert.rejects(
        () => tx.savepoint((sp) => admit(sp, phone, bucket())),
        /rate limit exceeded/i
      )
    })
  }
)

test(
  "a release credits only live windows and never goes below zero",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const expired = bucket()
      const empty = bucket()
      await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
      values (${expired}, 5, now() - interval '1 second'),
             (${empty}, 0, now() + interval '15 minutes')`

      await release(tx, expired, empty)
      // A bucket that does not exist yet is left alone too.
      await release(tx, bucket(), bucket())

      assert.equal(await bucketCount(tx, expired), 5)
      assert.equal(await bucketCount(tx, empty), 0)
    })
  }
)

test("malformed buckets are refused by the release", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await assert.rejects(
      () => tx.savepoint((sp) => release(sp, "nope", bucket())),
      /invalid customer otp verify admission input/i
    )
  })
})

test(
  "release_customer_otp_verify is executable by the service role only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`select
      has_function_privilege('anon', 'public.release_customer_otp_verify(text, text)', 'execute') as anon_can,
      has_function_privilege('authenticated', 'public.release_customer_otp_verify(text, text)', 'execute') as authenticated_can,
      has_function_privilege('service_role', 'public.release_customer_otp_verify(text, text)', 'execute') as service_can`
      assert.equal(row.anon_can, false)
      assert.equal(row.authenticated_can, false)
      assert.equal(row.service_can, true)
    })
  }
)
