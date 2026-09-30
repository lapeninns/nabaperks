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
} from "./helpers/public-qr-router-rate-limit"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  publicQrPath,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

/**
 * QA BUG-041 (38c42a1..2c45031): a signed-in member who scanned a QR in the
 * moments after it was switched back on was told "This loyalty card is
 * unavailable". The /q lookup is served from the data cache, and the entry
 * written while the QR was off was served again after it came back on (fresh
 * inside its window, or stale-while-revalidate after a "max" tag revalidation).
 *
 * Each round scans a switched-off QR as a member, so the cache holds its
 * "unavailable" answer, switches it on (and the venue's other join QR off, as
 * a merchant replacing a QR would) and scans again at once. The member must
 * reach the stamp screen every time.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"
const ROUNDS = 3

test.describe("@customer-flow public QR reactivation live DB (QA BUG-041)", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a member scanning a QR just switched back on reaches the stamp screen", async ({
    context,
    page,
  }) => {
    test.setTimeout(ROUNDS * 60_000)
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    try {
      for (let round = 1; round <= ROUNDS; round += 1) {
        await test.step(`round ${round}`, async () => {
          await reactivatedQrRound(sql, context, page)
        })
      }
    } finally {
      await sql.end()
    }
  })
})

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
      publicQrRateLimitIdentities(fixture, deviceIdFor(fixture))
    )

    await page.goto(publicQrPath(fixture.inactiveQrId))
    await expect(
      page.getByRole("heading", { name: "This loyalty card is unavailable" })
    ).toBeVisible()

    // One active join QR per venue location: retire the old one first.
    await sql`
      update public.qr_codes set is_active = false
      where id = ${fixture.activeQrCodeId}::uuid`
    await sql`
      update public.qr_codes set is_active = true
      where id = ${fixture.inactiveQrCodeId}::uuid`

    await page.goto(publicQrPath(fixture.inactiveQrId))
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === `/card/${fixture?.membershipId}/stamp` &&
        url.searchParams.get("qr") === fixture?.inactiveQrId
      )
    })
    await expect(
      page.getByRole("heading", { name: "Stamp it here" })
    ).toBeVisible()
  } finally {
    await cleanupPublicQrRateLimitBuckets(sql, bucketKeys)
    await cleanupPublicQrRouterFixture(sql, fixture)
  }
}

function deviceIdFor(fixture: PublicQrRouterFixture): string {
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
