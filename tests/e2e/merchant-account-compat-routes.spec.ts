import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const MERCHANT_ACCOUNT_COMPAT_ROUTES = [
  {
    path: "/app/profile",
    next: "/app/profile",
  },
  {
    path: "/app/settings",
    next: "/app/settings",
  },
  {
    path: "/app/billing",
    next: "/app/billing",
  },
  {
    path: "/app/billing?checkout=success&portal=return",
    next: "/app/billing?checkout=success&portal=return",
  },
] as const

test.describe("merchant account compatibility route gates", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const compatRoute of MERCHANT_ACCOUNT_COMPAT_ROUTES) {
    test(`anonymous ${compatRoute.path} redirects to merchant login`, async ({
      page,
    }) => {
      await page.goto(compatRoute.path)
      await expect(page).toHaveURL(/\/login\?/)

      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
      expect(url.searchParams.get("next")).toBe(compatRoute.next)
      await expect(
        page.getByRole("heading", {
          name: "Welcome back to your loyalty counter.",
        })
      ).toBeVisible()
    })
  }
})
