import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * QA BUG-014 (38c42a1..2c45031). Two wallets confirming the same address at
 * once are separated by the database, not by the app: the confirmation write
 * itself fails with 23505 on the verified-email unique indexes, which
 * `markCustomerEmailVerified` maps to `conflict`.
 *
 * The app used to re-check after its write and "withdraw" its own
 * confirmation. That compensating write can never succeed:
 * `prevent_verified_customer_contact_change` locks `email` and
 * `email_verified_at` once a row is verified, for every caller. So the indexes
 * are the only guard, and this proves they exist, are valid and refuse the
 * losing confirmation, and that the withdrawal the app no longer attempts is
 * refused by the trigger.
 */

const INDEXES = [
  "customers_verified_email_hmac_unique_idx",
  "customers_verified_email_address_unique_idx",
]

const ready = await isLiveDbReady()
const skip = ready ? false : "local Supabase DB is not configured"
after(closeDb)

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

test(
  "both verified-email unique indexes exist, are valid and cover only verified rows",
  { skip },
  async () => {
    const rows = await db()`
      select
        c.relname as name,
        i.indisunique as is_unique,
        i.indisvalid as is_valid,
        pg_get_expr(i.indpred, i.indrelid) as predicate
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      where i.indrelid = 'public.customers'::regclass
        and c.relname = any(${INDEXES})
      order by c.relname`

    assert.deepEqual(
      rows.map((row) => row.name),
      [...INDEXES].sort()
    )
    for (const row of rows) {
      assert.equal(row.is_unique, true, `${row.name} must be unique`)
      assert.equal(row.is_valid, true, `${row.name} must be valid`)
      assert.match(row.predicate, /email_verified_at IS NOT NULL/)
    }
  }
)

test(
  "the losing confirmation of a raced address fails with 23505, and a withdrawal of the winner is refused",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const address = `race-${randomUUID()}@example.test`
      const emailHmac = hex64()
      // Two phone wallets holding the same unverified address.
      const [winner, loser] = await tx`
        insert into public.customers (email, phone_hmac, phone_last4)
        values
          (${address}, ${hex64()}, '0001'),
          (${address}, ${hex64()}, '0002')
        returning id`

      await tx`
        update public.customers
        set email_hmac = ${emailHmac}, email_verified_at = now()
        where id = ${winner.id}::uuid`

      // The confirmation write the app sends for the second wallet.
      await assert.rejects(
        tx.savepoint(
          (sp) => sp`
            update public.customers
            set email = ${address},
                email_hmac = ${emailHmac},
                email_verified_at = now()
            where id = ${loser.id}::uuid`
        ),
        { code: "23505" }
      )

      // The compensating write the app used to attempt after its own
      // confirmation: the lifecycle trigger refuses it.
      await assert.rejects(
        tx.savepoint(
          (sp) => sp`
            update public.customers
            set email = ${address}, email_hmac = null, email_verified_at = null
            where id = ${winner.id}::uuid`
        ),
        /Verified customer email cannot be changed/
      )

      const verified = await tx`
        select count(*)::int as count
        from public.customers
        where id in (${winner.id}::uuid, ${loser.id}::uuid)
          and email_verified_at is not null`
      assert.equal(verified[0].count, 1)
    })
  }
)
