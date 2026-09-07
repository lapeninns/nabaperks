import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"

const SEED_MERCHANT_SLUG = "old-crown-girton"

export type VenueCodeFixture = {
  readonly customerId: string
  readonly membershipId: string
  readonly merchantId: string
  readonly locationId: string
  readonly qrId: string
  readonly stampsRequired: number
  readonly restore: {
    readonly requireGeofence: boolean | null
    readonly softGeofenceTriggerStampNumber: number | null
  }
}

/**
 * A member of the seeded venue on their second visit, at a venue that verifies
 * location from visit two — so the very next scan meets the location gate.
 * The venue's own settings are captured and restored by the cleanup.
 */
export async function createVenueCodeFixture(
  sql: Sql
): Promise<VenueCodeFixture | undefined> {
  const rows = await sql<
    readonly {
      merchant_id: string
      location_id: string
      loyalty_card_id: string
      qr_id: string
      stamps_required: number
      require_geofence: boolean | null
      soft_geofence_trigger_stamp_number: number | null
    }[]
  >`
    select
      merchants.id::text as merchant_id,
      merchant_locations.id::text as location_id,
      loyalty_cards.id::text as loyalty_card_id,
      qr_codes.qr_id,
      loyalty_cards.stamps_required::int as stamps_required,
      merchant_locations.require_geofence,
      merchant_locations.soft_geofence_trigger_stamp_number::int
    from public.merchants
    join public.loyalty_cards
      on loyalty_cards.merchant_id = merchants.id
     and loyalty_cards.is_active
    join public.merchant_locations
      on merchant_locations.id = loyalty_cards.location_id
    join public.qr_codes
      on qr_codes.merchant_id = merchants.id
     and qr_codes.loyalty_card_id = loyalty_cards.id
     and qr_codes.destination_type = 'join'
     and qr_codes.is_active
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
  const fixture: VenueCodeFixture = {
    customerId: randomUUID(),
    membershipId: randomUUID(),
    merchantId: setup.merchant_id,
    locationId: setup.location_id,
    qrId: setup.qr_id,
    stampsRequired: setup.stamps_required,
    restore: {
      requireGeofence: setup.require_geofence,
      softGeofenceTriggerStampNumber: setup.soft_geofence_trigger_stamp_number,
    },
  }

  try {
    await sql`
      update public.merchant_locations
      set require_geofence = true, soft_geofence_trigger_stamp_number = 2
      where id = ${fixture.locationId}::uuid`

    await sql`
      insert into public.customers (id, email, full_name, date_of_birth, email_verified_at)
      values (
        ${fixture.customerId}::uuid,
        ${`venue-code-${runId}@example.test`},
        'Venue Code Browser',
        date '1990-01-01',
        now()
      )`

    await sql`
      insert into public.customer_memberships (
        id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
        active_cycle_number, last_visit_at
      )
      values (
        ${fixture.membershipId}::uuid, ${fixture.merchantId}::uuid,
        ${fixture.customerId}::uuid, 1, 1, 1, now() - interval '1 day'
      )`

    // Visit one, yesterday: the next scan is visit two and meets the gate.
    await sql`
      insert into public.stamp_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata, created_at
      )
      values (
        ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${setup.loyalty_card_id}::uuid,
        ${fixture.locationId}::uuid, 'earned', 1,
        (now() at time zone 'Europe/London')::date - 1, 1,
        '{"source":"self_service_qr","geo_verification":"exempt","visit_number":1}'::jsonb,
        now() - interval '1 day'
      )`
  } catch (error) {
    await cleanupVenueCodeFixture(sql, fixture)
    throw error
  }

  return fixture
}

/** Today's six-digit code for the fixture's venue, as the owner would read it. */
export async function readVenueCode(
  sql: Sql,
  fixture: VenueCodeFixture
): Promise<string> {
  const [row] = await sql<readonly { code: string }[]>`
    select private.venue_code_for(${fixture.merchantId}::uuid) as code`
  if (!row?.code) throw new Error("Venue code could not be derived")
  return row.code
}

export async function readVenueCodeStampState(
  sql: Sql,
  fixture: VenueCodeFixture
) {
  const [stamps] = await sql<readonly { n: number; venue_code: number }[]>`
    select
      count(*)::int as n,
      count(*) filter (where metadata->>'geo_verification' = 'venue_code')::int as venue_code
    from public.stamp_events
    where membership_id = ${fixture.membershipId}::uuid and event_type = 'earned'`
  const [receipts] = await sql<readonly { n: number }[]>`
    select count(*)::int as n from public.venue_code_stamp_receipts
    where membership_id = ${fixture.membershipId}::uuid and stamp_event_id is not null`
  const [flags] = await sql<readonly { reviewed: number }[]>`
    select count(*) filter (where status = 'reviewed')::int as reviewed
    from public.fraud_flags
    where membership_id = ${fixture.membershipId}::uuid
      and signal = 'self_service_geofence_out_of_range'`
  return {
    earned: stamps?.n ?? 0,
    venueCodeStamps: stamps?.venue_code ?? 0,
    linkedReceipts: receipts?.n ?? 0,
    reviewedRefusals: flags?.reviewed ?? 0,
  }
}

export async function cleanupVenueCodeFixture(
  sql: Sql,
  fixture: VenueCodeFixture | undefined
): Promise<void> {
  if (!fixture) return

  await sql`
    update public.merchant_locations
    set require_geofence = ${fixture.restore.requireGeofence},
        soft_geofence_trigger_stamp_number = ${fixture.restore.softGeofenceTriggerStampNumber}
    where id = ${fixture.locationId}::uuid`
  await sql`delete from public.venue_code_stamp_receipts
            where membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.venue_code_attempt_lockouts
            where membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.fraud_flags
            where membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.product_events
            where customer_id = ${fixture.customerId}::uuid
               or membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.audit_logs
            where customer_id = ${fixture.customerId}::uuid`
  await sql`delete from public.reward_events
            where membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.stamp_events
            where membership_id = ${fixture.membershipId}::uuid`
  await sql`delete from public.customer_sessions
            where customer_id = ${fixture.customerId}::uuid`
  await sql`delete from public.customer_memberships
            where id = ${fixture.membershipId}::uuid`
  await sql`delete from public.customers
            where id = ${fixture.customerId}::uuid`
}
