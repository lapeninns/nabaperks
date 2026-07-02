import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

export function describeMerchantRewardPresets() {
  test.describe("merchant reward presets @reward-presets", () => {
    test("Given the card harness When a cadence preset is chosen Then the existing card draft is prefilled", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=card`)

      await page.getByRole("button", { name: /Food-led card/ }).click()

      await expect(
        page.getByRole("group", { name: "Visits to reveal" })
      ).toContainText("5")
      await expect(
        page.getByText("Works for meals and planned visits.")
      ).toBeVisible()
    })

    test("Given the reward harness When a reward preset is chosen Then the existing reward editor is prefilled", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards`)

      await page.getByRole("button", { name: /Free starter/ }).click()

      await expect(page.getByLabel("Reward name")).toHaveValue("Free starter")
      await expect(page.getByLabel("Reward terms")).toHaveValue(
        /Valid from the next UK business day\./
      )
      await page.getByText("Weighting").click()
      await expect(page.getByLabel("Weight")).toHaveValue("1")
    })
  })
}
