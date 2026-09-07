import { randomUUID } from "node:crypto"

import type { Sql } from "./admin-live-db"
import {
  createBrowserCustomerSession,
  type BrowserCustomerSession,
} from "./customer-readback-live-db"

type OwnerRow = {
  readonly owner_user_id: string
}

/**
 * A venue whose availability gate is closed from the moment it is seeded. The
 * public QR lookup is served from the data cache (60s, merchant-tagged), so a
 * mid-test SQL flip of an already-scanned merchant would not be visible to the
 * next scan; each unavailable case therefore gets its own merchant and owner.
 */
type UnavailableVenueRows = {
  readonly ownerUserId: string
  readonly merchantId: string
  readonly merchantSlug: string
  readonly locationId: string
  readonly loyaltyCardId: string
  readonly qrCodeId: string
  readonly qrId: string
  readonly merchantStatus: "active" | "paused"
  readonly billingStatus: "trialing" | "past_due"
}

type PublicQrRouterRows = {
  readonly merchantId: string
  readonly merchantSlug: string
  readonly locationId: string
  readonly loyaltyCardId: string
  readonly activeQrCodeId: string
  readonly activeQrId: string
  readonly inactiveQrCodeId: string
  readonly inactiveQrId: string
  readonly customerId: string
  readonly membershipId: string
  readonly pausedQrId: string
  readonly lapsedBillingQrId: string
  readonly unavailableVenues: readonly UnavailableVenueRows[]
}

export type PublicQrRouterFixture = PublicQrRouterRows & {
  readonly session: BrowserCustomerSession
}

export async function createPublicQrRouterFixture(
  sql: Sql
): Promise<PublicQrRouterFixture | undefined> {
  const ownerUserId = await seedDetachedOwnerUserId(sql)
  if (!ownerUserId) return undefined

  const fixtureRows = createPublicQrRouterRows()

  try {
    await insertPublicQrRouterRows(sql, fixtureRows, ownerUserId)

    return {
      ...fixtureRows,
      session: await createBrowserCustomerSession(sql, fixtureRows.customerId),
    }
  } catch (error) {
    await cleanupPublicQrRouterFixture(sql, fixtureRows)
    throw error
  }
}

export async function cleanupPublicQrRouterFixture(
  sql: Sql,
  fixture: PublicQrRouterRows | undefined
): Promise<void> {
  if (!fixture) return

  await sql`
    delete from public.product_events
    where merchant_id = ${fixture.merchantId}::uuid
       or customer_id = ${fixture.customerId}::uuid
       or membership_id = ${fixture.membershipId}::uuid
       or qr_code_id in (
         ${fixture.activeQrCodeId}::uuid,
         ${fixture.inactiveQrCodeId}::uuid
       )`
  await cleanupUnavailableVenues(sql, fixture.unavailableVenues)
  await sql`
    delete from public.customer_sessions
    where customer_id = ${fixture.customerId}::uuid`
  await sql`
    delete from public.customer_memberships
    where id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.customers
    where id = ${fixture.customerId}::uuid`
  await sql`
    delete from public.qr_codes
    where id in (
      ${fixture.activeQrCodeId}::uuid,
      ${fixture.inactiveQrCodeId}::uuid
    )`
  await sql`
    delete from public.billing_customers
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.reward_pool_items
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.loyalty_cards
    where id = ${fixture.loyaltyCardId}::uuid`
  await sql`
    delete from public.merchant_locations
    where id = ${fixture.locationId}::uuid`
  await sql`
    delete from public.merchants
    where id = ${fixture.merchantId}::uuid`
}

export function publicQrPath(qrId: string): string {
  return `/q/${encodeURIComponent(qrId)}`
}

async function cleanupUnavailableVenues(
  sql: Sql,
  venues: readonly UnavailableVenueRows[]
): Promise<void> {
  for (const venue of venues) {
    await sql`
      delete from public.product_events
      where merchant_id = ${venue.merchantId}::uuid
         or qr_code_id = ${venue.qrCodeId}::uuid`
    await sql`
      delete from public.qr_codes
      where id = ${venue.qrCodeId}::uuid`
    await sql`
      delete from public.billing_customers
      where merchant_id = ${venue.merchantId}::uuid`
    await sql`
      delete from public.reward_pool_items
      where merchant_id = ${venue.merchantId}::uuid`
    await sql`
      delete from public.loyalty_cards
      where id = ${venue.loyaltyCardId}::uuid`
    await sql`
      delete from public.merchant_locations
      where id = ${venue.locationId}::uuid`
    await sql`
      delete from public.merchants
      where id = ${venue.merchantId}::uuid`
    await sql`
      delete from auth.users
      where id = ${venue.ownerUserId}::uuid`
  }
}

async function seedDetachedOwnerUserId(sql: Sql): Promise<string | undefined> {
  const ownerRows = await sql<readonly OwnerRow[]>`
    select users.id::text as owner_user_id
    from auth.users
    where not exists (
      select 1
      from public.merchants
      where merchants.owner_user_id = users.id
    )
    order by users.email
    limit 1`

  return ownerRows.at(0)?.owner_user_id
}

function createPublicQrRouterRows(): PublicQrRouterRows {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12)
  const activeQrId = `e2e-public-${runId}`

  const paused = createUnavailableVenueRows(
    runId,
    "paused",
    "active",
    "trialing"
  )
  const lapsed = createUnavailableVenueRows(
    runId,
    "lapsed",
    "active",
    "past_due"
  )

  return {
    merchantId: randomUUID(),
    merchantSlug: `e2e-public-qr-${runId}`,
    locationId: randomUUID(),
    loyaltyCardId: randomUUID(),
    activeQrCodeId: randomUUID(),
    activeQrId,
    inactiveQrCodeId: randomUUID(),
    inactiveQrId: `e2e-public-inactive-${runId}`,
    customerId: randomUUID(),
    membershipId: randomUUID(),
    pausedQrId: paused.qrId,
    lapsedBillingQrId: lapsed.qrId,
    unavailableVenues: [paused, lapsed],
  }
}

function createUnavailableVenueRows(
  runId: string,
  label: "paused" | "lapsed",
  merchantStatus: "active" | "paused",
  billingStatus: "trialing" | "past_due"
): UnavailableVenueRows {
  return {
    ownerUserId: randomUUID(),
    merchantId: randomUUID(),
    merchantSlug: `e2e-public-qr-${label}-${runId}`,
    locationId: randomUUID(),
    loyaltyCardId: randomUUID(),
    qrCodeId: randomUUID(),
    qrId: `e2e-public-${label}-${runId}`,
    // The paused venue is inserted active and then paused, matching how a real
    // merchant reaches that state and the business-state protection trigger.
    merchantStatus: label === "paused" ? "paused" : merchantStatus,
    billingStatus,
  }
}

async function insertPublicQrRouterRows(
  sql: Sql,
  fixture: PublicQrRouterRows,
  ownerUserId: string
): Promise<void> {
  await insertMerchantRows(sql, fixture, ownerUserId)
  await insertCustomerRows(sql, fixture)
  for (const venue of fixture.unavailableVenues) {
    await insertUnavailableVenueRows(sql, venue)
  }
}

async function insertUnavailableVenueRows(
  sql: Sql,
  venue: UnavailableVenueRows
): Promise<void> {
  await sql`
    insert into auth.users (id, email)
    values (
      ${venue.ownerUserId}::uuid,
      ${`${venue.merchantSlug}-owner@example.test`}
    )`
  await sql`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email,
      phone, status, requires_billing
    )
    values (
      ${venue.merchantId}::uuid, ${venue.ownerUserId}::uuid,
      ${`Public QR E2E ${venue.merchantSlug}`}, ${venue.merchantSlug}, 'pub',
      ${`${venue.merchantSlug}@example.test`}, '+447700900322', 'active', true
    )`
  if (venue.merchantStatus !== "active") {
    await sql`
      update public.merchants
      set status = ${venue.merchantStatus}
      where id = ${venue.merchantId}::uuid`
  }
  await sql`
    insert into public.merchant_locations (
      id, merchant_id, name, address, is_primary, require_geofence
    )
    values (
      ${venue.locationId}::uuid, ${venue.merchantId}::uuid,
      'Public QR E2E Bar', '1 Browser Lane, Cambridge',
      true, false
    )`
  await sql`
    insert into public.loyalty_cards (
      id, merchant_id, location_id, card_name, stamps_required, reward_name,
      reward_terms, is_active
    )
    values (
      ${venue.loyaltyCardId}::uuid, ${venue.merchantId}::uuid,
      ${venue.locationId}::uuid, 'Public QR Browser Card', 5,
      'Mystery counter reward', 'Browser fixture terms.', true
    )`
  await sql`
    insert into public.billing_customers (
      merchant_id, stripe_customer_id, stripe_subscription_id, status
    )
    values (
      ${venue.merchantId}::uuid, ${`cus_${venue.merchantSlug}`},
      ${`sub_${venue.merchantSlug}`}, ${venue.billingStatus}
    )`
  // A join QR may only be activated once three mystery rewards exist
  // (require_three_rewards_for_join_qr), so seed the same pool as the live venue.
  await sql`
    insert into public.reward_pool_items (
      merchant_id, location_id, loyalty_card_id, reward_name, reward_terms,
      weight, is_active, display_order
    )
    values
      (${venue.merchantId}::uuid, ${venue.locationId}::uuid, ${venue.loyaltyCardId}::uuid,
       'Free drink', 'Subject to availability.', 1, true, 1),
      (${venue.merchantId}::uuid, ${venue.locationId}::uuid, ${venue.loyaltyCardId}::uuid,
       'Bar snack', 'Subject to availability.', 1, true, 2),
      (${venue.merchantId}::uuid, ${venue.locationId}::uuid, ${venue.loyaltyCardId}::uuid,
       'Mystery treat', 'Subject to availability.', 1, true, 3)`
  await sql`
    insert into public.qr_codes (
      id, qr_id, merchant_id, location_id, loyalty_card_id, destination_type,
      is_active
    )
    values (
      ${venue.qrCodeId}::uuid, ${venue.qrId},
      ${venue.merchantId}::uuid, ${venue.locationId}::uuid,
      ${venue.loyaltyCardId}::uuid, 'join', true
    )`
}

async function insertMerchantRows(
  sql: Sql,
  fixture: PublicQrRouterRows,
  ownerUserId: string
): Promise<void> {
  const runId = fixture.activeQrId.replace("e2e-public-", "")

  await sql`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email,
      phone, status, requires_billing
    )
    values (
      ${fixture.merchantId}::uuid, ${ownerUserId}::uuid,
      ${`Public QR E2E ${runId}`}, ${fixture.merchantSlug}, 'pub',
      ${`public-qr-${runId}@example.test`}, '+447700900321', 'active', true
    )`
  await sql`
    insert into public.merchant_locations (
      id, merchant_id, name, address, is_primary, require_geofence
    )
    values (
      ${fixture.locationId}::uuid, ${fixture.merchantId}::uuid,
      'Public QR E2E Bar', '1 Browser Lane, Cambridge',
      true, false
    )`
  await sql`
    insert into public.loyalty_cards (
      id, merchant_id, location_id, card_name, stamps_required, reward_name,
      reward_terms, is_active
    )
    values (
      ${fixture.loyaltyCardId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.locationId}::uuid, 'Public QR Browser Card', 5,
      'Mystery counter reward', 'Browser fixture terms.', true
    )`
  await sql`
    insert into public.billing_customers (
      merchant_id, stripe_customer_id, stripe_subscription_id, status
    )
    values (
      ${fixture.merchantId}::uuid, ${`cus_public_qr_${runId}`},
      ${`sub_public_qr_${runId}`}, 'trialing'
    )`
  await sql`
    insert into public.reward_pool_items (
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      weight,
      is_active,
      display_order
    )
    values
      (
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.loyaltyCardId}::uuid,
        'Free drink',
        'Subject to availability.',
        1,
        true,
        1
      ),
      (
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.loyaltyCardId}::uuid,
        'Bar snack',
        'Subject to availability.',
        1,
        true,
        2
      ),
      (
        ${fixture.merchantId}::uuid,
        ${fixture.locationId}::uuid,
        ${fixture.loyaltyCardId}::uuid,
        'Mystery treat',
        'Subject to availability.',
        1,
        true,
        3
      )`
  await sql`
    insert into public.qr_codes (
      id, qr_id, merchant_id, location_id, loyalty_card_id, destination_type,
      is_active
    )
    values
      (
        ${fixture.activeQrCodeId}::uuid, ${fixture.activeQrId},
        ${fixture.merchantId}::uuid, ${fixture.locationId}::uuid,
        ${fixture.loyaltyCardId}::uuid, 'join', true
      ),
      (
        ${fixture.inactiveQrCodeId}::uuid, ${fixture.inactiveQrId},
        ${fixture.merchantId}::uuid, ${fixture.locationId}::uuid,
        ${fixture.loyaltyCardId}::uuid, 'join', false
      )`
}

async function insertCustomerRows(
  sql: Sql,
  fixture: PublicQrRouterRows
): Promise<void> {
  const runId = fixture.activeQrId.replace("e2e-public-", "")

  await sql`
    insert into public.customers (
      id, email, full_name, date_of_birth, email_verified_at
    )
    values (
      ${fixture.customerId}::uuid,
      ${`public-qr-customer-${runId}@example.test`},
      'Public QR Browser Customer', date '1990-01-01', now()
    )`
  await sql`
    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
      active_cycle_number
    )
    values (
      ${fixture.membershipId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid, 1, 1, 1
    )`
}
