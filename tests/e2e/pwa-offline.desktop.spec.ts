import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

test.describe("PWA offline fallback", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Offline service-worker navigation is asserted in Chromium; cross-browser rendering is covered by a11y and visual gates."
  )

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("Given the service worker is installed When a server-state route is opened offline Then the offline fallback renders", async ({
    context,
    page,
  }) => {
    const response = await page.goto("/home/login")

    expect(response?.status(), "customer login route is reachable").toBe(200)
    await expect(page.locator("body")).toContainText(/phone/i)

    const registrationScope = await readServiceWorkerScope(page)

    expect(registrationScope).toBe(new URL("/", page.url()).href)
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null
    )

    await context.setOffline(true)
    try {
      const offlineResponse = await page.goto("/home")

      expect(offlineResponse?.status(), "cached offline page is served").toBe(
        200
      )
      await expect(
        page.getByRole("heading", { name: "You're offline" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Open my cards" })
      ).toHaveAttribute("href", "/home")
      await expect(page.locator("body")).toContainText(
        "Your cards and stamps live safely with us."
      )

      const offlineLayout = await page.locator("main").evaluate((node) => {
        const style = window.getComputedStyle(node)
        return {
          backgroundColor: style.backgroundColor,
          display: style.display,
          justifyContent: style.justifyContent,
        }
      })
      expect(offlineLayout).toEqual({
        backgroundColor: "rgb(246, 241, 230)",
        display: "flex",
        justifyContent: "center",
      })
    } finally {
      await context.setOffline(false)
    }
  })
})

async function readServiceWorkerScope(page: Page): Promise<string | null> {
  try {
    return await evaluateServiceWorkerScope(page)
  } catch (error) {
    if (!isNavigationRace(error)) throw error
  }

  await page.waitForLoadState("domcontentloaded")
  return evaluateServiceWorkerScope(page)
}

function evaluateServiceWorkerScope(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null

    const registration = await navigator.serviceWorker.ready
    return registration.scope
  })
}

function isNavigationRace(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Execution context was destroyed")
  )
}
