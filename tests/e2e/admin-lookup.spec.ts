import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

// admin member lookup R5: an unauthenticated request to any admin lookup
// URL — including with search and pagination params — still redirects to the
// admin login. DB-free: asserts the gate only, never a signed-in lookup.
const LOOKUP_URLS = [
  "/admin/customers?venue=Red%20Lion&contact=jo&page=3",
  "/admin/customers?page=999&rewardsPage=2",
  "/admin/privacy?contact=07700&page=2&consentPage=4",
] as const

test.describe("admin member lookup auth gate @admin-lookup", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const lookupUrl of LOOKUP_URLS) {
    test(`anonymous ${lookupUrl} redirects to merchant login`, async ({
      page,
    }) => {
      await page.goto(lookupUrl)
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
