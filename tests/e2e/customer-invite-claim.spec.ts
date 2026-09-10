import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/home-harness/invite-claim"

test.describe("customer loyalty invite claim", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("an unknown invite token stays unavailable", async ({ page }) => {
    await page.goto("/invite/not-a-real-token")

    await expect(
      page.getByRole("heading", {
        name: "This invitation link isn't available",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Go to Nabaperks" })
    ).toHaveAttribute("href", "/")
    await expect(
      page.getByRole("button", { name: "Collect your two stamps" })
    ).toHaveCount(0)
  })

  test("available harness shows the two-stamp offer and hands off without writing @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?state=available`)

    await expect(
      page.getByRole("heading", { name: "Two stamps to start your card" })
    ).toBeVisible()
    await expect(page.getByText("The Test Arms", { exact: true })).toBeVisible()
    await expectNoAxeViolations(page, "loyalty invite available harness")

    await page.getByRole("button", { name: "Collect your two stamps" }).click()
    await expect(page).toHaveURL(/state=claimed/)
    await expect(
      page.getByRole("heading", { name: "Continue on the join page" })
    ).toBeVisible()
  })

  test("expired harness explains the 30-day window", async ({ page }) => {
    await page.goto(`${HARNESS}?state=expired`)

    await expect(
      page.getByRole("heading", { name: "This invitation has expired" })
    ).toBeVisible()
    await expect(
      page.getByText("Invitation links are valid for 30 days.")
    ).toBeVisible()
  })

  test("unavailable harness has no collect control @a11y", async ({ page }) => {
    await page.goto(`${HARNESS}?state=unavailable`)

    await expect(
      page.getByRole("heading", {
        name: "This invitation link isn't available",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Collect your two stamps" })
    ).toHaveCount(0)
    await expectNoAxeViolations(page, "loyalty invite unavailable harness")
  })
})
