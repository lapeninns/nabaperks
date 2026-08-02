import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Database-owned lifecycle state — live-DB proof that platform-owned columns
 * are not ordinary caller-writable row state.
 *
 * Every assertion here runs under `set local role authenticated` so it proves
 * the GRANT and RLS layers, not just trigger logic. The pre-existing fixtures
 * in this tier write as the connection owner with only a role GUC set, which is
 * exactly why these five findings were invisible to `pnpm test:db`.
 *
 * Covers: merchant-insert-billing-bypass, merchant-business-state-trigger-bypass,
 * customer-membership-insert-bypass, customer-contact-verification-self-forgery,
 * db-customer-dob-reward-policy-bypass.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "a merchant owner cannot create their own already-activated, billing-exempt venue",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ownerId = randomUUID()
      await tx`insert into auth.users (id) values (${ownerId}::uuid)`

      const denied = await expectDenied(
        tx,
        ownerId,
        (sp) =>
          sp`
          insert into public.merchants
            (owner_user_id, business_name, business_slug, business_type, email,
             status, requires_billing)
          values
            (${ownerId}::uuid, 'Forged Arms', ${`forged-${ownerId.slice(0, 8)}`},
             'pub', ${`forge-${ownerId.slice(0, 8)}@example.test`},
             'active', false)`
      )

      assert.ok(
        denied,
        "direct merchant creation must not be reachable with a user JWT — activation and billing exemption are platform-owned"
      )
    })
  }
)

test(
  "the supported onboarding RPC still creates a trial, billing-required venue",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ownerId = randomUUID()
      await tx`
        insert into auth.users (id, email)
        values (${ownerId}::uuid, ${`owner-${ownerId.slice(0, 8)}@example.test`})`

      const rows = await asAuthenticated(
        tx,
        ownerId,
        (sp) => sp`
          select * from public.complete_merchant_onboarding(
            p_business_name => ${`Legit Arms ${ownerId.slice(0, 6)}`},
            p_business_type => 'pub',
            p_phone => null,
            p_location_name => 'Main bar',
            p_address_line_1 => '10 King Street',
            p_address_line_2 => null,
            p_address_city => 'Cambridge',
            p_address_postcode => 'CB1 1AA',
            p_address_provider => null,
            p_address_provider_id => null,
            p_address_source => 'manual_entry',
            p_latitude => 52.2053,
            p_longitude => 0.1218,
            p_geofence_radius_meters => 150,
            p_require_geofence => false,
            p_soft_geofence_trigger_stamp_number => 3,
            p_geofence_pin_source => 'geocoded'
          )`
      )

      assert.ok(rows.length > 0, "the onboarding RPC must remain callable")

      const [merchant] = await tx`
        select status, requires_billing
        from public.merchants
        where owner_user_id = ${ownerId}::uuid`

      assert.equal(merchant.status, "trial")
      assert.equal(merchant.requires_billing, true)
    })
  }
)

test(
  "a merchant owner cannot flip billing state, even with only the aggregate claims blob",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createMerchant(tx)

      // PostgREST sets ONLY request.jwt.claims. The trigger treated a missing
      // legacy per-claim GUC as proof of trusted backend SQL, so this exact
      // request shape passed the privilege check.
      const billingDenied = await expectDenied(
        tx,
        fixture.ownerId,
        (sp) => sp`
          update public.merchants set requires_billing = false
          where id = ${fixture.merchantId}::uuid`,
        { blobOnly: true }
      )
      assert.ok(billingDenied, "requires_billing must stay platform-owned")

      const statusDenied = await expectDenied(
        tx,
        fixture.ownerId,
        (sp) => sp`
          update public.merchants set status = 'active'
          where id = ${fixture.merchantId}::uuid`,
        { blobOnly: true }
      )
      assert.ok(statusDenied, "status must stay platform-owned")
    })
  }
)

test(
  "a merchant owner can still edit their own profile fields",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createMerchant(tx)

      await asAuthenticated(
        tx,
        fixture.ownerId,
        (sp) => sp`
          update public.merchants
          set business_name = 'The Renamed Arms',
              business_type = 'bar',
              email = 'new@example.test',
              phone = '+441234567890'
          where id = ${fixture.merchantId}::uuid`,
        { blobOnly: true }
      )

      const [row] = await tx`
        select business_name, business_type, email, phone
        from public.merchants where id = ${fixture.merchantId}::uuid`

      assert.equal(row.business_name, "The Renamed Arms")
      assert.equal(row.business_type, "bar")
      assert.equal(row.email, "new@example.test")
      assert.equal(row.phone, "+441234567890")
    })
  }
)

test(
  "a customer cannot enrol themselves into a loyalty programme directly",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchant = await createMerchant(tx)
      const customer = await createCustomer(tx)

      const denied = await expectDenied(
        tx,
        customer.authUserId,
        (sp) =>
          sp`
          insert into public.customer_memberships
            (merchant_id, customer_id, current_stamp_count, total_stamps_earned)
          values
            (${merchant.merchantId}::uuid, ${customer.customerId}::uuid, 9, 99)`
      )

      assert.ok(
        denied,
        "membership rows are the result of a checked join transaction, never an independently writable row"
      )
    })
  }
)

test(
  "a customer cannot self-assert verified contact state",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const authUserId = randomUUID()
      await tx`insert into auth.users (id) values (${authUserId}::uuid)`

      // Route 1: forge provenance at INSERT (the trigger was UPDATE-only).
      const insertDenied = await expectDenied(
        tx,
        authUserId,
        (sp) =>
          sp`
          insert into public.customers
            (auth_user_id, email, email_verified_at, phone_last4)
          values
            (${authUserId}::uuid, ${`forge-${authUserId.slice(0, 8)}@example.test`},
             now(), '1234')`
      )
      assert.ok(
        insertDenied,
        "verification timestamps cannot be supplied at INSERT"
      )

      // Route 2: promote NULL -> value (the trigger only guarded contacts whose
      // OLD timestamp was already non-null).
      const customer = await createCustomer(tx, { verified: false })
      const updateDenied = await expectDenied(
        tx,
        customer.authUserId,
        (sp) =>
          sp`
          update public.customers set email_verified_at = now()
          where id = ${customer.customerId}::uuid`
      )
      assert.ok(
        updateDenied,
        "an unverified contact cannot be promoted by its owner"
      )
    })
  }
)

test(
  "a customer cannot rewrite the birth date that gates adult rewards",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await createCustomer(tx)

      const denied = await expectDenied(
        tx,
        customer.authUserId,
        (sp) =>
          sp`
          update public.customers
          set date_of_birth = ${"1990-01-01"}::date
          where id = ${customer.customerId}::uuid`
      )

      assert.ok(
        denied,
        "date_of_birth is the sole input to the 18+ gate and birthday issuance"
      )
    })
  }
)

test(
  "the trusted server path can still write verified contact state and birth dates",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // inRolledBackTxn already runs with the service-role request context,
      // which is how lib/customer/{identity,profile}.ts reach these columns.
      const customer = await createCustomer(tx, { verified: false })

      await tx`
        update public.customers
        set email_verified_at = now(),
            date_of_birth = ${"1990-01-01"}::date
        where id = ${customer.customerId}::uuid`

      const [row] = await tx`
        select email_verified_at, date_of_birth
        from public.customers where id = ${customer.customerId}::uuid`

      assert.ok(
        row.email_verified_at,
        "the OTP workflow must still verify contacts"
      )
      assert.ok(
        row.date_of_birth,
        "the profile editor must still save a birth date"
      )
    })
  }
)

test(
  "the triggers still refuse when the grant layer is bypassed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ownerId = randomUUID()
      await tx`insert into auth.users (id) values (${ownerId}::uuid)`
      const customer = await createCustomer(tx, { verified: false })

      // A future blanket re-grant (20260606142000:2606 was exactly that) must
      // not silently reopen any of this, so each guard is proven independently
      // of the GRANT that currently answers first.
      const merchantInsert = await expectTriggerRefusal(
        tx,
        ownerId,
        (sp) =>
          sp`
          insert into public.merchants
            (owner_user_id, business_name, business_slug, business_type, email,
             status, requires_billing)
          values
            (${ownerId}::uuid, 'Trigger Arms', ${`trig-${ownerId.slice(0, 8)}`},
             'pub', ${`t-${ownerId.slice(0, 8)}@example.test`}, 'active', false)`
      )
      assert.match(
        String(merchantInsert?.message),
        /New venues start on trial with billing required/
      )

      const membershipInsert = await expectTriggerRefusal(
        tx,
        ownerId,
        (sp) =>
          sp`
          insert into public.customer_memberships (merchant_id, customer_id)
          values (${randomUUID()}::uuid, ${customer.customerId}::uuid)`
      )
      assert.match(
        String(membershipInsert?.message),
        /created by the join transaction/
      )

      const forgedInsert = await expectTriggerRefusal(
        tx,
        ownerId,
        (sp) =>
          sp`
          insert into public.customers (auth_user_id, email_verified_at, phone_last4)
          values (${ownerId}::uuid, now(), '1234')`
      )
      assert.match(
        String(forgedInsert?.message),
        /cannot be supplied by the caller/
      )

      const promotion = await expectTriggerRefusal(
        tx,
        customer.authUserId,
        (sp) =>
          sp`
          update public.customers set date_of_birth = ${"1990-01-01"}::date
          where id = ${customer.customerId}::uuid`
      )
      assert.match(
        String(promotion?.message),
        /cannot be changed by the caller/
      )
    })
  }
)

test("the caller-writable surface stays revoked", { skip }, async () => {
  const [row] = await inRolledBackTxnReturning(
    (tx) => tx`
        select
          has_table_privilege('authenticated', 'public.merchants', 'insert') as m_ins,
          has_table_privilege('authenticated', 'public.merchants', 'delete') as m_del,
          has_table_privilege('authenticated', 'public.customers', 'insert') as c_ins,
          has_table_privilege('authenticated', 'public.customers', 'update') as c_upd,
          has_table_privilege('authenticated', 'public.customer_memberships', 'insert') as cm_ins,
          has_column_privilege('authenticated', 'public.merchants', 'business_name', 'update') as name_upd,
          has_column_privilege('authenticated', 'public.merchants', 'requires_billing', 'update') as billing_upd,
          has_column_privilege('authenticated', 'public.merchants', 'business_slug', 'update') as slug_upd`
  )

  assert.equal(row.m_ins, false, "merchant creation is not a table write")
  assert.equal(row.m_del, false)
  assert.equal(row.c_ins, false)
  assert.equal(row.c_upd, false)
  assert.equal(row.cm_ins, false)
  assert.equal(row.name_upd, true, "the profile editor must keep working")
  assert.equal(row.billing_upd, false, "billing state is platform-owned")
  assert.equal(row.slug_upd, false)
})

async function inRolledBackTxnReturning(fn) {
  let captured
  await inRolledBackTxn(async (tx) => {
    captured = await fn(tx)
  })
  return captured
}

async function createMerchant(tx) {
  const ownerId = randomUUID()
  const merchantId = randomUUID()
  await tx`insert into auth.users (id) values (${ownerId}::uuid)`
  await tx`
    insert into public.merchants
      (id, owner_user_id, business_name, business_slug, business_type, email,
       status, requires_billing)
    values
      (${merchantId}::uuid, ${ownerId}::uuid, 'The Test Arms',
       ${`test-arms-${merchantId.slice(0, 8)}`}, 'pub',
       ${`owner-${merchantId.slice(0, 8)}@example.test`}, 'trial', true)`
  return { ownerId, merchantId }
}

async function createCustomer(tx, { verified = true } = {}) {
  const authUserId = randomUUID()
  const customerId = randomUUID()
  await tx`insert into auth.users (id) values (${authUserId}::uuid)`
  await tx`
    insert into public.customers
      (id, auth_user_id, email, email_verified_at, phone_last4)
    values
      (${customerId}::uuid, ${authUserId}::uuid,
       ${`cust-${customerId.slice(0, 8)}@example.test`},
       ${verified ? new Date().toISOString() : null}, '4321')`
  return { authUserId, customerId }
}

/**
 * Runs `fn` as the real `authenticated` Postgres role so GRANTs and RLS both
 * apply. `blobOnly` reproduces the production request shape, where PostgREST
 * sets only the aggregate claims blob and never the legacy per-claim GUCs.
 */
async function asAuthenticated(tx, userId, fn, { blobOnly = false } = {}) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claims', ${claims}, true)`
    if (blobOnly) {
      await sp`select set_config('request.jwt.claim.role', '', true)`
      await sp`select set_config('request.jwt.claim.sub', '', true)`
    } else {
      await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    }
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

/**
 * True only for a genuine AUTHORISATION denial (SQLSTATE 42501), or for RLS
 * matching no rows. Anything else — a NOT NULL violation, a typo, a constraint
 * — must NOT read as a pass, or a future schema change silently hollows these
 * tests out.
 */
async function expectDenied(tx, userId, fn, options) {
  try {
    const result = await asAuthenticated(tx, userId, fn, options)
    return (result?.count ?? 0) === 0
  } catch (error) {
    if (error?.code === "42501") return true
    throw error
  }
}

/**
 * Writes as the table owner while presenting an authenticated request context,
 * so GRANTs are bypassed and the TRIGGER is the only thing left to refuse.
 * Without this the grant layer answers first and the trigger rewrite — the
 * defence-in-depth against a future blanket re-grant — is never exercised.
 */
async function expectTriggerRefusal(tx, userId, fn) {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" })
  await tx`select set_config('request.jwt.claims', ${claims}, true)`
  await tx`select set_config('request.jwt.claim.role', '', true)`

  let captured = null
  try {
    // The statement must abort inside its own savepoint, and the context reset
    // must happen OUTSIDE it — a set_config issued while the subtransaction is
    // aborted raises 25P02 and replaces the very error being asserted on.
    await tx.savepoint(async (sp) => {
      await fn(sp)
    })
  } catch (error) {
    captured = error
  }

  await tx`select set_config('request.jwt.claims', '', true)`
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
  return captured
}
