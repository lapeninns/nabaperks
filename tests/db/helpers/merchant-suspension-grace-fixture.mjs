import { randomUUID } from "node:crypto"

import { actAsActivatedInternalAdmin } from "./admin-auth.mjs"
import { db, isLiveDbReady } from "./db.mjs"
import { createRewardPoolFixture } from "./reward-pool-fixture.mjs"

export async function isSuspensionGraceReady() {
  if (!(await isLiveDbReady())) return false
  const [{ n }] = await db()`
    select count(*)::int as n
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.proname in (
        'admin_suspend_merchant',
        'admin_reinstate_merchant',
        'merchant_suspended_at',
        'reward_in_suspension_grace'
      )`
  return n === 4
}

export async function setServiceRole(tx) {
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
  await tx`select set_config('request.jwt.claim.sub', '', true)`
  await tx`select set_config('request.jwt.claims', '', true)`
}

export async function createSuspensionGraceFixture(tx) {
  const fixture = await createRewardPoolFixture(tx)
  fixture.rewardPoolItemId = randomUUID()

  await tx`
    update public.merchants
    set requires_billing = true
    where id = ${fixture.merchantId}::uuid`
  await tx`
    insert into public.billing_customers (
      merchant_id, stripe_customer_id, stripe_subscription_id, status,
      stripe_state_event_created_at, stripe_state_event_id
    ) values (
      ${fixture.merchantId}::uuid,
      ${`cus_${fixture.merchantId.replaceAll("-", "")}`},
      ${`sub_${fixture.merchantId.replaceAll("-", "")}`},
      'active', now() - interval '20 days', ${`evt_${randomUUID()}`}
    )`
  await tx`
    insert into public.reward_pool_items (
      id, merchant_id, location_id, loyalty_card_id, reward_name,
      reward_terms, weight, is_active, display_order, requires_age_check
    ) values (
      ${fixture.rewardPoolItemId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid, ${fixture.cardId}::uuid,
      'Grace reward', 'Subject to availability.', 1, true, 1, false
    )`
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      reward_pool_item_id, reward_name, reward_terms, redeemable_from,
      available_from, expires_at, status, source, cycle_number,
      reward_policy_version, reward_policy_snapshot, created_at, updated_at
    ) values (
      ${fixture.rewardEventId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid, ${fixture.membershipId}::uuid,
      ${fixture.cardId}::uuid, ${fixture.rewardPoolItemId}::uuid,
      'Grace reward', 'Subject to availability.',
      public.uk_business_date(now() - interval '10 days'),
      now() - interval '9 days', now() + interval '20 days',
      'unlocked', 'merchant_direct', null, 'v2',
      jsonb_build_object('age_check', false),
      now() - interval '10 days', now() - interval '10 days'
    )`
  await tx`
    update public.reward_events
    set available_from = now() - interval '9 days',
        expires_at = now() + interval '20 days',
        created_at = now() - interval '10 days'
    where id = ${fixture.rewardEventId}::uuid`
  return fixture
}

export async function suspendAsAdmin(tx, fixture, reason = "Policy review") {
  await actAsActivatedInternalAdmin(tx, fixture.adminUserId)
  await tx`select public.admin_suspend_merchant(${fixture.merchantId}::uuid, ${reason})`
}
