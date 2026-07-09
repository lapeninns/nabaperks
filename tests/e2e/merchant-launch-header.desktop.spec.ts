import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * Merchant launch-header interaction hierarchy (@launch-header) — DB-free
 * harness tier, DESKTOP projects only (`.desktop.spec.ts`).
 *
 * The launch header's jump-to-tab CTA lives in the `sm:` PageTitle, so it only
 * renders at desktop width. The rule under test: it is SUPPRESSED whenever it
 * would point at the tab already on screen, so it never competes with the active
 * panel's own primary action (the header CTA is a link; the billing activation
 * card's checkout is a button — the two must not both read as "Proceed to
 * billing"). The `?state=` selector drives the DB-free header state.
 *
 * The pure decision behind this is unit-tested in
 * tests/unit/launch-header-copy; these assert it actually renders that way.
 */
test.describe("merchant launch header @launch-header", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("needsBilling: the header CTA links to billing off the billing tab", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=venue`)

    const headerCta = page.getByRole("link", { name: "Proceed to billing" })
    await expect(headerCta).toBeVisible()
    await expect(headerCta).toHaveAttribute("href", "/app/launch?tab=billing")
  })

  test("needsBilling: the header CTA is suppressed on the billing tab", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=billing`)

    // No header LINK (it would be a no-op pointing at this very tab)…
    await expect(
      page.getByRole("link", { name: "Proceed to billing" })
    ).toHaveCount(0)
    // …but the activation card's real Stripe checkout BUTTON stays primary.
    await expect(
      page.getByRole("button", { name: /Proceed to billing/ })
    ).toBeVisible()
  })

  test("launchReady: the header CTA links to the QR off the qr tab", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=venue`)

    const headerCta = page.getByRole("link", { name: "Open venue QR" })
    await expect(headerCta).toBeVisible()
    await expect(headerCta).toHaveAttribute("href", "/app/launch?tab=qr")
  })

  test("launchReady: the header CTA is suppressed on the qr tab", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=qr`)

    await expect(
      page.getByRole("link", { name: "Open venue QR" })
    ).toHaveCount(0)
  })
})
