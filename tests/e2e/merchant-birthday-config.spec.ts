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
    ).toHaveCount(0)
    await expect(page.getByText("Changes save automatically")).toBeVisible()
  })

  test("switching the treat on prefills and saves the template; switching off preserves it", async ({
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
      /Valid once issued\./
    )
    await toggle.uncheck()
    await expect(page.locator('input[name="rewardName"]')).toHaveValue(
      "Birthday drink on us"
    )
  })

  test("keeps the next-step CTA tactile, unclipped and responsive on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${LAUNCH_REWARDS}&pool=ready`)

    const cta = page.getByRole("link", { name: "Billing", exact: true })
    await expect(cta).toBeVisible()
    const box = await cta.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0) + 4).toBeLessThanOrEqual(375)

    await cta.click()
    await expect(page).toHaveURL(/tab=billing/)
  })
})
