import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

test.describe("PWA offline fallback", () => {
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

    const registrationScope = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null

      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })

    expect(registrationScope).toBe(new URL("/", page.url()).href)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

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
