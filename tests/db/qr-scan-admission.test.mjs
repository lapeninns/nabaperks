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
  values (${key}, ${count}, now() + interval '1 minute')`
}

async function bucketCount(tx, key) {
  const [row] = await tx`select count from public.rate_limit_buckets
  where bucket_key = ${key}`
  return row?.count ?? null
}

test(
  "a QR code admits sixty scans per identity, then refuses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const identity = bucket()
      const code = bucket()

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await tx`select public.admit_qr_scan(${identity}, ${code})`
      }

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.admit_qr_scan(${identity}, ${code})`
          ),
        /rate limit exceeded/i
      )
      assert.equal(await bucketCount(tx, code), 60)
    })
  }
)

test(
  "a refused scan rolls back the identity-wide debit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const identity = bucket()
      const code = bucket()
      await seedBucket(tx, identity, 119)
      await seedBucket(tx, code, 60)

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.admit_qr_scan(${identity}, ${code})`
          ),
        /rate limit exceeded/i
      )

      // Before the merge the app debited identity first, so a rejected scan
      // still cost the wider budget. One transaction gives it back.
      assert.equal(await bucketCount(tx, identity), 119)
    })
  }
)

test("a saturated identity refuses a fresh code", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const identity = bucket()
    await seedBucket(tx, identity, 120)

    await assert.rejects(
      () =>
        tx.savepoint(
          (sp) => sp`select public.admit_qr_scan(${identity}, ${bucket()})`
        ),
      /rate limit exceeded/i
    )
  })
})

test("malformed buckets are refused before any debit", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    for (const [identity, code] of [
      ["abc", bucket()],
      [bucket(), "not-a-hash"],
      [null, bucket()],
    ]) {
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`select public.admit_qr_scan(${identity}, ${code})`
          ),
        /invalid qr scan admission input/i
      )
    }
  })
})

test(
  "admit_qr_scan is executable by the service role only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`select
      has_function_privilege('anon', 'public.admit_qr_scan(text, text)', 'execute') as anon_can,
      has_function_privilege('authenticated', 'public.admit_qr_scan(text, text)', 'execute') as authenticated_can,
      has_function_privilege('service_role', 'public.admit_qr_scan(text, text)', 'execute') as service_can`
      assert.equal(row.anon_can, false)
      assert.equal(row.authenticated_can, false)
      assert.equal(row.service_can, true)
    })
  }
)
