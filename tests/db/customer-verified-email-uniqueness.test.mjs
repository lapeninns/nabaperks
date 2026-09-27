import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * One wallet per verified email (20261006100000).
 *
 * Email sign-in resolves a wallet by verified `email_hmac`, so the database
 * must refuse a second verified row with the same HMAC, and the migration must
 * refuse to build that guarantee over data that already breaks it. The
 * pre-flight is executed from the migration file itself against seeded
 * duplicates inside a rolled-back transaction, so this proves the shipped SQL,
 * not a copy of it.
 */

const MIGRATION = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../supabase/migrations/20261006100000_unique_verified_customer_email.sql"
  ),
  "utf8"
)
const PREFLIGHT = MIGRATION.slice(
  MIGRATION.indexOf("do $verified_email_preflight$"),
  MIGRATION.indexOf("$verified_email_preflight$;") +
    "$verified_email_preflight$;".length
)
const INDEX = "public.customers_verified_email_hmac_unique_idx"

async function uniquenessReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [row] = await db()`select to_regclass(${INDEX}) is not null as ready`
    return row.ready
  } catch {
    return false
  }
}

const ready = await uniquenessReady()
const skip = ready ? false : "verified email uniqueness index not deployed"
after(closeDb)

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")
const address = (label) => `${label}-${randomUUID()}@example.test`

async function insertCustomer(sql, { email, emailHmac, verified }) {
  const [row] = await sql`
    insert into public.customers (email, email_hmac, email_verified_at)
    values (${email}, ${emailHmac}, ${verified ? new Date() : null})
    returning id`
  return row.id
}

async function preflightError(tx, seed) {
  try {
    await tx.savepoint(async (sp) => {
      await seed(sp)
      await sp.unsafe(PREFLIGHT)
    })
    return null
  } catch (error) {
    return error
  }
}

test("the migration pre-flight block was found", { skip }, () => {
  assert.match(PREFLIGHT, /^do \$verified_email_preflight\$/)
  assert.match(PREFLIGHT, /lock table public\.customers/)
})

test(
  "pre-flight aborts with 23505 on every kind of verified-email collision",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // Recreate the pre-migration state: the pre-flight only runs while the
      // index is absent. The drop is rolled back with the transaction.
      await tx.unsafe(`drop index ${INDEX}`)

      const sharedHmac = hex64()
      const duplicateHmac = await preflightError(tx, async (sp) => {
        await insertCustomer(sp, {
          email: address("dup-hmac-a"),
          emailHmac: sharedHmac,
          verified: true,
        })
        await insertCustomer(sp, {
          email: address("dup-hmac-b"),
          emailHmac: sharedHmac,
          verified: true,
        })
      })
      assert.equal(duplicateHmac?.code, "23505")
      assert.match(duplicateHmac.message, /duplicate email_hmac group/)
      assert.match(duplicateHmac.hint ?? "", /through support/)

      const sharedAddress = address("dup-address")
      const duplicateAddress = await preflightError(tx, async (sp) => {
        await insertCustomer(sp, {
          email: sharedAddress,
          emailHmac: hex64(),
          verified: true,
        })
        await insertCustomer(sp, {
          email: `  ${sharedAddress.toUpperCase()} `,
          emailHmac: hex64(),
          verified: true,
        })
      })
      assert.equal(duplicateAddress?.code, "23505")
      assert.match(
        duplicateAddress.message,
        /duplicate verified email address group/
      )

      const missingHmac = await preflightError(tx, async (sp) => {
        await insertCustomer(sp, {
          email: address("no-hmac"),
          emailHmac: null,
          verified: true,
        })
      })
      assert.equal(missingHmac?.code, "23505")
      assert.match(missingHmac.message, /have no email_hmac/)
    })
  }
)

test("pre-flight is a no-op once the index exists", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const sharedAddress = address("replay")
    await insertCustomer(tx, {
      email: sharedAddress,
      emailHmac: hex64(),
      verified: true,
    })
    await insertCustomer(tx, {
      email: sharedAddress.toUpperCase(),
      emailHmac: hex64(),
      verified: true,
    })
    // The address collision would abort a first run; a replay skips it.
    await tx.unsafe(PREFLIGHT)
  })
})

test(
  "the index refuses a second verified email and allows unverified copies",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const emailHmac = hex64()
      await insertCustomer(tx, {
        email: address("owner"),
        emailHmac,
        verified: true,
      })

      await assert.rejects(
        tx.savepoint((sp) =>
          insertCustomer(sp, {
            email: address("second"),
            emailHmac,
            verified: true,
          })
        ),
        (error) => {
          assert.equal(error.code, "23505")
          assert.match(
            error.message,
            /customers_verified_email_hmac_unique_idx/
          )
          return true
        }
      )

      const pending = await insertCustomer(tx, {
        email: address("pending"),
        emailHmac,
        verified: false,
      })
      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`update public.customers set email_verified_at = now()
               where id = ${pending}::uuid`
        ),
        { code: "23505" }
      )

      // Re-keying another verified wallet onto a taken HMAC is refused too.
      const other = await insertCustomer(tx, {
        email: address("other"),
        emailHmac: hex64(),
        verified: true,
      })
      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`update public.customers set email_hmac = ${emailHmac}
               where id = ${other}::uuid`
        ),
        { code: "23505" }
      )

      // Erased and legacy rows without an HMAC are outside the index.
      await insertCustomer(tx, {
        email: address("legacy-a"),
        emailHmac: null,
        verified: true,
      })
      await insertCustomer(tx, {
        email: address("legacy-b"),
        emailHmac: null,
        verified: true,
      })
    })
  }
)
