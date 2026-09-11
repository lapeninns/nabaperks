import { expect, test, type APIRequestContext } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * Public offer-pass (`/p/[token]`) and reward (`/r/[token]`) scan handoffs.
 *
 * Unit tests own URL parsing (`tests/unit/reward-scanner.test.mjs`). Merchant
 * scan consoles are harness-covered. This spec proves the public entrypoints:
 * a malformed token is the branded 404; a UUID redirects into the matching
 * staff console, which then bounces an anonymous visitor to merchant login.
 */

const SCAN_UUID = "123e4567-e89b-12d3-a456-426614174000"

async function getWithoutFollowing(request: APIRequestContext, path: string) {
  return request.get(path, { maxRedirects: 0 })
}

function redirectLocation(response: { headers: () => Record<string, string> }) {
  return response.headers().location ?? response.headers().Location ?? ""
}

test.describe("public scan handoffs", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("/p/ rejects a malformed token with the branded 404", async ({
    page,
  }) => {
    const response = await page.goto("/p/not-a-uuid")

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Start your launch" })
    ).toHaveAttribute("href", "/signup")
  })

  test("/r/ rejects a malformed token with the branded 404", async ({
    page,
  }) => {
    const response = await page.goto("/r/not-a-uuid")

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
  })

  test("/p/{uuid} redirects into the offer-pass scan console", async ({
    request,
  }) => {
    const response = await getWithoutFollowing(request, `/p/${SCAN_UUID}`)

    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(redirectLocation(response)).toContain(
      `/app/offers/scan/${SCAN_UUID}`
    )
  })

  test("/r/{uuid} redirects into the reward scan console", async ({
    request,
  }) => {
    const response = await getWithoutFollowing(request, `/r/${SCAN_UUID}`)

    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(redirectLocation(response)).toContain(
      `/app/rewards/scan/${SCAN_UUID}`
    )
  })

  test("anonymous /p/{uuid} follow-through lands on merchant login", async ({
    page,
  }) => {
    await page.goto(`/p/${SCAN_UUID}`)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe(`/app/offers/scan/${SCAN_UUID}`)
    await expect(
      page.getByRole("heading", { name: "Back to the counter" })
    ).toBeVisible()
  })

  test("anonymous /r/{uuid} follow-through lands on merchant login", async ({
    page,
  }) => {
    await page.goto(`/r/${SCAN_UUID}`)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe(`/app/rewards/scan/${SCAN_UUID}`)
    await expect(
      page.getByRole("heading", { name: "Back to the counter" })
    ).toBeVisible()
  })
})
