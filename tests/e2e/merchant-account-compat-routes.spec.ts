import { expect, test, type Page } from "@playwright/test"

import { adminLiveDbSkipReason } from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

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

const AUTHENTICATED_COMPAT_ROUTES = [
  {
    label: "profile",
    path: "/app/profile",
    tab: "profile",
    heading: "Profile",
    query: {},
  },
  {
    label: "settings",
    path: "/app/settings",
    tab: "profile",
    heading: "Profile",
    query: {},
  },
  {
    label: "billing",
    path: "/app/billing",
    tab: "billing",
    heading: "Billing",
    query: {},
  },
  {
    label: "billing return",
    path: "/app/billing?checkout=success&portal=return",
    tab: "billing",
    heading: "Billing",
    query: {
      checkout: "success",
      portal: "return",
    },
  },
] as const

async function signInThroughNext(page: Page, next: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

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

  test.describe("@admin-live-db authenticated legacy route redirects", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

    for (const compatRoute of AUTHENTICATED_COMPAT_ROUTES) {
      test(`seeded merchant ${compatRoute.label} next path lands on Account hub`, async ({
        page,
      }) => {
        await signInThroughNext(page, compatRoute.path)
        await expect(
          page.getByRole("heading", { exact: true, name: compatRoute.heading })
        ).toBeVisible()

        const url = new URL(page.url())
        expect(url.pathname).toBe("/app/account")
        expect(url.searchParams.get("tab")).toBe(compatRoute.tab)

        for (const [key, value] of Object.entries(compatRoute.query)) {
          expect(url.searchParams.get(key)).toBe(value)
        }
      })
    }
  })
})
