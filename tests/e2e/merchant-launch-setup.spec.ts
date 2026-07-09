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
const LAUNCH_TABS = ["venue", "card", "rewards", "qr", "billing"] as const

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
      page.getByRole("button", { name: /Proceed to billing/ })
    ).toBeVisible()
  })

  test("the needsBilling state heads with the progress, not a repeated line", async ({
    page,
  }) => {
    // ?state=billing = QR live, billing the only pending step. The header states
    // the progress once ("One step from live") and the mobile context states
    // what's LEFT — it must not repeat the heading.
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing`)

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "One step from live",
      })
    ).toBeVisible()
    // The mobile context line and the desktop PageTitle description carry the
    // same "what's left" string (one is display:none per breakpoint), so match
    // the first (mobile, sm:hidden) — the point is that it states what's LEFT
    // rather than repeating the "One step from live" heading.
    await expect(
      page.getByText("The last step before your venue goes live.").first()
    ).toBeVisible()
  })

  test("the readiness rail exposes a visible, correctly-targeted step CTA", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=card`)

    const venueStep = page
      .getByRole("link", { name: /Business & venue/ })
      .first()
    await expect(venueStep).toBeVisible()
    await expect(venueStep).toHaveAttribute("href", "/app/launch?tab=venue")
  })

  // One route per test: two /dev/app-harness gotos in one test race on the
  // shared shell's client effects. Both assert the venue name is a VISIBLE,
  // editable input carrying the exact field name the server action reads (no
  // hidden default the merchant can't see).
  test("the launch venue step exposes an editable venueName input", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=venue`)
    const venueName = page.locator('input[name="venueName"]')
    await expect(venueName).toBeVisible()
    await expect(venueName).toBeEditable()
  })

  test("onboarding exposes an editable locationName input", async ({ page }) => {
    await page.goto(HARNESS_ROUTES.onboarding)
    const locationName = page.locator('input[name="locationName"]')
    await expect(locationName).toBeVisible()
    await expect(locationName).toBeEditable()
  })

  test("no horizontal overflow on any launch tab at mobile width", async ({
    page,
  }) => {
    for (const tab of LAUNCH_TABS) {
      await page.goto(`${HARNESS_ROUTES.launch}?tab=${tab}`)
      await expect(page.locator("body")).toBeVisible()
      expect(
        await horizontalOverflow(page),
        `horizontal overflow on tab=${tab}`
      ).toBeLessThanOrEqual(1)
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
