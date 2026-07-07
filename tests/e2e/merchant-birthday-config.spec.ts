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

  test("switching the treat on prefills the template; switching off drops the un-saved template", async ({
    page,
  }) => {
    await page.goto(LAUNCH_REWARDS)

    const toggle = page.getByRole("checkbox", {
      name: /Give a birthday treat/,
    })
    await toggle.check()

    await expect(page.getByLabel("Reward name")).toHaveValue(
      "Birthday drink on us"
    )
    await expect(page.getByLabel("Reward terms")).toHaveValue(
      /Valid from the next UK business day\./
    )

    // Switching off must not leave the un-saved template in the submitted
    // (hidden) fields — a disabled save persists the stored copy, here empty.
    await toggle.uncheck()
    await expect(page.locator('input[name="rewardName"]')).toHaveValue("")
  })
})
