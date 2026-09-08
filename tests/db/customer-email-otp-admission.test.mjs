import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import { after, test } from "node:test"
import postgres from "postgres"
import { closeDb, db, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

const ready = await (async () => {
  try {
    const [row] =
      await db()`select to_regprocedure('public.admit_customer_email_otp_send(text,text,text)') is not null as ready`
    return row.ready
  } catch {
    return false
  }
})()
const skip = ready ? false : "local email admission RPC unavailable"
after(closeDb)
const key = () => randomBytes(32).toString("hex")
const keys = () => [key(), key(), key()]
const call = (sql, [customer, recipient, cooldown]) =>
  sql`select public.admit_customer_email_otp_send(${customer}, ${recipient}, ${cooldown})`

for (const [name, index, limit] of [
  ["customer", 0, 6],
  ["recipient", 1, 3],
  ["cooldown", 2, 1],
]) {
  test(
    `email ${name} rejection rolls back every other quota`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const buckets = keys()
        await tx`insert into public.rate_limit_buckets(bucket_key,count,reset_at) values (${buckets[index]},${limit},now()+interval '1 day')`
        for (let attempt = 0; attempt < 3; attempt++)
          await assert.rejects(
            tx.savepoint((sp) => call(sp, buckets)),
            /rate limit exceeded/i
          )
        const rows =
          await tx`select bucket_key,count from public.rate_limit_buckets where bucket_key=any(${buckets}::text[])`
        assert.deepEqual(
          rows.map((row) => [row.bucket_key, row.count]),
          [[buckets[index], limit]]
        )
        if (index === 0) {
          await call(tx, [key(), buckets[1], buckets[2]])
          const [recipient] =
            await tx`select count from public.rate_limit_buckets where bucket_key=${buckets[1]}`
          assert.equal(recipient.count, 1)
        }
      })
    }
  )
}

test(
  "email admission shares cooldown across flows without consuming losing flow quotas",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = keys()
      const second = [key(), key(), first[2]]
      await call(tx, first)
      await assert.rejects(
        tx.savepoint((sp) => call(sp, second)),
        /rate limit exceeded/i
      )
      const rows =
        await tx`select count(*)::int as n from public.rate_limit_buckets where bucket_key=any(${second.slice(0, 2)}::text[])`
      assert.equal(rows[0].n, 0)
      await tx`update public.rate_limit_buckets set reset_at=now()-interval '1 second' where bucket_key=${first[2]}`
      await call(tx, second)
    })
  }
)

test(
  "email admission rejects malformed and duplicate keys without a debit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const valid = keys()
      for (const invalid of [
        [null, valid[1], valid[2]],
        [valid[0], "raw@example.test", valid[2]],
        [valid[0], valid[1], "bad"],
        [valid[0], valid[0], valid[2]],
      ]) {
        await assert.rejects(
          tx.savepoint((sp) => call(sp, invalid)),
          /invalid customer email otp admission input/i
        )
      }
      const [row] =
        await tx`select count(*)::int as n from public.rate_limit_buckets where bucket_key=any(${valid}::text[])`
      assert.equal(row.n, 0)
    })
  }
)

test(
  "only the actual service role can execute email admission",
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

for (const sharedCustomer of [true, false]) {
  test(
    `concurrent email requests debit only one winner (${sharedCustomer ? "same" : "different"} customer)`,
    { skip },
    async () => {
      const sql = postgres(dbUrl(), { max: 8, idle_timeout: 2 })
      const initial = keys()
      const requests = Array.from({ length: 6 }, () => [
        sharedCustomer ? initial[0] : key(),
        initial[1],
        initial[2],
      ])
      const owned = [...new Set(requests.flat())]
      try {
        const results = await Promise.allSettled(
          requests.map((buckets) =>
            sql.begin(async (tx) => {
              await tx`set local statement_timeout='5s'`
              await call(tx, buckets)
              await tx`select pg_sleep(0.15)`
            })
          )
        )
        assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1
        )
        for (const result of results.filter(
          (result) => result.status === "rejected"
        ))
          assert.match(result.reason.message, /rate limit exceeded/i)
        const rows =
          await sql`select bucket_key,count from public.rate_limit_buckets where bucket_key=any(${owned}::text[])`
        assert.equal(rows.length, 3)
        assert.ok(rows.every((row) => row.count === 1))
        await sql`update public.rate_limit_buckets set reset_at=now()-interval '1 second' where bucket_key=${initial[2]}`
        await call(
          sql,
          [key(), initial[1], initial[2]].map((value, index) =>
            index === 0 ? initial[0] : value
          )
        )
        const [recipient] =
          await sql`select count from public.rate_limit_buckets where bucket_key=${initial[1]}`
        assert.equal(recipient.count, 2)
      } finally {
        await sql`delete from public.rate_limit_buckets where bucket_key=any(${owned.concat(initial[0])}::text[])`
        await sql.end({ timeout: 5 })
      }
    }
  )
}
