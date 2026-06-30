import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Architecture audit dynamic proof — live-DB RLS tier.
 *
 * This is not a source-contract grep. It sets real database roles/request JWT
 * claims against the local Supabase Postgres and proves the tenant boundary the
 * app relies on: anon has no table/view access, authenticated merchants see only
 * their tenant through RLS and masked customer contact, cross-tenant writes do
 * not match rows, and service_role remains the explicit privileged channel.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "tenant RLS scopes authenticated merchants and denies anon/raw PII access",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createTenantFixture(tx)

      await assertAnonCannotReadMaskedCustomers(tx)

      const ownerMemberships = await asAuthenticatedUser(
        tx,
        fixture.ownerAUserId,
        (sp) => selectVisibleMemberships(sp, fixture)
      )
      assert.deepEqual(ownerMemberships, [fixture.membershipAId])

      const ownerCustomers = await asAuthenticatedUser(
        tx,
        fixture.ownerAUserId,
        (sp) => selectVisibleMaskedCustomers(sp, fixture)
      )
      assert.deepEqual(ownerCustomers, [
        {
          email: "a***@example.test",
          id: fixture.customerAId,
          phone: "Phone ending 1001",
          phone_last4: "1001",
        },
      ])

      const outsiderMemberships = await asAuthenticatedUser(
        tx,
        fixture.outsiderUserId,
        (sp) => selectVisibleMemberships(sp, fixture)
      )
      assert.deepEqual(outsiderMemberships, [])

      const crossTenantUpdates = await asAuthenticatedUser(
        tx,
        fixture.ownerBUserId,
        (sp) => updateOtherTenantMembership(sp, fixture.membershipAId)
      )
      assert.equal(crossTenantUpdates, 0)

      await assertAuthenticatedCannotReadRawCustomerPii(
        tx,
        fixture.ownerAUserId,
        fixture.customerAId
      )

      const serviceRoleCustomers = await asServiceRoleUser(tx, (sp) =>
        selectServiceRoleCustomers(sp, fixture)
      )
      assert.deepEqual(serviceRoleCustomers, [
        fixture.customerAId,
        fixture.customerBId,
      ])
    })
  }
)

async function asAuthenticatedUser(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

async function asServiceRoleUser(tx, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role service_role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
    }
  })
}

async function assertAnonCannotReadMaskedCustomers(tx) {
  let refused = false
  try {
    await tx.savepoint(async (sp) => {
      await sp`set local role anon`
      await sp`select set_config('request.jwt.claim.role', 'anon', true)`
      await sp`select id from public.customers_masked limit 1`
    })
  } catch (error) {
    refused = /permission denied|not allowed|must be owner/i.test(
      String(error.message)
    )
  }
  assert.ok(refused, "anon cannot read the masked customer view")
}

async function assertAuthenticatedCannotReadRawCustomerPii(tx, ownerUserId, customerId) {
  let refused = false
  try {
    await tx.savepoint(async (sp) => {
      await sp`set local role authenticated`
      await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await sp`select set_config('request.jwt.claim.sub', ${ownerUserId}, true)`
      await sp`
        select email, phone
        from public.customers
        where id = ${customerId}::uuid
      `
    })
  } catch (error) {
    refused = /permission denied|not allowed|must be owner/i.test(
      String(error.message)
    )
  }
  assert.ok(refused, "authenticated merchants cannot select raw customer PII")
}

async function selectVisibleMemberships(sp, fixture) {
  const rows = await sp`
    select id
    from public.customer_memberships
    where id in (${fixture.membershipAId}::uuid, ${fixture.membershipBId}::uuid)
    order by id
  `
  return rows.map((row) => row.id)
}

async function selectVisibleMaskedCustomers(sp, fixture) {
  const rows = await sp`
    select id, email, phone, phone_last4
    from public.customers_masked
    where id in (${fixture.customerAId}::uuid, ${fixture.customerBId}::uuid)
    order by id
  `
  return rows.map((row) => ({
    email: row.email,
    id: row.id,
    phone: row.phone,
    phone_last4: row.phone_last4,
  }))
}

async function updateOtherTenantMembership(sp, membershipId) {
  const rows = await sp`
    update public.customer_memberships
    set current_stamp_count = current_stamp_count + 1
    where id = ${membershipId}::uuid
    returning id
  `
  return rows.length
}

async function selectServiceRoleCustomers(sp, fixture) {
  const rows = await sp`
    select id
    from public.customers
    where id in (${fixture.customerAId}::uuid, ${fixture.customerBId}::uuid)
    order by case
      when id = ${fixture.customerAId}::uuid then 1
      when id = ${fixture.customerBId}::uuid then 2
      else 3
    end
  `
  return rows.map((row) => row.id)
}

async function createTenantFixture(tx) {
  const fixture = {
    customerAId: randomUUID(),
    customerAUserId: randomUUID(),
    customerBId: randomUUID(),
    customerBUserId: randomUUID(),
    membershipAId: randomUUID(),
    membershipBId: randomUUID(),
    merchantAId: randomUUID(),
    merchantBId: randomUUID(),
    outsiderUserId: randomUUID(),
    ownerAUserId: randomUUID(),
    ownerBUserId: randomUUID(),
  }

  await tx`
    insert into auth.users (id)
    values (${fixture.ownerAUserId}::uuid), (${fixture.ownerBUserId}::uuid),
      (${fixture.outsiderUserId}::uuid), (${fixture.customerAUserId}::uuid),
      (${fixture.customerBUserId}::uuid)
  `

  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email,
      status, requires_billing
    )
    values
      (
        ${fixture.merchantAId}::uuid, ${fixture.ownerAUserId}::uuid,
        'Tenant A', ${`rls-a-${fixture.merchantAId.slice(0, 8)}`}, 'pub',
        ${`rls-a-${fixture.merchantAId.slice(0, 8)}@example.test`}, 'active',
        false
      ),
      (
        ${fixture.merchantBId}::uuid, ${fixture.ownerBUserId}::uuid,
        'Tenant B', ${`rls-b-${fixture.merchantBId.slice(0, 8)}`}, 'pub',
        ${`rls-b-${fixture.merchantBId.slice(0, 8)}@example.test`}, 'active',
        false
      )
  `

  await tx`
    insert into public.customers (
      id, auth_user_id, email, phone, phone_last4, full_name, date_of_birth,
      email_verified_at
    )
    values
      (
        ${fixture.customerAId}::uuid, ${fixture.customerAUserId}::uuid,
        'alice@example.test', '+447700901001', '1001', 'Alice Tenant',
        date '1991-01-01', now()
      ),
      (
        ${fixture.customerBId}::uuid, ${fixture.customerBUserId}::uuid,
        'bob@example.test', '+447700902002', '2002', 'Bob Tenant',
        date '1992-02-02', now()
      )
  `

  await tx`
    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number
    )
    values
      (
        ${fixture.membershipAId}::uuid, ${fixture.merchantAId}::uuid,
        ${fixture.customerAId}::uuid, 0, 0, 1
      ),
      (
        ${fixture.membershipBId}::uuid, ${fixture.merchantBId}::uuid,
        ${fixture.customerBId}::uuid, 0, 0, 1
      )
  `

  return fixture
}
