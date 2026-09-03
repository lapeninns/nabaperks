import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

/**
 * db phone plaintext retirement — live-DB tier.
 *
 * Plaintext customer phone numbers no longer exist at rest. This suite pins:
 * the column and every DB reference to it are gone; the contact-present
 * CHECK accepts email | phone_hmac | phone_last4 and rejects contact-less
 * rows; the masked view serves "Phone ending NNNN" from the stored last4;
 * the verified-contact trigger still guards the encrypted set; and
 * get_reward_scan_context answers without a raw phone column.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

test(
  "no schema object references plaintext customers.phone",
  { skip },
  async () => {
    const sql = db()
    const [{ n: column }] = await sql.unsafe(
      `select count(*)::int as n from information_schema.columns
     where table_schema='public' and table_name='customers' and column_name='phone'`
    )
    assert.equal(column, 0, "the plaintext column is gone")

    const functions = await sql.unsafe(
      `select proname from pg_proc
     where pronamespace='public'::regnamespace
       and (prosrc ~ 'customers\\.phone[^_]' or prosrc ~ 'new\\.phone[^_]' or prosrc ~ 'old\\.phone[^_]')`
    )
    assert.deepEqual(
      functions.map((row) => row.proname),
      [],
      "no function body reads or writes the plaintext column"
    )

    const [{ def: viewDef }] = await sql.unsafe(
      `select pg_get_viewdef('public.customers_masked'::regclass) as def`
    )
    assert.ok(
      !/customers\.phone[^_]/.test(viewDef),
      "the masked view has no plaintext fallback"
    )
    assert.match(
      viewDef,
      /phone_last4/,
      "the masked view serves from the stored last4"
    )

    const [{ def: checkDef }] = await sql.unsafe(
      `select pg_get_constraintdef(oid) as def from pg_constraint
     where conname='customers_contact_present'`
    )
    assert.match(
      checkDef,
      /phone_last4/,
      "the contact CHECK accepts the backfilled last4"
    )
    assert.ok(
      !/phone IS NOT NULL/.test(checkDef.replace(/phone_(hmac|last4)/g, "")),
      "the contact CHECK no longer references plaintext phone"
    )
  }
)

test(
  "the contact CHECK accepts last4-only rows and rejects contact-less rows",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [legacy] = await tx`
      insert into public.customers (phone_last4, created_at, updated_at)
      values ('4321', now(), now())
      returning id`
      assert.ok(
        legacy.id,
        "a backfilled legacy row (last4 only) passes the CHECK"
      )

      let refused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`insert into public.customers (created_at, updated_at) values (now(), now())`
        })
      } catch (error) {
        refused =
          error?.code === "23514" ||
          /check constraint/i.test(String(error.message))
      }
      assert.ok(refused, "a row with no contact at all is rejected")
    })
  }
)

test(
  "the masked view serves Phone ending NNNN from last4",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const [customer] = await tx`
      insert into public.customers (phone_last4, created_at, updated_at)
      values ('9876', now(), now())
      returning id`

      const rows = await tx.savepoint(async (sp) => {
        await sp`set local role authenticated`
        await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
        await sp`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, true)`
        await sp`select set_config('request.jwt.claim.aal', 'aal2', true)`
        try {
          return await sp`select phone, phone_last4 from public.customers_masked
                        where id = ${customer.id}::uuid`
        } finally {
          await sp`reset role`
        }
      })

      assert.equal(rows.length, 1, "the admin sees the masked row")
      assert.equal(
        rows[0].phone,
        "Phone ending 9876",
        "the masked phone derives from last4"
      )
      assert.equal(rows[0].phone_last4, "9876")
    })
  }
)

test(
  "the verified-contact trigger still guards the encrypted set",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
      insert into public.customers
        (phone_hmac, phone_last4, phone_verified_at, created_at, updated_at)
      values (${`hmac-${randomUUID()}`}, '1111', now(), now(), now())
      returning id`

      let refused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`update public.customers set phone_hmac = 'tampered' where id = ${customer.id}::uuid`
        })
      } catch (error) {
        refused = /Verified customer phone cannot be changed/i.test(
          String(error.message)
        )
      }
      assert.ok(
        refused,
        "verified phone identity stays immutable after the column drop"
      )
    })
  }
)

test(
  "get_reward_scan_context answers without a raw phone column",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`
      select * from public.get_reward_scan_context(
        ${randomUUID()}::uuid, ${randomUUID()}::uuid)`
      assert.ok(row, "the scan-context function still answers")
      assert.equal(row.scan_status, "not_found")
      assert.ok(
        !("customer_phone" in row),
        "no raw phone column remains in the result"
      )
      assert.ok(
        "customer_phone_last4" in row,
        "the masked last4 column remains"
      )
    })
  }
)
