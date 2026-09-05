import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"

const SEED_MERCHANT_SLUG = "old-crown-girton"

export type RewardCollectionFixture = {
  readonly customerId: string
  readonly membershipId: string
  readonly rewardEventId: string
  readonly scanToken: string
  readonly rewardName: string
}

export type RewardCollectionDbState = {
  readonly reward_status: string
  readonly consumed: boolean
  readonly next_cycle_count: number
}

type SeedRewardSetupRow = {
  readonly merchant_id: string
  readonly loyalty_card_id: string
  readonly stamps_required: number
}

export async function createRewardCollectionFixture(
  sql: Sql,
  options: { unverified?: boolean } = {}
): Promise<RewardCollectionFixture | undefined> {
  const rows = await sql<readonly SeedRewardSetupRow[]>`
    select
      merchants.id::text as merchant_id,
      loyalty_cards.id::text as loyalty_card_id,
      loyalty_cards.stamps_required::int as stamps_required
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
      and (
        merchants.requires_billing = false
        or exists (
          select 1
          from public.billing_customers
          where billing_customers.merchant_id = merchants.id
            and billing_customers.status in ('trial', 'active')
        )
      )
    order by loyalty_cards.created_at asc
    limit 1`

  const setup = rows.at(0)
  if (!setup) return undefined

  const runId = randomUUID().replaceAll("-", "").slice(0, 12)
  const fixture: RewardCollectionFixture = {
    customerId: randomUUID(),
    membershipId: randomUUID(),
    rewardEventId: randomUUID(),
    scanToken: "",
    rewardName: `E2E collection ${runId}`,
  }

  try {
    await sql`
      insert into public.customers (
        id,
        email,
        full_name,
        date_of_birth,
        email_verified_at
      )
      values (
        ${fixture.customerId}::uuid,
        ${`reward-scan-${runId}@example.test`},
        'Reward Scan Browser',
        date '1990-01-01',
        now()
      )`

    await sql`
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
        ${setup.merchant_id}::uuid,
        ${fixture.customerId}::uuid,
        ${setup.stamps_required},
        ${setup.stamps_required},
        1
      )`

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
        metadata,
        created_at,
        updated_at
      )
      values (
        ${fixture.rewardEventId}::uuid,
        ${setup.merchant_id}::uuid,
        ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'unlocked',
        ${fixture.rewardName},
        'Browser collection fixture',
        public.uk_business_date(now()),
        jsonb_build_object('source', 'merchant-reward-scan-e2e'),
        now(),
        now()
      )`

    await sql`
      update public.customers
      set email_hmac = coalesce(
        email_hmac,
        encode(extensions.digest(lower(email), 'sha256'), 'hex')
      )
      where id = ${fixture.customerId}::uuid`

    if (options.unverified) {
      await sql`
        update public.customers
        set date_of_birth_verified_at = null,
            date_of_birth_verification_source = null,
            date_of_birth_verified_by = null
        where id = ${fixture.customerId}::uuid`
    }

    const mintedRows = await sql<readonly { readonly scan_token: string }[]>`
      select scan_token::text
      from public.create_reward_scan_token(
        ${fixture.rewardEventId}::uuid,
        ${fixture.customerId}::uuid
      )`

    const scanToken = mintedRows.at(0)?.scan_token
    if (!scanToken) {
      throw new Error("Reward scan token was not minted")
    }

    return { ...fixture, scanToken }
  } catch (error) {
    await cleanupRewardCollectionFixture(sql, fixture)
    throw error
  }
}

export async function readRewardCollectionState(
  sql: Sql,
  rewardEventId: string
): Promise<RewardCollectionDbState | undefined> {
  const rows = await sql<readonly RewardCollectionDbState[]>`
    select
      reward_events.status as reward_status,
      reward_scan_tokens.consumed_at is not null as consumed,
      customer_memberships.current_stamp_count::int as next_cycle_count
    from public.reward_events
    join public.reward_scan_tokens
      on reward_scan_tokens.reward_event_id = reward_events.id
    join public.customer_memberships
      on customer_memberships.id = reward_events.membership_id
    where reward_events.id = ${rewardEventId}::uuid`

  return rows.at(0)
}

export async function cleanupRewardCollectionFixture(
  sql: Sql,
  fixture: RewardCollectionFixture | undefined
): Promise<void> {
  if (!fixture) return

  await sql`
    delete from public.product_events
    where customer_id = ${fixture.customerId}::uuid
       or membership_id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.reward_events
    where id = ${fixture.rewardEventId}::uuid`
  await sql`
    delete from public.customer_memberships
    where id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.customers
    where id = ${fixture.customerId}::uuid`
}
