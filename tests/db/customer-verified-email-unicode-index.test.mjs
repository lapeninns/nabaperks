import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { normalizeEmail } from "../../lib/customer/email-pii-core.ts"
import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * One verified wallet per address, whatever edge whitespace or Unicode form
 * the stored address carries (QA BUG-024, BUG-054; 20261009110100).
 *
 * The address index used lower(btrim(email)). PostgreSQL btrim(text) strips
 * only U+0020, so a tab or no-break-space variant of a verified address
 * survived as a second verified wallet, and neither side applied Unicode
 * normalisation, so the NFD form of an NFC address did too. The index now
 * keys on the same normalisation as the app's `normalizeEmail`: every
 * Unicode edge whitespace trimmed, lower-cased, NFC. This proves the refusal,
 * that the index expression and `normalizeEmail` agree, and that the
 * migration's pre-flight refuses to build over existing collisions.
 */

const ADDRESS_INDEX = "public.customers_verified_email_address_unique_idx"
const MIGRATION_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations/20261009110100_verified_email_address_unicode_index.sql"
)

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
after(closeDb)

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

async function insertVerified(sql, email) {
  const [row] = await sql`
    insert into public.customers (email, email_hmac, email_verified_at)
    values (${email}, ${hex64()}, now())
    returning id`
  return row.id
}

/** The index's key expression, evaluated for one address. */
async function indexKey(sql, email) {
  const [{ expression }] = await sql`
    select pg_get_indexdef(${ADDRESS_INDEX}::regclass, 1, false) as expression`
  const [{ key }] = await sql.unsafe(
    `select ${expression} as key from (select $1::text as email) as input`,
    [email]
  )
  return key
}

const EDGES = [
  "\t",
  "\n",
  "\r",
  "\v",
  "\f",
  "\u00a0",
  "\u1680",
  "\u2000",
  "\u200a",
  "\u2028",
  "\u2029",
  "\u202f",
  "\u205f",
  "\u3000",
  "\ufeff",
]

test(
  "the address index refuses edge-whitespace variants of a verified address",
  { skip },
  async () => {
    for (const edge of EDGES) {
      await inRolledBackTxn(async (tx) => {
        const address = `ws-${randomUUID()}@example.test`
        await insertVerified(tx, address)
        for (const variant of [
          `${address}${edge}`,
          `${edge}${address.toUpperCase()}`,
        ]) {
          await assert.rejects(
            tx.savepoint((sp) => insertVerified(sp, variant)),
            (error) => {
              assert.equal(error.code, "23505", JSON.stringify(edge))
              assert.match(
                error.message,
                /customers_verified_email_address_unique_idx/
              )
              return true
            }
          )
        }
      })
    }
  }
)

test(
  "the address index refuses the NFD form of a verified NFC address, and the reverse",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const local = `cafe-${randomUUID().slice(0, 8)}`
      const nfc = `${local.replace("cafe", "caf\u00e9")}@example.test`
      const nfd = `${local.replace("cafe", "cafe\u0301")}@example.test`
      assert.notEqual(nfc, nfd)
      await insertVerified(tx, nfc)
      await assert.rejects(
        tx.savepoint((sp) => insertVerified(sp, nfd)),
        { code: "23505" }
      )
      await assert.rejects(
        tx.savepoint((sp) => insertVerified(sp, `\u00a0${nfd.toUpperCase()}`)),
        { code: "23505" }
      )
    })
    await inRolledBackTxn(async (tx) => {
      const nfd = `cafe\u0301-${randomUUID().slice(0, 8)}@example.test`
      await insertVerified(tx, nfd)
      await assert.rejects(
        tx.savepoint((sp) => insertVerified(sp, nfd.normalize("NFC"))),
        { code: "23505" }
      )
    })
  }
)

test(
  "distinct addresses, unverified copies and erased placeholders stay outside it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const address = `keep-${randomUUID()}@example.test`
      await insertVerified(tx, address)
      // Inner whitespace and a different accent are different addresses.
      await insertVerified(tx, address.replace("keep-", "keep -"))
      await insertVerified(tx, address.replace("keep-", "k\u00e8ep-"))
      await tx`
        insert into public.customers (email, email_hmac, email_verified_at)
        values (${`\t${address}`}, ${hex64()}, null)`
      const placeholder = `erased+${randomUUID().replaceAll("-", "")}@privacy.invalid`
      await insertVerified(tx, placeholder)
    })
  }
)

test(
  "the index key is exactly what normalizeEmail stores for every variant",
  { skip },
  async () => {
    const samples = [
      "Guest@Example.com",
      "  guest@example.com ",
      ...EDGES.map((edge) => `${edge}Guest@Example.com${edge}`),
      "cafe\u0301@example.com",
      "CAF\u00c9@EXAMPLE.COM",
      "\u00a0\u3000CAFE\u0301@Example.com\ufeff\t",
      "a+tag@x.com",
    ]
    for (const sample of samples) {
      assert.equal(
        await indexKey(db(), sample),
        normalizeEmail(sample),
        JSON.stringify(sample)
      )
    }
  }
)

test(
  "the migration pre-flight aborts with 23505 on a collision only the new key sees",
  { skip },
  async () => {
    assert.ok(existsSync(MIGRATION_PATH), "the migration is present")
    const migration = readFileSync(MIGRATION_PATH, "utf8")
    const collisions = [
      ["tab", (address) => `${address}\t`],
      ["no-break space", (address) => `\u00a0${address}`],
      ["NFD", (address) => address.normalize("NFD")],
    ]
    for (const [label, variant] of collisions) {
      await inRolledBackTxn(async (tx) => {
        await tx.unsafe(`drop index ${ADDRESS_INDEX}`)
        const address = `caf\u00e9-${randomUUID()}@example.test`
        await insertVerified(tx, address)
        await insertVerified(tx, variant(address))
        await assert.rejects(tx.unsafe(migration), (error) => {
          assert.equal(error.code, "23505", label)
          assert.match(error.message, /duplicate verified email address/)
          assert.match(error.hint ?? "", /through support/)
          return true
        })
      })
    }

    // With no collision the migration builds the index again and is a no-op
    // when replayed.
    await inRolledBackTxn(async (tx) => {
      await tx.unsafe(`drop index ${ADDRESS_INDEX}`)
      await tx.unsafe(migration)
      await tx.unsafe(migration)
      const [{ expression }] = await tx`
        select pg_get_indexdef(${ADDRESS_INDEX}::regclass, 1, false) as expression`
      assert.match(expression, /^normalize\(lower\(regexp_replace\(email/i)
    })
  }
)
