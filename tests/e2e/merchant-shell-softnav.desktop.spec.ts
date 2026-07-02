import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * Regression: the merchant `/app` shell lives in a single shared layout that the
 * App Router preserves across soft (client-side) navigations. When the shell's
 * variant was computed server-side from the request path, it went stale on soft
 * nav. The shell now derives its variant from `usePathname()`, which updates on
 * every navigation. These tests exercise real in-app links (soft nav), which is
 * the only way to reproduce the bug — a hard reload always re-renders correctly.
 */

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

const fullShellControl = (page: Page) =>
  page.getByRole("button", { name: "Toggle navigation" }).first()
const setupAccountLink = (page: Page) =>
  page.getByRole("link", { name: "Account profile" })
const sidebarNav = (page: Page) =>
  page.getByRole("navigation", { name: "Merchant navigation" })

async function signIn(
  page: Page,
  next: string,
  rateLimitNonce: string
): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": localLoopbackIp(rateLimitNonce),
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}

test.describe("merchant shell variant survives client-side navigation", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("full -> launch: sidebar stays when navigating to /app/launch", async ({
    page,
  }) => {
    await signIn(page, "/app", "a101")
    await page.waitForURL((url) => url.pathname === "/app")
    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)

    // Soft navigation via the in-app sidebar "Setup" link (no full reload).
    await sidebarNav(page).getByRole("link", { name: "Setup" }).click()
    await page.waitForURL((url) => url.pathname === "/app/launch")

    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)
  })

  test("launch -> full: sidebar stays when navigating back to /app", async ({
    page,
  }) => {
    await signIn(page, "/app/launch", "b202")
    await page.waitForURL((url) => url.pathname === "/app/launch")
    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)

    await sidebarNav(page).getByRole("link", { name: "Dashboard" }).click()
    await page.waitForURL((url) => url.pathname === "/app")

    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)
  })
})
