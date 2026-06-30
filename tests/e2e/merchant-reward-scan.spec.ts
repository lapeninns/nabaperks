import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * MS-merchant-scan-pos — DB-free harness tier.
 *
 * Proves the reward-collection surface renders its two states (ready vs
 * collected) and shows only a masked member label (MS-7), against the real
 * ScanShell + RewardTicket + collection form mounted on the DB-free
 * /dev/app-harness/reward-scan lane. The live single-use consumption invariant
 * (MS-2/MS-3) is proven separately in tests/db/reward-scan-single-use.test.mjs.
 */
test.describe("merchant reward scan — collection surface", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("ready state shows the reward + a collect affordance + masked member", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.rewardScan)

    await expect(
      page.getByRole("heading", { level: 1, name: "Check and collect reward" })
    ).toBeVisible()
    await expect(page.getByText("Free hot drink")).toBeVisible()
    await expect(page.getByText("Ready to collect")).toBeVisible()

    // MS-7: only a masked member label is shown — never a raw phone number.
    await expect(page.getByText("Phone ending 421")).toBeVisible()
    await expect(page.getByText(/\+?\d{7,}/)).toHaveCount(0)
  })

  test("collected state shows the closed/redeemed banner", async ({ page }) => {
    await page.goto(`${HARNESS_ROUTES.rewardScan}?collected=1`)

    await expect(
      page.getByRole("heading", { level: 1, name: "Check and collect reward" })
    ).toBeVisible()
    await expect(page.getByText("Reward collected").first()).toBeVisible()
    // The pre-collection "Ready to collect" affordance is gone once collected.
    await expect(page.getByText("Ready to collect")).toHaveCount(0)
  })
})
