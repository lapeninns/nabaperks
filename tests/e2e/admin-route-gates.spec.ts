import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const ADMIN_ROUTES = [
  "/admin",
  "/admin/audit",
  "/admin/billing",
  "/admin/customers",
  "/admin/fraud",
  "/admin/merchants",
  "/admin/pilot",
  "/admin/privacy",
] as const

test.describe("admin route gates", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const adminRoute of ADMIN_ROUTES) {
    test(`anonymous ${adminRoute} redirects to merchant login`, async ({
      page,
    }) => {
      await page.goto(adminRoute)
      await expect(page).toHaveURL(/\/login\?/)

      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
      expect(url.searchParams.get("next")).toBe("/admin")
      await expect(
        page.getByRole("heading", { name: "Back to the counter" })
      ).toBeVisible()
    })
  }
})
