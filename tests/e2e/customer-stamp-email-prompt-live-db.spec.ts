import { randomBytes, randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import type { Sql } from "./helpers/admin-live-db"
import {
  connectCustomerReadbackDb,
  customerReadbackLiveDbSkipReason,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import { installRewardCustomerSession } from "./helpers/reward-id-check-sessions"

/**
 * The stamp result owns the stamp screen (guest journey redesign, brief S2):
 * a phone-only member on a later visit stamps on the real stamp screen and
 * sees "Stamp added.", the updated progress and when the next stamp opens,
 * with no "Add your email" card or other contact prompt stacked on it. The
 * optional email suggestion now waits for /home. This replaces the QA BUG-020
 * check that the prompt appeared here.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET.
 */

const SEED_MERCHANT_SLUG = "old-crown-girton"

type StampPromptFixture = {
  readonly customerId: string
  readonly membershipId: string
  readonly locationId: string
  readonly qrId: string
  readonly stampsRequired: number
  readonly restoreRequireGeofence: boolean | null
}

test.describe("@customer-flow post-stamp email prompt (live database)", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test("a phone-only member's stamp result stands alone on the stamp screen", async ({
    context,
    page,
    baseURL,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql || !baseURL, "local Supabase DB is not configured")
    if (!sql || !baseURL) return

    let fixture: StampPromptFixture | undefined
    try {
      fixture = await seedPhoneOnlyMember(sql)
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return

      await dismissPwaInstall(page)
      await installRewardCustomerSession(
        sql,
        context,
        fixture.customerId,
        baseURL
      )

      await page.goto(`/card/${fixture.membershipId}/stamp?qr=${fixture.qrId}`)
      const root = page.locator("[data-stamp-phase]")
      await expect(root).toHaveAttribute("data-stamp-phase", "idle")
      // Nothing is asked before the stamp.
      await expect(page.getByTestId("email-prompt")).toHaveCount(0)

      await root.getByRole("button", { name: "Stamp my card" }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(
        page.getByRole("heading", { level: 1, name: "Stamp added." })
      ).toBeVisible()
      await expect(root.locator("[data-stamp-receipt]")).toHaveText(
        `2 OF ${fixture.stampsRequired}`
      )
      await expect(root.getByText(/^Next stamp from /)).toBeVisible()

      // Nothing competes with the stamp, including after the refresh the
      // stamp action triggers.
      await page.waitForLoadState("networkidle")
      await expect(page.getByTestId("email-prompt")).toHaveCount(0)

      await expect(countEarnedStamps(sql, fixture)).resolves.toBe(2)
    } finally {
      await cleanupFixture(sql, fixture)
      await sql.end({ timeout: 5 })
    }
  })
})

// A phone-only member (no email) of the seeded venue with a stamp two days
// ago (clear of any trading-day cut-off), at a venue that asks for no
// location, so the next scan stamps directly.
async function seedPhoneOnlyMember(
  sql: Sql
): Promise<StampPromptFixture | undefined> {
  const rows = await sql<
    readonly {
      merchant_id: string
      location_id: string
      loyalty_card_id: string
      qr_id: string
      stamps_required: number
      require_geofence: boolean | null
    }[]
  >`
    select
      merchants.id::text as merchant_id,
      merchant_locations.id::text as location_id,
      loyalty_cards.id::text as loyalty_card_id,
      qr_codes.qr_id,
      loyalty_cards.stamps_required::int as stamps_required,
      merchant_locations.require_geofence
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
    order by loyalty_cards.created_at asc
    limit 1`
  const setup = rows.at(0)
  if (!setup || setup.stamps_required < 3) return undefined

  const fixture: StampPromptFixture = {
    customerId: randomUUID(),
    membershipId: randomUUID(),
    locationId: setup.location_id,
    qrId: setup.qr_id,
    stampsRequired: setup.stamps_required,
    restoreRequireGeofence: setup.require_geofence,
  }

  try {
    await sql`
      update public.merchant_locations
      set require_geofence = false
      where id = ${fixture.locationId}::uuid`
    await sql`
      insert into public.customers (
        id, phone_hmac, phone_last4, full_name, date_of_birth
      )
      values (
        ${fixture.customerId}::uuid,
        ${randomBytes(32).toString("hex")},
        '0000',
        'Stamp Prompt Browser',
        date '1990-01-01'
      )`
    await sql`
      insert into public.customer_memberships (
        id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
        active_cycle_number, last_visit_at
      )
      values (
        ${fixture.membershipId}::uuid, ${setup.merchant_id}::uuid,
        ${fixture.customerId}::uuid, 1, 1, 1, now() - interval '2 days'
      )`
    await sql`
      insert into public.stamp_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata, created_at
      )
      values (
        ${setup.merchant_id}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${setup.loyalty_card_id}::uuid,
        ${fixture.locationId}::uuid, 'earned', 1,
        (now() at time zone 'Europe/London')::date - 2, 1,
        '{"source":"self_service_qr","geo_verification":"exempt","visit_number":1}'::jsonb,
        now() - interval '2 days'
      )`
  } catch (error) {
    await cleanupFixture(sql, fixture)
    throw error
  }
  return fixture
}

async function countEarnedStamps(
  sql: Sql,
  fixture: StampPromptFixture
): Promise<number> {
  const [row] = await sql<readonly { n: number }[]>`
    select count(*)::int as n from public.stamp_events
    where membership_id = ${fixture.membershipId}::uuid
      and event_type = 'earned'`
  return row?.n ?? 0
}

async function cleanupFixture(
  sql: Sql,
  fixture: StampPromptFixture | undefined
): Promise<void> {
  if (!fixture) return
  await sql`
    update public.merchant_locations
    set require_geofence = ${fixture.restoreRequireGeofence}
    where id = ${fixture.locationId}::uuid`
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
