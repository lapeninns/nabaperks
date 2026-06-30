import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"
import type { CustomerReadbackSeed, SeedCustomerSetupRow } from "./customer-readback-seed"

export async function insertCustomerReadbackRewards(
  sql: Sql,
  seed: CustomerReadbackSeed,
  setup: SeedCustomerSetupRow
): Promise<void> {
  await sql`
    insert into public.reward_events (
      id,
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status,
      reward_name,
      reward_terms,
      redeemable_from,
      expires_at,
      expired_at,
      redeemed_at,
      cycle_number,
      metadata,
      created_at,
      updated_at
    )
    values
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'unlocked',
        ${seed.readyRewardName},
        'Browser readback ready terms',
        public.uk_business_date(now()),
        now() + interval '14 days',
        null,
        null,
        1,
        jsonb_build_object('source', 'customer-home-readback-e2e'),
        now() - interval '4 days',
        now()
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'unlocked',
        ${seed.upcomingRewardName},
        'Browser readback upcoming terms',
        public.uk_business_date(now()) + 1,
        now() + interval '15 days',
        null,
        null,
        1,
        jsonb_build_object('source', 'customer-home-readback-e2e'),
        now() - interval '3 days',
        now()
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'redeemed',
        ${seed.redeemedRewardName},
        'Browser readback redeemed terms',
        public.uk_business_date(now()) - 2,
        now() + interval '12 days',
        null,
        now() - interval '1 day',
        1,
        jsonb_build_object('source', 'customer-home-readback-e2e'),
        now() - interval '2 days',
        now()
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'expired',
        ${seed.expiredRewardName},
        'Browser readback expired terms',
        public.uk_business_date(now()) - 3,
        now() - interval '1 day',
        now() - interval '1 day',
        null,
        1,
        jsonb_build_object('source', 'customer-home-readback-e2e'),
        now() - interval '5 days',
        now()
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.waitingCustomerId}::uuid,
        ${seed.waitingMembershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'unlocked',
        ${seed.waitingRewardName},
        'Browser dashboard waiting terms',
        public.uk_business_date(now()) + 1,
        now() + interval '15 days',
        null,
        null,
        1,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '2 days',
        now()
      )`
}

export async function insertCustomerReadbackActivity(
  sql: Sql,
  seed: CustomerReadbackSeed,
  setup: SeedCustomerSetupRow
): Promise<void> {
  await sql`
    insert into public.product_events (
      id,
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      actor_type,
      actor_id,
      metadata,
      created_at
    )
    values
      (
        ${randomUUID()}::uuid,
        'customer_joined',
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        'customer',
        ${seed.customerId},
        jsonb_build_object('source', 'customer-home-readback-e2e'),
        now() - interval '4 days'
      ),
      (
        ${randomUUID()}::uuid,
        'stamp_issued',
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        'customer',
        ${seed.customerId},
        jsonb_build_object(
          'new_stamp_count', 3,
          'email', ${seed.rawPrivateEmail}::text,
          'coordinates', '52.205,-0.119'
        ),
        now() - interval '3 days'
      ),
      (
        ${randomUUID()}::uuid,
        'reward_unlocked',
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        'customer',
        ${seed.customerId},
        jsonb_build_object(
          'reward_name', ${seed.readyRewardName}::text,
          'phone', '+447700900000'
        ),
        now() - interval '2 days'
      ),
      (
        ${randomUUID()}::uuid,
        'reward_redeemed',
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        'customer',
        ${seed.customerId},
        jsonb_build_object('reward_name', ${seed.redeemedRewardName}::text),
        now() - interval '1 day'
      )`
}
