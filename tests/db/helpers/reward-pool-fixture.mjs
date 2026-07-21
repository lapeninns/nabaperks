import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { db, isLiveDbReady } from "./db.mjs"
import { ensureVerifiedCustomerEmail } from "./verified-customer-email.mjs"

export async function isRewardPoolDbReady() {
  if (!(await isLiveDbReady())) return false

  try {
    const [{ n }] = await db()`
      select count(*)::int as n
      from pg_proc
      where proname in (
        'upsert_reward_pool_item',
        'delete_reward_pool_item',
        'create_or_get_join_qr',
        'assert_reward_pool_launch_ready',
        'set_reward_pool_item_active'
      )`
    return n >= 5
  } catch {
    return false
  }
}

export async function actAsMerchantOwner(tx, ownerUserId) {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${ownerUserId}, true)`
}

export async function actAsInternalAdmin(tx, adminUserId) {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${adminUserId}, true)`
  await tx`select set_config('request.jwt.claim.aal', 'aal2', true)`
}

export async function expectRewardPoolRpcRejection(
  tx,
  action,
  pattern,
  message
) {
  let rejected = false

  try {
    await tx.savepoint(action)
  } catch (error) {
    rejected = pattern.test(String(error.message))
  }

  assert.ok(rejected, message)
}

export async function upsertRewardPoolItem(tx, fixture, overrides = {}) {
  const rewardName = overrides.rewardName ?? "Reward"
  const [row] = await tx`
    select *
    from public.upsert_reward_pool_item(
      ${fixture.merchantId}::uuid,
      ${fixture.cardId}::uuid,
      ${overrides.rewardPoolItemId ?? null}::uuid,
      ${rewardName},
      ${overrides.rewardTerms ?? "Subject to availability."},
      ${overrides.weight ?? 1},
      ${overrides.isActive ?? true},
      ${overrides.displayOrder ?? 0}
    )`
  return row
}

export async function addRewardPoolPresets(tx, fixture, presets) {
  return tx`
    select *
    from public.add_reward_pool_presets(
      ${fixture.merchantId}::uuid,
      ${fixture.cardId}::uuid,
      ${tx.json(presets)}
    )`
}

export async function createOrGetJoinQr(tx, fixture) {
  const [row] = await tx`
    select *
    from public.create_or_get_join_qr(
      ${fixture.merchantId}::uuid,
      ${fixture.cardId}::uuid
    )`
  return row
}

export async function insertIssuedRewardEvent(
  tx,
  fixture,
  rewardPoolItemId,
  rewardName = "Issued reward"
) {
  await tx`
    insert into public.reward_events (
      id,
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      status,
      reward_name,
      reward_terms,
      redeemable_from,
      created_at,
      updated_at
    )
    values (
      ${fixture.rewardEventId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid,
      ${fixture.cardId}::uuid,
      ${rewardPoolItemId}::uuid,
      'unlocked',
      ${rewardName},
      'Subject to availability.',
      public.uk_business_date(now()),
      now(),
      now()
    )`
}

export async function createRewardPoolFixture(tx) {
  const runId = randomUUID().slice(0, 8)
  const fixture = {
    adminUserId: randomUUID(),
    ownerUserId: randomUUID(),
    customerUserId: randomUUID(),
    merchantId: randomUUID(),
    locationId: randomUUID(),
    cardId: randomUUID(),
    customerId: randomUUID(),
    membershipId: randomUUID(),
    rewardEventId: randomUUID(),
  }

  await tx`
    insert into auth.users (id)
    values (${fixture.adminUserId}::uuid), (${fixture.ownerUserId}::uuid), (${fixture.customerUserId}::uuid)`

  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (
      ${fixture.adminUserId}::uuid,
      ${`reward-pool-admin-${runId}@example.test`},
      true
    )`

  await tx`
    insert into public.merchants (
      id,
      owner_user_id,
      business_name,
      business_slug,
      business_type,
      email,
      status,
      requires_billing
    )
    values (
      ${fixture.merchantId}::uuid,
      ${fixture.ownerUserId}::uuid,
      'Reward Pool DB Test',
      ${`reward-pool-${runId}`},
      'pub',
      ${`reward-pool-${runId}@example.test`},
      'active',
      false
    )`

  await tx`
    insert into public.merchant_locations (
      id,
      merchant_id,
      name,
      address,
      latitude,
      longitude,
      geofence_radius_meters,
      require_geofence,
      soft_geofence_trigger_stamp_number
    )
    values (
      ${fixture.locationId}::uuid,
      ${fixture.merchantId}::uuid,
      'Reward Pool Test Venue',
      '1 Reward Street',
      52.205,
      0.119,
      100,
      false,
      3
    )`

  await tx`
    insert into public.loyalty_cards (
      id,
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      is_active
    )
    values (
      ${fixture.cardId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid,
      'Reward Pool Test Card',
      3,
      'Surprise reward',
      'Subject to house rules.',
      true
    )`

  await tx`
    insert into public.customers (
      id,
      auth_user_id,
      email,
      full_name,
      date_of_birth,
      email_verified_at
    )
    values (
      ${fixture.customerId}::uuid,
      ${fixture.customerUserId}::uuid,
      ${`reward-pool-customer-${runId}@example.test`},
      'Reward Pool Customer',
      date '1990-01-01',
      now()
    )`

  await ensureVerifiedCustomerEmail(tx, fixture.customerId)

  await tx`
    insert into public.customer_memberships (
      id,
      merchant_id,
      customer_id,
      current_stamp_count,
      total_stamps_earned,
      active_cycle_number
    )
    values (
      ${fixture.membershipId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid,
      3,
      3,
      1
    )`

  return fixture
}

export async function cleanupRewardPoolFixture(sql, fixture) {
  await sql`
    delete from public.audit_logs
    where merchant_id = ${fixture.merchantId}::uuid
       or actor_id in (
         ${fixture.ownerUserId},
         ${fixture.adminUserId},
         ${fixture.customerUserId}
       )`
  await sql`
    delete from public.product_events
    where merchant_id = ${fixture.merchantId}::uuid
       or actor_id in (
         ${fixture.ownerUserId},
         ${fixture.adminUserId},
         ${fixture.customerUserId}
       )`
  await sql`
    delete from public.merchants
    where id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.customers
    where id = ${fixture.customerId}::uuid`
  await sql`
    delete from public.internal_admins
    where user_id = ${fixture.adminUserId}::uuid`
  await sql`
    delete from auth.users
    where id in (
      ${fixture.ownerUserId}::uuid,
      ${fixture.adminUserId}::uuid,
      ${fixture.customerUserId}::uuid
    )`

  await assertRewardPoolFixtureClean(sql, fixture)
}

export async function assertRewardPoolFixtureClean(sql, fixture) {
  const [state] = await sql`
    select
      (select count(*)::int from auth.users
       where id in (
         ${fixture.ownerUserId}::uuid,
         ${fixture.adminUserId}::uuid,
         ${fixture.customerUserId}::uuid
       )) as auth_user_count,
      (select count(*)::int from public.internal_admins
       where user_id = ${fixture.adminUserId}::uuid) as internal_admin_count,
      (select count(*)::int from public.merchants
       where id = ${fixture.merchantId}::uuid) as merchant_count,
      (select count(*)::int from public.merchant_locations
       where merchant_id = ${fixture.merchantId}::uuid) as location_count,
      (select count(*)::int from public.loyalty_cards
       where merchant_id = ${fixture.merchantId}::uuid) as card_count,
      (select count(*)::int from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid) as reward_count,
      (select count(*)::int from public.qr_codes
       where merchant_id = ${fixture.merchantId}::uuid) as qr_count,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid) as product_event_count,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid) as audit_count,
      (select count(*)::int from public.customers
       where id = ${fixture.customerId}::uuid) as customer_count,
      (select count(*)::int from public.customer_memberships
       where id = ${fixture.membershipId}::uuid) as membership_count`

  assert.deepEqual(state, {
    auth_user_count: 0,
    internal_admin_count: 0,
    merchant_count: 0,
    location_count: 0,
    card_count: 0,
    reward_count: 0,
    qr_count: 0,
    product_event_count: 0,
    audit_count: 0,
    customer_count: 0,
    membership_count: 0,
  })
}
