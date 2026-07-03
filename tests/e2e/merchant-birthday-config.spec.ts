import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * MS-rewards-customer-birthday R-5 — the merchant birthday-reward config panel
 * renders inside the Rewards launch tab, DB-free.
 */
const LAUNCH_REWARDS = "/dev/app-harness/launch?tab=rewards"

test.describe("@merchant-flow merchant birthday config", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders the birthday reward config in the rewards panel", async ({
    page,
  }) => {
    await page.goto(LAUNCH_REWARDS)
    await expect(
      page.getByRole("heading", { name: "Birthday treat" })
    ).toBeVisible()
    await expect(page.getByText("Give a birthday treat")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Save birthday reward" })
    ).toBeVisible()
  })
})
