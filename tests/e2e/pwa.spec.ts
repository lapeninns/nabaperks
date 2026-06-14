import { expect, test } from "@playwright/test"

test("exposes full-app PWA assets and offline fallback", async ({ page }) => {
  await page.goto("/wallet/login")

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href")

  expect(manifestHref).toBe("/manifest.webmanifest")

  await expect
    .poll(async () =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true)

  for (const path of [
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/nabaperks-icon-192.png",
    "/icons/nabaperks-icon-512.png",
    "/icons/nabaperks-maskable-192.png",
    "/icons/nabaperks-maskable-512.png",
  ]) {
    const response = await page.request.get(path)
    expect(response.status(), path).toBe(200)
  }

  await page.goto("/offline")
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible()
})
