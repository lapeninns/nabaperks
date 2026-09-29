import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"
import {
  closeDb,
  db,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"

/**
 * Adding a proven phone to a wallet is one transaction
 * (`attach_verified_customer_phone`, QA BUG-002 and BUG-013).
 *
 * The attach used to be three PostgREST writes (stage, audit, mark verified)
 * with no lock. An erasure committing between them left the erased row with a
 * verified phone, which phone sign-in then reopened (BUG-002). Two overlapping
 * confirmations on one wallet wrote two `customer_phone_attached` rows and
 * sent one of them to a 500 (BUG-013).
 *
 * The RPC locks the customer row, re-checks that the wallet is live and has no
 * verified phone, writes the phone with its verified timestamp and the one
 * audit row together. `admin_erase_customer_pii` takes the same row lock
 * before it reads the contact it scrubs. Every race here runs on separate
 * connections, as concurrent requests and the admin console do.
 */

const RPC = "attach_verified_customer_phone"
const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

const live = await isLiveDbReady()
const skip = live ? false : "local database not available"

const connections = []
const createdCustomers = []
after(async () => {
  await Promise.all(connections.map((sql) => sql.end({ timeout: 5 })))
  if (live) await removeFixtures()
  await closeDb()
})

function connect() {
  const sql = postgres(dbUrl(), { max: 1, idle_timeout: 5, onnotice: () => {} })
  connections.push(sql)
  return sql
}

const hex64 = () => (randomUUID() + randomUUID()).replaceAll("-", "")

function phone() {
  return {
    hmac: hex64(),
    ciphertext: `v1.qa.${randomUUID()}`,
    last4: String(Math.floor(Math.random() * 10_000)).padStart(4, "0"),
  }
}

async function emailOnlyWallet() {
  const email = `attach-${randomUUID()}@example.test`
  const [row] = await db()`
    insert into public.customers (email, email_hmac, email_verified_at, full_name)
    values (${email}, ${hex64()}, now(), 'Attach Race')
    returning id::text as id`
  createdCustomers.push(row.id)
  return row.id
}

async function walletWithMembership() {
  const customerId = await emailOnlyWallet()
  const [merchant] = await db()`
    select m.id::text as id from public.merchants m
    where m.business_slug = 'old-crown-girton' limit 1`
  assert.ok(merchant, "the seeded Old Crown Girton merchant exists")
  await db()`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${merchant.id}::uuid, ${customerId}::uuid)`
  return { customerId, merchantId: merchant.id }
}

/** The call the app makes, as the service role PostgREST would present it. */
async function attach(sql, customerId, contact, surface = "profile") {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    const [row] = await tx`
      select public.attach_verified_customer_phone(
        ${customerId}::uuid, ${contact.hmac}, ${contact.ciphertext},
        ${contact.last4}, 'GB', ${surface}
      ) as status`
    return row.status
  })
}

async function readWallet(customerId) {
  const [row] = await db()`
    select email like 'erased+%@privacy.invalid' as erased,
           phone_hmac, phone_ciphertext, phone_last4, phone_country,
           phone_verified_at
    from public.customers where id = ${customerId}::uuid`
  const audits = await db()`
    select action, metadata from public.audit_logs
    where customer_id = ${customerId}::uuid
      and action in ('customer_phone_attached', 'customer_pii_erased')
    order by created_at, id`
  return {
    row,
    audits: audits.map(({ action, metadata }) => ({ action, metadata })),
  }
}

/** Resolves once backend `pid` waits on a lock held by another backend. */
async function waitForLockWait(pid) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [row] = await db()`
      select wait_event_type from pg_stat_activity where pid = ${pid}`
    if (row?.wait_event_type === "Lock") return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`backend ${pid} never waited on a lock`)
}

async function backendPid(sql) {
  const [{ pid }] = await sql`select pg_backend_pid() as pid`
  return pid
}

async function removeFixtures() {
  if (createdCustomers.length === 0) return
  await db().begin(async (tx) => {
    await tx`select set_config('app.customer_erasure', 'true', true)`
    await tx`delete from public.audit_logs where customer_id = any(${createdCustomers}::uuid[])`
    await tx`delete from public.customer_memberships where customer_id = any(${createdCustomers}::uuid[])`
    await tx`delete from public.customers where id = any(${createdCustomers}::uuid[])`
  })
}

test(
  "the attach RPC is service-role only, security definer, with a fixed search_path",
  { skip },
  async () => {
    const [fn] = await db()`
      select p.prosecdef as definer, p.proconfig as config,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authed,
             has_function_privilege('service_role', p.oid, 'execute') as service
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = ${RPC}`
    assert.ok(fn, `${RPC} is deployed`)
    assert.equal(fn.definer, true)
    assert.ok(
      fn.config?.some((setting) => setting.startsWith("search_path=")),
      "search_path is pinned"
    )
    assert.deepEqual(
      { anon: fn.anon, authed: fn.authed, service: fn.service },
      { anon: false, authed: false, service: true }
    )

    // Even with EXECUTE, a caller that is not the service role is refused.
    const customerId = await emailOnlyWallet()
    await assert.rejects(
      db().begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
        await tx`select public.attach_verified_customer_phone(
          ${customerId}::uuid, ${hex64()}, 'v1.x', '1234', 'GB', 'profile')`
      }),
      { code: "42501" }
    )
  }
)

test(
  "an attach writes the verified phone and exactly one audit row in one step",
  { skip },
  async () => {
    const customerId = await emailOnlyWallet()
    const contact = phone()
    assert.equal(
      await attach(db(), customerId, contact, "reward_gate"),
      "attached"
    )

    const { row, audits } = await readWallet(customerId)
    assert.equal(row.phone_hmac, contact.hmac)
    assert.equal(row.phone_ciphertext, contact.ciphertext)
    assert.equal(row.phone_last4, contact.last4)
    assert.equal(row.phone_country, "GB")
    assert.ok(row.phone_verified_at, "the phone is verified in the same write")
    assert.deepEqual(audits, [
      {
        action: "customer_phone_attached",
        metadata: { surface: "reward_gate" },
      },
    ])

    // A second attach is a handled no-op: nothing changes, no second audit.
    assert.equal(await attach(db(), customerId, phone()), "already_has_phone")
    const again = await readWallet(customerId)
    assert.equal(again.row.phone_hmac, contact.hmac)
    assert.equal(again.audits.length, 1)
  }
)

test(
  "a phone another wallet holds is a conflict, and an unknown or erased wallet is unavailable",
  { skip },
  async () => {
    const holder = await emailOnlyWallet()
    const contact = phone()
    assert.equal(await attach(db(), holder, contact), "attached")

    const other = await emailOnlyWallet()
    assert.equal(await attach(db(), other, contact), "contact_conflict")
    const { row, audits } = await readWallet(other)
    assert.equal(row.phone_hmac, null)
    assert.equal(row.phone_verified_at, null)
    assert.deepEqual(audits, [])

    assert.equal(
      await attach(db(), randomUUID(), phone()),
      "wallet_unavailable"
    )

    const { customerId, merchantId } = await walletWithMembership()
    await db().begin(async (tx) => {
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      await tx`select public.admin_erase_customer_pii(
        ${customerId}::uuid, ${merchantId}::uuid, 'other', 'attach test erasure')`
    })
    assert.equal(await attach(db(), customerId, phone()), "wallet_unavailable")
    const erased = await readWallet(customerId)
    assert.equal(erased.row.erased, true)
    assert.equal(erased.row.phone_hmac, null)
    assert.equal(erased.row.phone_verified_at, null)
    assert.deepEqual(
      erased.audits.map((audit) => audit.action),
      ["customer_pii_erased"]
    )
  }
)

test(
  "an unsupported surface or malformed phone is refused before anything is written",
  { skip },
  async () => {
    const customerId = await emailOnlyWallet()
    await assert.rejects(attach(db(), customerId, phone(), "sms_link"), {
      code: "22023",
    })
    await assert.rejects(
      attach(db(), customerId, { ...phone(), last4: "12a4" }),
      { code: "22023" }
    )
    const { row, audits } = await readWallet(customerId)
    assert.equal(row.phone_hmac, null)
    assert.deepEqual(audits, [])
  }
)

test("a failed audit insert undoes the phone write too", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [wallet] = await tx`
        insert into public.customers (email, email_hmac, email_verified_at)
        values (${`audit-${randomUUID()}@example.test`}, ${hex64()}, now())
        returning id::text as id`
    // Refuse this wallet's attach audit row only; rolled back with the test.
    await tx.unsafe(`
        create function pg_temp.refuse_attach_audit() returns trigger
        language plpgsql as $$
        begin
          if new.customer_id = '${wallet.id}'::uuid then
            raise exception 'audit store unavailable';
          end if;
          return new;
        end $$`)
    await tx.unsafe(`
        create trigger refuse_attach_audit before insert on public.audit_logs
        for each row execute function pg_temp.refuse_attach_audit()`)

    const contact = phone()
    const [{ status }] = await tx`
        select public.attach_verified_customer_phone(
          ${wallet.id}::uuid, ${contact.hmac}, ${contact.ciphertext},
          ${contact.last4}, 'GB', 'profile') as status`
    assert.equal(status, "audit_failed")
    const [row] = await tx`
        select phone_hmac, phone_verified_at from public.customers
        where id = ${wallet.id}::uuid`
    assert.deepEqual({ ...row }, { phone_hmac: null, phone_verified_at: null })
  })
})

test(
  "an erasure holding the wallet makes a concurrent attach wait and then refuse",
  { skip },
  async () => {
    const { customerId, merchantId } = await walletWithMembership()
    const eraser = connect()
    const attacher = connect()
    const attacherPid = await backendPid(attacher)

    let commitErasure
    const erasureMayCommit = new Promise((resolve) => {
      commitErasure = resolve
    })
    let erased
    const erasureHolds = new Promise((resolve) => {
      erased = resolve
    })
    const erasure = eraser.begin(async (tx) => {
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      await tx`select public.admin_erase_customer_pii(
        ${customerId}::uuid, ${merchantId}::uuid, 'other', 'attach race erasure')`
      erased()
      await erasureMayCommit
    })
    await erasureHolds

    const attaching = attach(attacher, customerId, phone())
    await waitForLockWait(attacherPid)
    commitErasure()
    await erasure

    assert.equal(await attaching, "wallet_unavailable")
    const { row, audits } = await readWallet(customerId)
    assert.equal(row.erased, true)
    assert.equal(row.phone_hmac, null)
    assert.equal(row.phone_ciphertext, null)
    assert.equal(row.phone_verified_at, null)
    assert.deepEqual(
      audits.map((audit) => audit.action),
      ["customer_pii_erased"]
    )
  }
)

test(
  "an erasure that starts while an attach holds the wallet waits and then removes the phone",
  { skip },
  async () => {
    const { customerId, merchantId } = await walletWithMembership()
    const attacher = connect()
    const eraser = connect()
    const eraserPid = await backendPid(eraser)
    const contact = phone()

    let commitAttach
    const attachMayCommit = new Promise((resolve) => {
      commitAttach = resolve
    })
    let attachedInTx
    const attachHolds = new Promise((resolve) => {
      attachedInTx = resolve
    })
    const attaching = attacher.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      const [row] = await tx`
        select public.attach_verified_customer_phone(
          ${customerId}::uuid, ${contact.hmac}, ${contact.ciphertext},
          ${contact.last4}, 'GB', 'profile') as status`
      attachedInTx(row.status)
      await attachMayCommit
      return row.status
    })
    assert.equal(await attachHolds, "attached")

    // The erasure must read the contact it scrubs only after the attach
    // commits, so it cannot miss the phone the attach is writing.
    const erasure = eraser.begin(async (tx) => {
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      await tx`select public.admin_erase_customer_pii(
        ${customerId}::uuid, ${merchantId}::uuid, 'other', 'erasure after attach')`
    })
    await waitForLockWait(eraserPid)
    commitAttach()
    await attaching
    await erasure

    const { row, audits } = await readWallet(customerId)
    assert.equal(row.erased, true)
    assert.equal(row.phone_hmac, null)
    assert.equal(row.phone_verified_at, null)
    assert.deepEqual(
      audits.map((audit) => audit.action),
      ["customer_phone_attached", "customer_pii_erased"]
    )
  }
)

test(
  "overlapping confirmations on one wallet attach once and audit once",
  { skip },
  async () => {
    for (const samePhone of [true, false]) {
      const customerId = await emailOnlyWallet()
      const first = connect()
      const second = connect()
      const secondPid = await backendPid(second)
      const firstPhone = phone()
      const secondPhone = samePhone ? firstPhone : phone()

      let commitFirst
      const firstMayCommit = new Promise((resolve) => {
        commitFirst = resolve
      })
      let firstAttached
      const firstHolds = new Promise((resolve) => {
        firstAttached = resolve
      })
      const winner = first.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
        const [row] = await tx`
          select public.attach_verified_customer_phone(
            ${customerId}::uuid, ${firstPhone.hmac}, ${firstPhone.ciphertext},
            ${firstPhone.last4}, 'GB', 'profile') as status`
        firstAttached()
        await firstMayCommit
        return row.status
      })
      await firstHolds

      const loser = attach(second, customerId, secondPhone)
      await waitForLockWait(secondPid)
      commitFirst()

      assert.equal(await winner, "attached")
      assert.equal(await loser, "already_has_phone")
      const { row, audits } = await readWallet(customerId)
      assert.equal(row.phone_hmac, firstPhone.hmac)
      assert.ok(row.phone_verified_at)
      assert.equal(
        audits.filter((audit) => audit.action === "customer_phone_attached")
          .length,
        1,
        samePhone ? "double submit" : "two phones"
      )
    }
  }
)
