import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"
import {
  insertCustomerReadbackActivity,
  insertCustomerReadbackRewards,
} from "./customer-readback-events"

const SEED_MERCHANT_SLUG = "old-crown-girton"

export type SeedCustomerSetupRow = {
  readonly merchant_id: string
  readonly business_name: string
  readonly loyalty_card_id: string
}

export type CustomerReadbackSeed = {
  readonly customerId: string
  readonly emptyCustomerId: string
  readonly membershipId: string
  readonly businessName: string
  readonly rawPrivateEmail: string
  readonly readyRewardName: string
  readonly upcomingRewardName: string
  readonly redeemedRewardName: string
  readonly expiredRewardName: string
}

export async function pickSeedCustomerSetup(
  sql: Sql
): Promise<SeedCustomerSetupRow | undefined> {
  const rows = await sql<readonly SeedCustomerSetupRow[]>`
    select
      merchants.id::text as merchant_id,
      merchants.business_name,
      loyalty_cards.id::text as loyalty_card_id
    from public.merchants
    join public.merchant_locations
      on merchant_locations.merchant_id = merchants.id
     and merchant_locations.is_primary
    join public.loyalty_cards
      on loyalty_cards.merchant_id = merchants.id
     and loyalty_cards.location_id = merchant_locations.id
     and loyalty_cards.is_active
    where merchants.business_slug = ${SEED_MERCHANT_SLUG}
      and merchants.status in ('trial', 'active')
    order by loyalty_cards.created_at asc
    limit 1`

  return rows.at(0)
}

export async function insertCustomerReadbackRows(
  sql: Sql,
  seed: CustomerReadbackSeed,
  setup: SeedCustomerSetupRow,
  runId: string
): Promise<void> {
  await insertCustomers(sql, seed, runId)
  await insertMembership(sql, seed, setup)
  await insertCustomerReadbackRewards(sql, seed, setup)
  await insertCustomerReadbackActivity(sql, seed, setup)
}

export async function cleanupCustomerReadbackRows(
  sql: Sql,
  fixture: CustomerReadbackSeed | undefined
): Promise<void> {
  if (!fixture) return

  await sql`
    delete from public.product_events
    where customer_id in (
      ${fixture.customerId}::uuid,
      ${fixture.emptyCustomerId}::uuid
    )
       or membership_id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.reward_events
    where customer_id in (
      ${fixture.customerId}::uuid,
      ${fixture.emptyCustomerId}::uuid
    )
       or membership_id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.customer_sessions
    where customer_id in (
      ${fixture.customerId}::uuid,
      ${fixture.emptyCustomerId}::uuid
    )`
  await sql`
    delete from public.customer_memberships
    where id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.customers
    where id in (${fixture.customerId}::uuid, ${fixture.emptyCustomerId}::uuid)`
}

async function insertCustomers(
  sql: Sql,
  seed: CustomerReadbackSeed,
  runId: string
): Promise<void> {
  await sql`
    insert into public.customers (
      id,
      email,
      full_name,
      date_of_birth,
      email_verified_at
    )
    values
      (
        ${seed.customerId}::uuid,
        ${seed.rawPrivateEmail},
        'Customer Readback Browser',
        date '1990-01-01',
        now()
      ),
      (
        ${seed.emptyCustomerId}::uuid,
        ${`empty-readback-${runId}@example.test`},
        'Empty Readback Browser',
        date '1990-01-01',
        now()
      )`
}

async function insertMembership(
  sql: Sql,
  seed: CustomerReadbackSeed,
  setup: SeedCustomerSetupRow
): Promise<void> {
  await sql`
    insert into public.customer_memberships (
      id,
      merchant_id,
      customer_id,
      current_stamp_count,
      total_stamps_earned,
      total_rewards_redeemed,
      active_cycle_number
    )
    values (
      ${seed.membershipId}::uuid,
      ${setup.merchant_id}::uuid,
      ${seed.customerId}::uuid,
      3,
      5,
      1,
      2
    )`
}

export function createCustomerReadbackSeed(
  setup: SeedCustomerSetupRow
): { readonly seed: CustomerReadbackSeed; readonly runId: string } {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12)

  return {
    runId,
    seed: {
      customerId: randomUUID(),
      emptyCustomerId: randomUUID(),
      membershipId: randomUUID(),
      businessName: setup.business_name,
      rawPrivateEmail: `private-${runId}@example.test`,
      readyRewardName: `Ready readback reward ${runId}`,
      upcomingRewardName: `Upcoming readback reward ${runId}`,
      redeemedRewardName: `Redeemed readback reward ${runId}`,
      expiredRewardName: `Expired readback reward ${runId}`,
    },
  }
}
