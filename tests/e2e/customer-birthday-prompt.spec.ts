import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * MS-rewards-customer-birthday R-6 — the DOB prompt, DB-free.
 */
const HOME = "/dev/home-harness/home"

test.describe("@customer-flow customer birthday prompt", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("shows the DOB prompt when no birthday is stored", async ({ page }) => {
    await page.goto(HOME)
    await expect(
      page.getByText("Add your birthday for a treat on us")
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Add your birthday" })
    ).toBeVisible()
  })

  test("suppresses the prompt when a birthday is stored", async ({ page }) => {
    await page.goto(`${HOME}?dob=set`)
    await expect(
      page.getByText("Add your birthday for a treat on us")
    ).toHaveCount(0)
  })

  test("dismissing hides the prompt", async ({ page }) => {
    await page.goto(HOME)
    await page.getByRole("button", { name: "Not now" }).click()
    await expect(
      page.getByText("Add your birthday for a treat on us")
    ).toHaveCount(0)
  })
})
