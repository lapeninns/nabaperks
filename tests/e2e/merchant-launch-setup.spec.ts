import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * Merchant launch/setup UX regression (@launch-setup) — DB-free harness tier.
 *
 * Covers the targeted merchant-journey fixes:
 * - a VISIBLE mobile setup context above the readiness rail (was sr-only), with
 *   a "what's left before going live" line derived from readiness;
 * - the launch billing activation state renders the real setup card;
 * - the setup readiness rail exposes visible, correctly-targeted step CTAs;
 * - no horizontal overflow on any launch tab at mobile width;
 * - the dashboard incomplete-setup reminder renders its compact readiness rail.
 *
 * Mobile-safari project only (`.spec.ts`); needs no Supabase, auth, or Stripe.
 */
const LAUNCH_TABS = ["venue", "card", "rewards", "billing", "qr"] as const

/** Positive when the document scrolls horizontally past the viewport. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  )
}

test.describe("merchant launch setup @launch-setup", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("mobile shows a visible setup context above the readiness rail", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.launch)

    await expect(
      page.getByRole("heading", { level: 1, name: "Bring your venue to life" })
    ).toBeVisible()
    // The "what's left before going live" line, derived from readiness.
    await expect(page.getByText(/steps done\. Next:/)).toBeVisible()
  })

  test("the billing setup state renders the real activation card", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=billing`)

    // The activation card titles itself with the ACTION ("Activate your
    // venue") — the shared billing-activation title — not by repeating the
    // page header's state line ("One step from live").
    await expect(
      page.getByRole("heading", { name: "Activate your venue" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: "Continue · £299.99 launch · then £69.99 every 28 days",
      })
    ).toBeVisible()
  })

  test("the needsBilling state explains that billing unlocks the QR", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing`)

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Launch to unlock your QR",
      })
    ).toBeVisible()
    await expect(
      page.getByText(/Your 28-day pilot begins after poster delivery/i).first()
    ).toBeVisible()
    await expect(page.getByText(/start (?:the|your) pilot/i)).toHaveCount(0)
  })

  test("the readiness rail exposes a visible, correctly-targeted step CTA", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=card`)

    const venueStep = page.getByRole("link", { name: /Your venue/ }).first()
    await expect(venueStep).toBeVisible()
    await expect(venueStep).toHaveAttribute("href", "/app/launch?tab=venue")
  })

  test("the launch venue step does not ask for a second customer-facing name", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=venue`)
    await expect(page.locator('input[name="venueName"]')).toHaveCount(0)
  })

  test("onboarding asks for one customer-facing venue name", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.onboarding)
    await expect(
      page.getByRole("textbox", { name: /^Venue name/ })
    ).toBeVisible()
    await expect(page.locator('input[name="businessName"]')).toHaveCount(1)
    await expect(page.locator('input[name="locationName"]')).toHaveCount(0)
  })

  test("no horizontal overflow on any launch tab at mobile width", async ({
    context,
  }) => {
    for (const tab of LAUNCH_TABS) {
      const tabPage = await context.newPage()
      await dismissPwaInstall(tabPage)

      try {
        await tabPage.goto(`${HARNESS_ROUTES.launch}?tab=${tab}`)
        await expect(tabPage.locator("body")).toBeVisible()
        expect(
          await horizontalOverflow(tabPage),
          `horizontal overflow on tab=${tab}`
        ).toBeLessThanOrEqual(1)
      } finally {
        await tabPage.close()
      }
    }
  })

  test("the dashboard incomplete-setup reminder renders its compact rail", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.dashboard}?setup=incomplete`)

    await expect(page.getByText("Next: Your rewards")).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Add rewards/ })
    ).toHaveAttribute("href", "/app/launch?tab=rewards")
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
  })
})
