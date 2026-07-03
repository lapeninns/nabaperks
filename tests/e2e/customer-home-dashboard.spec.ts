import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import {
  cleanupCustomerReadbackFixture,
  connectCustomerReadbackDb,
  createCustomerReadbackFixture,
  customerReadbackLiveDbSkipReason,
  type BrowserCustomerSession,
  type CustomerReadbackFixture,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

test.describe("@customer-flow customer home dashboard", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders the empty dashboard for a customer with no cards", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: CustomerReadbackFixture | undefined

    try {
      fixture = await createCustomerReadbackFixture(sql)
      test.skip(!fixture, "customer dashboard seed merchant is not available")
      if (!fixture) return

      await installCustomerSession(context, fixture.emptySession)
      await page.goto("/home")

      await expect(
        page.getByRole("heading", { level: 1, name: "Your cards" })
      ).toBeVisible()
      await expect(
        page.getByText("Scan a venue QR to start a card")
      ).toBeVisible()
      await expect(page.getByText("How it works")).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Scan venue QR" })
      ).toBeVisible()
      await expect(page.getByText(fixture.businessName)).toHaveCount(0)
      await expectNoHorizontalOverflow(page)
    } finally {
      await cleanupCustomerReadbackFixture(sql, fixture)
      await sql.end()
    }
  })

  test("renders one-card dashboard with ready and redeemed reward evidence", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: CustomerReadbackFixture | undefined

    try {
      fixture = await createCustomerReadbackFixture(sql)
      test.skip(!fixture, "customer dashboard seed merchant is not available")
      if (!fixture) return

      await installCustomerSession(context, fixture.populatedSession)
      await page.goto("/home")

      await expect(
        page.getByRole("heading", { level: 1, name: "Your cards" })
      ).toBeVisible()
      await expect(page.getByText(/1 card.*1 reward ready/)).toBeVisible()
      await expect(page.getByText("Ready for scan")).toBeVisible()
      await expect(
        page.getByRole("heading", { name: fixture.readyRewardName })
      ).toBeVisible()
      await expect(page.getByText(fixture.businessName).first()).toBeVisible()
      await expect(page.getByText("Reward ready").first()).toBeVisible()
      await expect(page.getByText("Open reward QR").first()).toBeVisible()
      await expect(page.getByText("Latest visits")).toBeVisible()
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
      await expectNoHorizontalOverflow(page)
    } finally {
      await cleanupCustomerReadbackFixture(sql, fixture)
      await sql.end()
    }
  })

  test("renders waiting reward card state without a ready QR shortcut", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: CustomerReadbackFixture | undefined

    try {
      fixture = await createCustomerReadbackFixture(sql)
      test.skip(!fixture, "customer dashboard seed merchant is not available")
      if (!fixture) return

      await installCustomerSession(context, fixture.waitingSession)
      await page.goto("/home")

      await expect(
        page.getByRole("heading", { level: 1, name: "Your cards" })
      ).toBeVisible()
      await expect(page.getByText(/1 card.*0 rewards ready/)).toBeVisible()
      await expect(page.getByText(fixture.businessName).first()).toBeVisible()
      await expect(page.getByText("Reward soon")).toBeVisible()
      await expect(page.getByText("Your reward")).toBeVisible()
      await expect(page.getByText(fixture.waitingRewardName)).toBeVisible()
      await expect(page.getByText("Ready for scan")).toHaveCount(0)
      await expect(page.getByText("Open reward QR")).toHaveCount(0)
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  })

  expect(hasOverflow).toBe(false)
}
