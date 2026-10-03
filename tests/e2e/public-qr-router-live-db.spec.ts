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
const REACTIVATION_ROUNDS = 3

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

      await expectUnavailableQr(page, fixture.inactiveQrId, true)

      // Paused-merchant and lapsed-billing venues are seeded closed rather than
      // flipped mid-test: the public QR lookup is served from a 60s data cache
      // keyed by merchant, and a direct SQL flip fires no revalidation tag.
      await expectUnavailableQr(page, fixture.pausedQrId)
      await expectUnavailableQr(page, fixture.lapsedBillingQrId)
      // An id the database does not know is unavailable, not a load failure.
      await expectUnavailableQr(page, `${fixture.inactiveQrId}-unknown`)
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

  // QA BUG-041 (38c42a1..2c45031): the /q lookup is served from the data
  // cache, and the "unavailable" entry written while a QR was off was served
  // again once it came back on (fresh inside its window, or stale after a
  // "max" tag revalidation), so a member was told the card was unavailable.
  // Each round caches a switched-off QR's answer, switches it on (and the
  // venue's other join QR off, as a merchant replacing a QR would) and scans
  // again at once: the member must reach the stamp screen every time.
  test("a member scanning a QR just switched back on reaches the stamp screen", async ({
    context,
    page,
  }) => {
    test.setTimeout(REACTIVATION_ROUNDS * 60_000)
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    try {
      for (let round = 1; round <= REACTIVATION_ROUNDS; round += 1) {
        await test.step(`round ${round}`, async () => {
          await reactivatedQrRound(sql, context, page)
        })
      }
    } finally {
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

async function expectUnavailableQr(
  page: Page,
  qrId: string,
  paused = false
): Promise<void> {
  const response = await page.goto(publicQrPath(qrId))

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole("heading", {
      name: paused ? "Customer scans are paused" : "This QR isn't working",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Scan a venue QR" })
  ).toHaveAttribute("href", "/scan")
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
    {
      name: fixture.session.deviceCookieName,
      value: fixture.session.deviceCookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: fixture.session.expiresAt,
    },
  ])
}

async function reactivatedQrRound(
  sql: Sql,
  context: BrowserContext,
  page: Page
): Promise<void> {
  let fixture: PublicQrRouterFixture | undefined
  let bucketKeys: readonly string[] = []
  try {
    fixture = await createPublicQrRouterFixture(sql)
    test.skip(!fixture, "seed merchant owner is not available")
    if (!fixture) return

    await context.clearCookies()
    await context.setExtraHTTPHeaders(publicQrRateLimitHeaders(fixture))
    await installCustomerSession(context, fixture)
    bucketKeys = publicQrRateLimitBucketKeys(
      fixture,
      publicQrRateLimitIdentities(fixture, sessionDeviceId(fixture))
    )

    await expectUnavailableQr(page, fixture.inactiveQrId, true)

    // One active join QR per venue location: retire the old one first.
    await sql`
      update public.qr_codes set is_active = false
      where id = ${fixture.activeQrCodeId}::uuid`
    await sql`
      update public.qr_codes set is_active = true
      where id = ${fixture.inactiveQrCodeId}::uuid`

    const { membershipId, inactiveQrId } = fixture
    await page.goto(publicQrPath(inactiveQrId))
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === `/card/${membershipId}/stamp` &&
        url.searchParams.get("qr") === inactiveQrId
      )
    })
    await expect(
      page.getByRole("heading", { level: 1, name: "Today's stamp" })
    ).toBeVisible()
  } finally {
    await cleanupPublicQrRateLimitBuckets(sql, bucketKeys)
    await cleanupPublicQrRouterFixture(sql, fixture)
  }
}

function sessionDeviceId(fixture: PublicQrRouterFixture): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim() ?? ""
  const deviceId = verifyCustomerDeviceToken(
    fixture.session.deviceCookieValue,
    secret
  )
  if (!deviceId) {
    throw new Error("Public QR test could not read its customer device token.")
  }
  return deviceId
}
