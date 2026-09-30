import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * rewards customer birthday R-6: the birthday suggestion, DB-free. It is one
 * candidate of home's single optional suggestion slot.
 */
const HOME = "/dev/home-harness/home"

test.describe("@customer-flow customer birthday prompt", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("shows the DOB prompt when no birthday is stored", async ({ page }) => {
    await page.goto(HOME)
    await expect(
      page.getByRole("heading", { name: "Add your birthday" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Add my birthday" })
    ).toHaveAttribute("href", "/home/profile")
  })

  test("suppresses the prompt when a birthday is stored", async ({ page }) => {
    await page.goto(`${HOME}?dob=set`)
    await expect(
      page.getByRole("heading", { name: "Add your birthday" })
    ).toHaveCount(0)
    // Nothing else is missing, so the slot stays empty.
    await expect(page.getByTestId("home-setup-suggestion")).toHaveCount(0)
  })

  test("dismissing hides the prompt", async ({ page }) => {
    await page.goto(HOME)
    await page.getByRole("button", { name: "Not now" }).click()
    await expect(
      page.getByRole("heading", { name: "Add your birthday" })
    ).toHaveCount(0)
  })
})
