import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupCustomerReadbackFixture,
  connectCustomerReadbackDb,
  createCustomerReadbackFixture,
  customerReadbackLiveDbSkipReason,
  type BrowserCustomerSession,
  type CustomerReadbackFixture,
} from "./helpers/customer-readback-live-db"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

test.describe("@customer-flow customer home readback", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders mixed reward and activity states for the signed-in customer", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: CustomerReadbackFixture | undefined

    try {
      fixture = await createCustomerReadbackFixture(sql)
      test.skip(!fixture, "customer readback seed merchant is not available")
      if (!fixture) return

      await installCustomerSession(context, fixture.populatedSession)

      await openCustomerReadbackPage(page, "/home/rewards")
      await expect(
        page.getByRole("heading", { level: 1, name: "Rewards" })
      ).toBeVisible()
      await expect(page.getByText("Ready for scan")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Show these now" })
      ).toBeVisible()
      await expect(page.getByText("Coming soon")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Almost there" })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Redeemed", exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Expired", exact: true })
      ).toBeVisible()
      await expect(page.getByText(fixture.readyRewardName)).toBeVisible()
      await expect(page.getByText(fixture.upcomingRewardName)).toBeVisible()
      await expect(page.getByText(fixture.redeemedRewardName)).toBeVisible()
      await expect(page.getByText(fixture.expiredRewardName)).toBeVisible()
      await expect(page.getByText("Browser readback ready terms")).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Open reward QR" })
      ).toBeVisible()
      await expect(page.locator("body")).not.toContainText(
        fixture.rawPrivateEmail
      )
      await expectNoHorizontalOverflow(page)

      await openCustomerReadbackPage(page, "/home/activity")
      await expect(
        page.getByRole("heading", { level: 1, name: "Activity" })
      ).toBeVisible()
      await expect(
        page.getByText(`Joined ${fixture.businessName}`)
      ).toBeVisible()
      await expect(
        page.getByText(`You started collecting stamps at ${fixture.businessName}.`)
      ).toBeVisible()
      await expect(
        page.getByText(`Stamp added at ${fixture.businessName}`)
      ).toBeVisible()
      await expect(page.getByText("You're now on 3 stamps.")).toBeVisible()
      await expect(
        page.getByText(`Reward unlocked at ${fixture.businessName}`)
      ).toBeVisible()
      await expect(
        page.getByText(`${fixture.readyRewardName} is ready to claim.`)
      ).toBeVisible()
      await expect(
        page.getByText(`Reward redeemed at ${fixture.businessName}`)
      ).toBeVisible()
      await expect(
        page.getByText(`You enjoyed ${fixture.redeemedRewardName}.`)
      ).toBeVisible()
      await expect(page.locator("body")).not.toContainText(
        fixture.rawPrivateEmail
      )
      await expect(page.locator("body")).not.toContainText("+447700900000")
      await expect(page.locator("body")).not.toContainText("52.205,-0.119")
      await expectNoHorizontalOverflow(page)
    } finally {
      await cleanupCustomerReadbackFixture(sql, fixture)
      await sql.end()
    }
  })

  test("renders empty reward and activity states for a customer with no events", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: CustomerReadbackFixture | undefined

    try {
      fixture = await createCustomerReadbackFixture(sql)
      test.skip(!fixture, "customer readback seed merchant is not available")
      if (!fixture) return

      await installCustomerSession(context, fixture.emptySession)

      await openCustomerReadbackPage(page, "/home/rewards")
      await expect(
        page.getByRole("heading", { level: 1, name: "Rewards" })
      ).toBeVisible()
      await expect(page.getByText("No rewards yet")).toBeVisible()
      await expect(page.getByText(fixture.readyRewardName)).toHaveCount(0)
      await expect(page.getByText(fixture.upcomingRewardName)).toHaveCount(0)
      await expect(page.getByText(fixture.redeemedRewardName)).toHaveCount(0)
      await expect(page.getByText(fixture.expiredRewardName)).toHaveCount(0)
      await expectNoHorizontalOverflow(page)

      await openCustomerReadbackPage(page, "/home/activity")
      await expect(
        page.getByRole("heading", { level: 1, name: "Activity" })
      ).toBeVisible()
      await expect(page.getByText("Nothing here yet")).toBeVisible()
      await expect(
        page.getByText(`Joined ${fixture.businessName}`)
      ).toHaveCount(0)
      await expect(
        page.getByText(`Stamp added at ${fixture.businessName}`)
      ).toHaveCount(0)
      await expectNoHorizontalOverflow(page)
    } finally {
      await cleanupCustomerReadbackFixture(sql, fixture)
      await sql.end()
    }
  })
})

async function installCustomerSession(
  context: BrowserContext,
  session: BrowserCustomerSession
): Promise<void> {
  await context.addCookies([
    {
      name: session.cookieName,
      value: session.cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}

function isRewardsRefreshInterruption(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("interrupted by another navigation") &&
    error.message.includes("/home/activity") &&
    error.message.includes("/home/rewards")
  )
}

async function openCustomerReadbackPage(
  page: Page,
  path: "/home/rewards" | "/home/activity"
): Promise<void> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" })
  } catch (error) {
    if (path !== "/home/activity" || !isRewardsRefreshInterruption(error)) {
      throw error
    }

    await page.waitForURL((url) => url.pathname === "/home/rewards", {
      waitUntil: "domcontentloaded",
    })
    await page.goto(path, { waitUntil: "domcontentloaded" })
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  })

  expect(hasOverflow).toBe(false)
}
