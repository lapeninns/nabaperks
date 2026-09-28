import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import { closeDb, db, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

/**
 * Signed-out email sign-in code admission (20261006100100).
 *
 * Proves the six hashed buckets carry their stated limits and windows, that a
 * refusal by any one bucket leaves every other bucket untouched, that raw or
 * repeated keys are refused before any debit, that only the service role can
 * call it, and that concurrent requests for one recipient admit exactly one.
 */

const SIGNATURE =
  "public.admit_anonymous_customer_email_otp_send(text,text,text,text,text,text)"
const ready = await (async () => {
  try {
    const [row] =
      await db()`select to_regprocedure(${SIGNATURE}) is not null as ready`
    return row.ready
  } catch {
    return false
  }
})()
const skip = ready ? false : "local anonymous email admission RPC unavailable"
after(closeDb)

// Argument order: device, IP, recipient, cooldown, global minute, global hour.
const BUCKETS = [
  { name: "device", limit: 6, windowMs: 900_000 },
  { name: "ip", limit: 60, windowMs: 3_600_000 },
  { name: "recipient", limit: 3, windowMs: 900_000 },
  { name: "cooldown", limit: 1, windowMs: 60_000 },
  { name: "global minute", limit: 30, windowMs: 60_000 },
  { name: "global hour", limit: 150, windowMs: 3_600_000 },
]

const key = () => randomBytes(32).toString("hex")
const keys = () => BUCKETS.map(() => key())
const call = (sql, buckets) =>
  sql`select public.admit_anonymous_customer_email_otp_send(
    ${buckets[0]}, ${buckets[1]}, ${buckets[2]},
    ${buckets[3]}, ${buckets[4]}, ${buckets[5]})`

function withFresh(buckets, index) {
  return buckets.map((value, position) => (position === index ? value : key()))
}

async function counts(sql, buckets) {
  const rows = await sql`select bucket_key, count from public.rate_limit_buckets
              where bucket_key = any(${buckets}::text[])`
  return new Map(rows.map((row) => [row.bucket_key, row.count]))
}

for (const [index, bucket] of BUCKETS.entries()) {
  test(
    `${bucket.name} bucket admits ${bucket.limit} per window and refuses the next`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const buckets = keys()
        await call(tx, buckets)
        const [window] = await tx`
          select extract(epoch from reset_at - clock_timestamp()) * 1000 as ms
          from public.rate_limit_buckets where bucket_key = ${buckets[index]}`
        assert.ok(
          window.ms > bucket.windowMs - 10_000 && window.ms <= bucket.windowMs,
          `${bucket.name} window is ${bucket.windowMs} ms (found ${window.ms})`
        )

        // Fill to the limit, then one more request sharing only this key.
        await tx`update public.rate_limit_buckets set count = ${bucket.limit}
                 where bucket_key = ${buckets[index]}`
        const blocked = withFresh(buckets, index)
        await assert.rejects(
          tx.savepoint((sp) => call(sp, blocked)),
          /rate limit exceeded/i
        )
        await tx`update public.rate_limit_buckets set count = ${bucket.limit - 1}
                 where bucket_key = ${buckets[index]}`
        await call(tx, withFresh(buckets, index))
      })
    }
  )

  test(
    `${bucket.name} refusal rolls back every other bucket`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const buckets = keys()
        await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
                 values (${buckets[index]}, ${bucket.limit}, now() + interval '1 day')`
        for (let attempt = 0; attempt < 3; attempt++) {
          await assert.rejects(
            tx.savepoint((sp) => call(sp, buckets)),
            /rate limit exceeded/i
          )
        }
        const debited = await counts(tx, buckets)
        assert.deepEqual(
          [...debited.entries()],
          [[buckets[index], bucket.limit]]
        )
      })
    }
  )
}

test(
  "an admitted request debits all six buckets exactly once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const buckets = keys()
      await call(tx, buckets)
      const debited = await counts(tx, buckets)
      assert.equal(debited.size, 6)
      assert.ok([...debited.values()].every((count) => count === 1))
    })
  }
)

test(
  "raw, malformed and repeated keys are refused without a debit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const valid = keys()
      const invalid = [
        [null, ...valid.slice(1)],
        [valid[0], "203.0.113.7", ...valid.slice(2)],
        [valid[0], valid[1], "guest@example.test", ...valid.slice(3)],
        [...valid.slice(0, 5), valid[5].toUpperCase()],
        [...valid.slice(0, 5), valid[5].slice(1)],
        [valid[0], valid[1], valid[2], valid[2], valid[4], valid[5]],
        [valid[0], valid[1], valid[2], valid[3], valid[4], valid[0]],
      ]
      for (const buckets of invalid) {
        await assert.rejects(
          tx.savepoint((sp) => call(sp, buckets)),
          /invalid anonymous customer email otp admission input/i
        )
      }
      const debited = await counts(tx, valid)
      assert.equal(debited.size, 0)
    })
  }
)

test(
  "only the service role can execute anonymous email admission",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      for (const role of ["anon", "authenticated"]) {
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp.unsafe(`set local role ${role}`)
            await call(sp, keys())
          }),
          /permission denied/i
        )
      }
      await tx`set local role service_role`
      await call(tx, keys())
    })
  }
)

test(
  "concurrent requests for one recipient admit exactly one",
  { skip },
  async () => {
    const sql = postgres(dbUrl(), { max: 8, idle_timeout: 2 })
    const shared = keys()
    // Every request shares the recipient and cooldown keys; the others are
    // fresh per request, as they would be from different devices.
    const requests = Array.from({ length: 6 }, () =>
      shared.map((value, index) => (index === 2 || index === 3 ? value : key()))
    )
    const owned = [...new Set(requests.flat())]
    try {
      const results = await Promise.allSettled(
        requests.map((buckets) =>
          sql.begin(async (tx) => {
            await tx`set local statement_timeout = '5s'`
            await call(tx, buckets)
            await tx`select pg_sleep(0.15)`
          })
        )
      )
      const admitted = results.filter((result) => result.status === "fulfilled")
      assert.equal(admitted.length, 1)
      for (const result of results.filter((r) => r.status === "rejected")) {
        assert.match(result.reason.message, /rate limit exceeded/i)
      }
      const rows = await counts(sql, owned)
      // One winner: its six buckets hold 1; losers left nothing behind.
      assert.equal(rows.size, 6)
      assert.ok([...rows.values()].every((count) => count === 1))
    } finally {
      await sql`delete from public.rate_limit_buckets where bucket_key = any(${owned}::text[])`
      await sql.end({ timeout: 5 })
    }
  }
)
