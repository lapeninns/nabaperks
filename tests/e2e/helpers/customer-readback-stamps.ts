import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"
import type {
  CustomerReadbackSeed,
  SeedCustomerSetupRow,
} from "./customer-readback-seed"

export async function insertCustomerReadbackStampEvents(
  sql: Sql,
  seed: CustomerReadbackSeed,
  setup: SeedCustomerSetupRow
): Promise<void> {
  await sql`
    insert into public.stamp_events (
      id,
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      event_type,
      stamps_delta,
      earned_business_date,
      cycle_number,
      metadata,
      created_at
    )
    values
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 4,
        2,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '4 days'
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 3,
        2,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '3 days'
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.customerId}::uuid,
        ${seed.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 2,
        2,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '2 days'
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.waitingCustomerId}::uuid,
        ${seed.waitingMembershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 3,
        1,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '3 days'
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.waitingCustomerId}::uuid,
        ${seed.waitingMembershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 2,
        1,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '2 days'
      ),
      (
        ${randomUUID()}::uuid,
        ${setup.merchant_id}::uuid,
        ${seed.waitingCustomerId}::uuid,
        ${seed.waitingMembershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'earned',
        1,
        public.uk_business_date(now()) - 1,
        1,
        jsonb_build_object('source', 'customer-home-dashboard-e2e'),
        now() - interval '1 day'
      )`
}
