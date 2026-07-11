import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { verifyCustomerDeviceToken } from "@/lib/security/customer-device-token"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRateLimitBuckets,
  publicQrRateLimitBucketKeys,
  publicQrRateLimitHeaders,
  publicQrRateLimitIdentities,
  seedPublicQrRateLimitBuckets,
} from "./helpers/public-qr-router-rate-limit"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  publicQrPath,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

test.describe("@customer-flow public QR router live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("routes disposable QR scans by availability, membership, and billing", async ({
    context,
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    let rateLimitBucketKeys: readonly string[] = []

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await context.setExtraHTTPHeaders(publicQrRateLimitHeaders(fixture))
      await expectNewCustomerRedirect(page, fixture)
      const identities = await publicQrRateLimitIdentityForContext(
        context,
        fixture
      )
      rateLimitBucketKeys = publicQrRateLimitBucketKeys(fixture, identities)

      await installCustomerSession(context, fixture)
      await expectExistingMemberRedirect(page, fixture)

      await expectUnavailableQr(page, fixture.inactiveQrId)

      await pauseMerchant(sql, fixture)
      await expectUnavailableQr(page, fixture.activeQrId)

      await activateMerchant(sql, fixture)
      await lapseBilling(sql, fixture)
      await expectUnavailableQr(page, fixture.activeQrId)
    } finally {
      await cleanupPublicQrRateLimitBuckets(sql, rateLimitBucketKeys)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("rate-limits repeated scans for a disposable public QR", async ({
    context,
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    let rateLimitBucketKeys: readonly string[] = []

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await context.setExtraHTTPHeaders(publicQrRateLimitHeaders(fixture))
      await expectNewCustomerRedirect(page, fixture)
      const identities = await publicQrRateLimitIdentityForContext(
        context,
        fixture
      )
      rateLimitBucketKeys = publicQrRateLimitBucketKeys(fixture, identities)
      await seedPublicQrRateLimitBuckets(sql, fixture, identities)
      await expectRateLimitedQr(page, fixture)
    } finally {
      await cleanupPublicQrRateLimitBuckets(sql, rateLimitBucketKeys)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})

async function expectNewCustomerRedirect(
  page: Page,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await page.goto(publicQrPath(fixture.activeQrId))

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === `/m/${fixture.merchantSlug}/join` &&
      url.searchParams.get("qr") === fixture.activeQrId
    )
  })
}

async function expectExistingMemberRedirect(
  page: Page,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await page.goto(publicQrPath(fixture.activeQrId))

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === `/card/${fixture.membershipId}/stamp` &&
      url.searchParams.get("qr") === fixture.activeQrId
    )
  })
}

async function expectUnavailableQr(page: Page, qrId: string): Promise<void> {
  const response = await page.goto(publicQrPath(qrId))

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole("heading", {
      name: "This loyalty card is unavailable",
    })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Scan a QR" })).toHaveAttribute(
    "href",
    "/scan"
  )
  await expect(
    page.getByRole("link", { name: "Open my cards" })
  ).toHaveAttribute("href", "/home")
}

async function publicQrRateLimitIdentityForContext(
  context: BrowserContext,
  fixture: PublicQrRouterFixture
): Promise<ReturnType<typeof publicQrRateLimitIdentities>> {
  const cookie = (await context.cookies()).find(
    ({ name }) => name === "nabaperks_device"
  )
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  const deviceId =
    cookie && secret
      ? verifyCustomerDeviceToken(cookie.value, secret)
      : cookie?.value
  if (!deviceId) {
    throw new Error("Public QR test did not receive a customer device token.")
  }
  return publicQrRateLimitIdentities(fixture, deviceId)
}

async function expectRateLimitedQr(
  page: Page,
  fixture: PublicQrRouterFixture
): Promise<void> {
  const response = await page.goto(publicQrPath(fixture.activeQrId))

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole("heading", { name: "Too many scans just now" })
  ).toBeVisible()
}

async function installCustomerSession(
  context: BrowserContext,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await context.addCookies([
    {
      name: fixture.session.cookieName,
      value: fixture.session.cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: fixture.session.expiresAt,
    },
  ])
}

async function pauseMerchant(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await sql`
    update public.merchants
    set status = 'paused'
    where id = ${fixture.merchantId}::uuid`
}

async function activateMerchant(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await sql`
    update public.merchants
    set status = 'active'
    where id = ${fixture.merchantId}::uuid`
}

async function lapseBilling(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await sql`
    update public.billing_customers
    set status = 'past_due'
    where merchant_id = ${fixture.merchantId}::uuid`
}
