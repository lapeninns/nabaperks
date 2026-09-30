import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * QA BUG-012 follow-up (38c42a1..2c45031): "Log out on all devices" that could
 * sign out only this browser lands on /home/login?signed_out=this_device, and
 * the customer is told the other devices are still signed in. A signed-out
 * visitor needs no database, so this renders the real page.
 */
const NOTICE =
  /You are signed out on this device\. Other devices could not be signed out just now\. Try again later\./

test.describe("@customer-flow wallet sign-in after a partial log-out", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("says only this device was signed out", async ({ page }) => {
    await page.goto("/home/login?signed_out=this_device")
    await expect(
      page.getByRole("alert").filter({ hasText: NOTICE })
    ).toBeVisible()
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
  })

  for (const query of [
    "",
    "?signed_out=all_devices",
    "?signed_out=THIS_DEVICE",
    "?signed_out=this_device&signed_out=this_device",
  ]) {
    test(`shows no notice for "${query || "no query"}"`, async ({ page }) => {
      await page.goto(`/home/login${query}`)
      await expect(
        page.getByLabel("Phone number", { exact: true })
      ).toBeVisible()
      await expect(page.getByText(NOTICE)).toHaveCount(0)
    })
  }
})
