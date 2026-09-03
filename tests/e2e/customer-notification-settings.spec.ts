import { expect, test, type BrowserContext } from "@playwright/test"

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

/**
 * db notification durability — secondary journey proof (rls-rpc-ledger floor).
 *
 * The DB behavioural tier (tests/db/notification-*.test.mjs) is the primary
 * proof of the queue durability fixes. This browser proof confirms the
 * customer-facing front door to that notification subsystem — the "Browser
 * notifications" control on the profile page, where a customer opts in to the
 * reminder/reward pushes the hardened worker delivers — renders and opens.
 */

test.describe("customer notification settings", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the profile page surfaces the browser-notification opt-in control", async ({
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
      await page.goto("/home/profile")

      const control = page.getByText("Browser notifications")
      await expect(control).toBeVisible()

      // Opening the disclosure mounts the notification preference controls. The
      // Reminders channel (next-stamp / reward-expiry pushes this spec's
      // producers enqueue) carries a unique helper string — a robust marker that
      // the settings expanded.
      await control.click()
      await expect(
        page.getByText("Next stamp windows and reward expiry notices.")
      ).toBeVisible()
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
    {
      name: session.deviceCookieName,
      value: session.deviceCookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}
