import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { db, isLiveDbReady } from "./db.mjs"

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
        'assert_reward_pool_launch_ready'
      )`
    return n >= 4
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
