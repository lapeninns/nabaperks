import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db emergency containment — Blocker 3: the live schema drifted from source.
 *
 * `customers.email_hmac` was added by editing an already-applied migration, so
 * fresh replay has it but the live database never ran that edit — yet
 * `lib/customer/profile.ts` reads and writes it. A forward-only, idempotent
 * migration must guarantee the column and its partial index exist everywhere.
 *
 * The legacy-seed repair migration (`20260710095000`) only ever lived on an
 * unmerged branch but was applied to live out-of-band. It is restored at its
 * original version as a fresh-safe bridge — a re-runnable function — so the
 * live ledger realigns while the contract stays testable: zero candidates is a
 * no-op, one is repaired, more than one fails closed.
 */

after(closeDb)

test("customers.email_hmac column exists", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const [row] = await db()`
    select data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'email_hmac'`

  assert.ok(row, "customers.email_hmac must exist")
  assert.equal(row.data_type, "text")
})

test("customers.email_hmac partial index exists", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const [row] = await db()`
    select indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'customers'
      and indexname = 'customers_email_hmac_idx'`

  assert.ok(row, "customers_email_hmac_idx must exist")
  assert.match(row.indexdef, /email_hmac/)
  assert.match(row.indexdef, /where .*email_hmac is not null/i)
})

test("the legacy-seed bridge is a defined, idempotent-safe function", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  // The bridge must be re-runnable — either as a repeatable function or a
  // guarded DO block whose repeat run is a no-op. We expose it as a function
  // so its cardinality contract is directly testable.
  const [row] = await db()`
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'remove_legacy_seed_signup_duplicate'`

  assert.ok(row, "expected public.remove_legacy_seed_signup_duplicate() bridge function")
})

async function createMerchant(tx) {
  const ownerId = randomUUID()
  const merchantId = randomUUID()
  const short = merchantId.slice(0, 8)
  await tx`insert into auth.users (id) values (${ownerId}::uuid)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email, status
    ) values (
      ${merchantId}::uuid, ${ownerId}::uuid, ${`Bridge ${short}`},
      ${`bridge-${short}`}, 'pub', ${`bridge-${short}@example.test`}, 'trial'
    )`
  return merchantId
}

async function seedSignupEvents(tx, merchantId, { seedCount, genuineCount }) {
  // The one-signup-per-merchant unique index was added AFTER the seed incident,
  // which is why the duplicate cannot occur on a current database. Reconstruct
  // the historical pre-index state inside this rolled-back txn so the bridge has
  // a real duplicate to repair.
  await tx`drop index if exists public.product_events_merchant_signed_up_once_idx`
  for (let i = 0; i < genuineCount; i += 1) {
    await tx`
      insert into public.product_events (event_name, merchant_id, actor_type, metadata)
      values ('merchant_signed_up', ${merchantId}::uuid, 'merchant', jsonb_build_object('source', 'signup_form'))`
  }
  for (let i = 0; i < seedCount; i += 1) {
    await tx`
      insert into public.product_events (event_name, merchant_id, actor_type, metadata)
      values ('merchant_signed_up', ${merchantId}::uuid, 'system', jsonb_build_object('source', 'production_seed_bean_batch'))`
  }
}

async function inTxn(fn) {
  const ROLLBACK = Symbol("rollback")
  let out
  try {
    await db().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      out = await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return out
}

test("bridge removes exactly one superseded seed signup when one qualifies", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const remaining = await inTxn(async (tx) => {
    const merchantId = await createMerchant(tx)
    await seedSignupEvents(tx, merchantId, { seedCount: 1, genuineCount: 1 })
    await tx`select public.remove_legacy_seed_signup_duplicate()`
    const [{ n }] = await tx`
      select count(*)::int as n from public.product_events
      where merchant_id = ${merchantId}::uuid
        and metadata ->> 'source' = 'production_seed_bean_batch'`
    return n
  })

  assert.equal(remaining, 0)
})

test("bridge is a no-op when there are zero seed candidates", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const genuine = await inTxn(async (tx) => {
    const merchantId = await createMerchant(tx)
    await seedSignupEvents(tx, merchantId, { seedCount: 0, genuineCount: 1 })
    await tx`select public.remove_legacy_seed_signup_duplicate()`
    const [{ n }] = await tx`
      select count(*)::int as n from public.product_events
      where merchant_id = ${merchantId}::uuid and event_name = 'merchant_signed_up'`
    return n
  })

  assert.equal(genuine, 1)
})

test("bridge fails closed when more than one seed candidate qualifies", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await assert.rejects(
    inTxn(async (tx) => {
      const merchantId = await createMerchant(tx)
      await seedSignupEvents(tx, merchantId, { seedCount: 2, genuineCount: 1 })
      await tx`select public.remove_legacy_seed_signup_duplicate()`
    }),
    (error) => {
      assert.match(String(error.message), /seed signup|expected|candidate/i)
      return true
    }
  )
})
