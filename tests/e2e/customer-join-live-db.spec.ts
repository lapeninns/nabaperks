import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { parsePhoneNumberFromString } from "libphonenumber-js"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  publicQrPath,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

const DEV_OTP = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"

type DisposablePhone = {
  readonly national: string
  readonly last4: string
}

type JoinedMembershipRow = {
  readonly customer_id: string
  readonly membership_id: string
  readonly current_stamp_count: number
  readonly total_stamps_earned: number
  readonly stamp_count: number
  readonly join_event_count: number
}

type CustomerIdRow = {
  readonly customer_id: string
}

test.describe("@customer-flow customer join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("joins from a disposable QR through OTP and records the first stamp", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await page.goto(publicQrPath(fixture.activeQrId))
      await expect(
        page.getByRole("heading", { name: "Keep your card on your phone" })
      ).toBeVisible()

      await page.getByRole("link", { name: "Get today's stamp" }).click()
      await expect(
        page.getByRole("heading", { name: "Save your card to your number" })
      ).toBeVisible()

      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Text me the code" }).click()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await expect(page.locator("#otp")).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Use a different number" })
      ).toHaveAttribute(
        "href",
        `/m/${fixture.merchantSlug}/join?qr=${encodeURIComponent(
          fixture.activeQrId
        )}&step=phone`
      )

      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Save my card" }).click()
      await expect(
        page.getByRole("heading", { name: "Collect your first stamp" })
      ).toBeVisible()

      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            url.searchParams.get("stamp") === "issued"
        ),
        page.getByRole("button", { name: "Get my first stamp" }).click(),
      ])

      const joined = await readJoinedMembership(sql, fixture, phone.last4)
      if (!joined) {
        throw new Error("Join did not create a disposable membership.")
      }
      expect(joined.current_stamp_count).toBe(1)
      expect(joined.total_stamps_earned).toBe(1)
      expect(joined.stamp_count).toBe(1)
      expect(joined.join_event_count).toBe(1)
      expect(new URL(page.url()).pathname).toBe(`/card/${joined.membership_id}`)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})

function disposableUkMobile(): DisposablePhone {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const digits = randomUUID().replace(/\D/g, "").padEnd(8, "0").slice(0, 8)
    const national = `074${digits}`
    const parsed = parsePhoneNumberFromString(national, "GB")

    if (parsed?.isValid()) {
      return {
        national,
        last4: parsed.number.replace(/\D/g, "").slice(-4),
      }
    }
  }

  return { national: "07400123456", last4: "3456" }
}

async function readJoinedMembership(
  sql: Sql,
  fixture: PublicQrRouterFixture,
  phoneLast4: string
): Promise<JoinedMembershipRow | undefined> {
  const rows = await sql<readonly JoinedMembershipRow[]>`
    select
      customers.id::text as customer_id,
      customer_memberships.id::text as membership_id,
      customer_memberships.current_stamp_count::int,
      customer_memberships.total_stamps_earned::int,
      (
        select count(*)::int
        from public.stamp_events
        where stamp_events.membership_id = customer_memberships.id
          and stamp_events.event_type = 'earned'
      ) as stamp_count,
      (
        select count(*)::int
        from public.product_events
        where product_events.membership_id = customer_memberships.id
          and product_events.event_name = 'customer_joined'
      ) as join_event_count
    from public.customer_memberships
    join public.customers
      on customers.id = customer_memberships.customer_id
    where customer_memberships.merchant_id = ${fixture.merchantId}::uuid
      and customers.phone_last4 = ${phoneLast4}
    order by customer_memberships.created_at desc
    limit 1`

  return rows.at(0)
}

async function cleanupCustomerJoinRows(
  sql: Sql,
  fixture: PublicQrRouterFixture | undefined
): Promise<void> {
  if (!fixture) return

  const customerRows = await sql<readonly CustomerIdRow[]>`
    select distinct customer_id::text
    from public.customer_memberships
    where merchant_id = ${fixture.merchantId}::uuid`

  await sql`
    delete from public.customer_sessions
    where customer_id in (
      select customer_id
      from public.customer_memberships
      where merchant_id = ${fixture.merchantId}::uuid
    )`
  await sql`
    delete from public.consent_records
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.product_events
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.reward_events
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.stamp_events
    where merchant_id = ${fixture.merchantId}::uuid`
  await sql`
    delete from public.customer_memberships
    where merchant_id = ${fixture.merchantId}::uuid`

  for (const row of customerRows) {
    await sql`
      delete from public.customers
      where id = ${row.customer_id}::uuid`
  }
}
