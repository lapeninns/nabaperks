import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  seedMerchantOwnerEmail,
} from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"

const SEED_MERCHANT_SLUG = "old-crown-girton"
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

type AuthenticatedCompatRoute = (typeof AUTHENTICATED_COMPAT_ROUTES)[number]

async function signInThroughNext(
  page: Page,
  next: string,
  merchantEmail: string
): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": localLoopbackIp(randomUUID()),
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(merchantEmail)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}

async function expectAuthenticatedCompatRoute(
  page: Page,
  compatRoute: AuthenticatedCompatRoute
): Promise<void> {
  await expect(
    page.getByRole("heading", { exact: true, name: compatRoute.heading })
  ).toBeVisible()

  const url = new URL(page.url())
  expect(url.pathname).toBe("/app/account")
  expect(url.searchParams.get("tab")).toBe(compatRoute.tab)

  for (const [key, value] of Object.entries(compatRoute.query)) {
    expect(url.searchParams.get(key)).toBe(value)
  }
}

function isAccountHubRefreshInterruption(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("interrupted by another navigation") &&
    error.message.includes("/app/account?tab=profile")
  )
}

async function openAuthenticatedCompatRoute(
  page: Page,
  compatRoute: AuthenticatedCompatRoute
): Promise<void> {
  try {
    await page.goto(compatRoute.path, { waitUntil: "domcontentloaded" })
  } catch (error) {
    if (!isAccountHubRefreshInterruption(error)) {
      throw error
    }

    await page.waitForURL(
      (url) =>
        url.pathname === "/app/account" &&
        url.searchParams.get("tab") === "profile",
      { waitUntil: "load" }
    )
    await page.goto(compatRoute.path, { waitUntil: "domcontentloaded" })
  }
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
    test.use({ serviceWorkers: "block" })

    test("seeded merchant legacy next paths land on Account hub", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const [firstRoute, ...remainingRoutes] = AUTHENTICATED_COMPAT_ROUTES

      try {
        const merchantEmail = await seedMerchantOwnerEmail(
          sql,
          SEED_MERCHANT_SLUG
        )
        test.skip(!merchantEmail, "seed merchant owner email is not available")
        if (!merchantEmail) return

        await signInThroughNext(page, firstRoute.path, merchantEmail)
        await expectAuthenticatedCompatRoute(page, firstRoute)

        for (const compatRoute of remainingRoutes) {
          await openAuthenticatedCompatRoute(page, compatRoute)
          await expectAuthenticatedCompatRoute(page, compatRoute)
        }
      } finally {
        await sql.end({ timeout: 5 })
      }
    })
  })
})
