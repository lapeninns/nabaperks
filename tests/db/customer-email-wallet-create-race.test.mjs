import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import { closeDb, db, dbUrl, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Two taps on "start my wallet" for the same verified email, on two devices or
 * a double submit, race to create an email-only wallet
 * (`createCustomerByVerifiedEmail`). The unique verified-email index must let
 * exactly one insert commit; every other one fails with 23505 and its re-lookup
 * by verified `email_hmac` finds the winner. Each insert runs on its own
 * connection, as concurrent requests do.
 */

const INDEX = "public.customers_verified_email_hmac_unique_idx"
const RACERS = 6

// Skipped only when there is no database. With one, a missing index is the
// regression this proves against (duplicate wallets), so it fails instead.
const live = await isLiveDbReady()
const skip = live ? false : "local database not available"

async function assertUniqueIndexDeployed() {
  const [row] = await db()`select to_regclass(${INDEX}) is not null as ready`
  assert.equal(
    row.ready,
    true,
    `${INDEX} is missing: concurrent email sign-ups would create duplicate wallets`
  )
}

const connections = []
after(async () => {
  await Promise.all(connections.map((sql) => sql.end({ timeout: 5 })))
  await closeDb()
})

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

function connect() {
  const sql = postgres(dbUrl(), { max: 1, idle_timeout: 5 })
  connections.push(sql)
  return sql
}

/** The insert `createCustomerByVerifiedEmail` makes for a proven email. */
function insertEmailWallet(sql, { email, emailHmac }) {
  return sql`
    insert into public.customers (auth_user_id, email, email_hmac, email_verified_at)
    values (null, ${email}, ${emailHmac}, now())
    returning id::text as id`
}

/** Its 23505 fallback: the verified wallet that won. */
async function findVerifiedWallet(sql, emailHmac) {
  const rows = await sql`
    select id::text as id
    from public.customers
    where email_hmac = ${emailHmac}
      and email_verified_at is not null`
  return rows
}

/** Resolves once backend `pid` is waiting on a lock (the unique index). */
async function waitForLockWait(pid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await db()`
      select wait_event_type
      from pg_stat_activity
      where pid = ${pid}`
    if (row?.wait_event_type === "Lock") return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error("The second insert never waited on the first.")
}

async function removeWallets(emailHmac) {
  await db()`delete from public.customers where email_hmac = ${emailHmac}`
}

test(
  "the verified-email unique index that settles the race is deployed",
  { skip },
  assertUniqueIndexDeployed
)

test(
  "a second insert waits for the first and then loses to it with 23505",
  { skip },
  async () => {
    await assertUniqueIndexDeployed()
    const email = `race-pair-${randomUUID()}@example.test`
    const emailHmac = hex64()
    const first = connect()
    const second = connect()
    try {
      let releaseFirst
      const firstMayCommit = new Promise((resolve) => {
        releaseFirst = resolve
      })
      let firstInserted
      const firstHasInserted = new Promise((resolve) => {
        firstInserted = resolve
      })

      const winner = first.begin(async (tx) => {
        const [row] = await insertEmailWallet(tx, { email, emailHmac })
        firstInserted()
        await firstMayCommit
        return row.id
      })
      await firstHasInserted
      const [{ pid }] = await second`select pg_backend_pid() as pid`

      // The second insert blocks on the uncommitted first row.
      const loser = second
        .begin((tx) => insertEmailWallet(tx, { email, emailHmac }))
        .then(
          () => null,
          (error) => error
        )
      await waitForLockWait(pid)
      releaseFirst()

      const winnerId = await winner
      const loserError = await loser
      assert.equal(loserError?.code, "23505")
      assert.match(
        loserError.message,
        /customers_verified_email_hmac_unique_idx/
      )

      const found = await findVerifiedWallet(second, emailHmac)
      assert.deepEqual(
        found.map((row) => row.id),
        [winnerId]
      )
    } finally {
      await removeWallets(emailHmac)
    }
  }
)

test(
  `${RACERS} concurrent creations of one verified email leave exactly one wallet`,
  { skip },
  async () => {
    await assertUniqueIndexDeployed()
    const email = `race-many-${randomUUID()}@example.test`
    const emailHmac = hex64()
    const racers = Array.from({ length: RACERS }, () => connect())
    try {
      const outcomes = await Promise.all(
        racers.map((sql) =>
          insertEmailWallet(sql, { email, emailHmac }).then(
            ([row]) => ({ id: row.id }),
            (error) => ({ error })
          )
        )
      )

      const created = outcomes.filter((outcome) => outcome.id)
      const refused = outcomes.filter((outcome) => outcome.error)
      assert.equal(created.length, 1)
      assert.equal(refused.length, RACERS - 1)
      for (const { error } of refused) assert.equal(error.code, "23505")

      // Every loser resolves to the same winning wallet.
      for (const sql of racers) {
        const found = await findVerifiedWallet(sql, emailHmac)
        assert.deepEqual(
          found.map((row) => row.id),
          [created[0].id]
        )
      }
      const [{ count }] = await db()`
        select count(*)::int as count
        from public.customers
        where email_hmac = ${emailHmac}`
      assert.equal(count, 1)
    } finally {
      await removeWallets(emailHmac)
    }
  }
)
