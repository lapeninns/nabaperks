import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

export function describeMerchantMultiSite() {
  test.describe("@merchant-multi-site merchant multi-site harness", () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("dashboard location filter scopes activity while keeping members shared", async ({
      page,
    }) => {
      await openDashboardLocation(page, "loc_white_horse")

      await expect(
        page.getByRole("heading", { level: 1, name: "Old Crown Girton" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: /White Horse/i })
      ).toHaveAttribute("aria-current", "true")
      await expect(
        page.getByText("Members are shared across your sites")
      ).toBeVisible()
      await expect(page.getByText("White Horse Milton")).toBeVisible()
    })

    test("account locations tab lists join QR paths and add-location controls", async ({
      page,
    }) => {
      await page.goto(`${HARNESS_ROUTES.account}?tab=locations`)

      await expect(
        page.getByRole("heading", { level: 1, name: "Locations" })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Old Crown Girton" })
      ).toBeVisible()
      await expect(page.getByText("/q/old-crown-girton")).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Download PNG for Old Crown Girton" })
      ).toHaveAttribute("href", "/app/qr/image/qr_harness")
      await expect(
        page.getByRole("heading", { name: "Add another location" })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Create location QR" })
      ).toBeVisible()
    })
  })
}

async function openDashboardLocation(page: Page, locationId: string) {
  await page.goto(`${HARNESS_ROUTES.dashboard}?location=${locationId}`)
}
