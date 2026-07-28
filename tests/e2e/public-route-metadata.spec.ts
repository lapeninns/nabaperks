import { expect, test } from "@playwright/test"

const INDEXABLE_SITE_URLS = [
  "https://nabaperks.com/",
  "https://nabaperks.com/pricing",
  "https://nabaperks.com/how-it-works",
  "https://nabaperks.com/loyalty-for-pubs",
  "https://nabaperks.com/guides/reward-regulars-without-an-app",
  "https://nabaperks.com/guides/best-loyalty-ideas-for-pubs",
  "https://nabaperks.com/guides/paper-vs-qr-loyalty-for-pubs",
  "https://nabaperks.com/about",
  "https://nabaperks.com/privacy",
  "https://nabaperks.com/terms",
  "https://nabaperks.com/cookies",
  "https://nabaperks.com/merchant-terms",
  "https://nabaperks.com/data-processing",
] as const

const NON_INDEXABLE_MARKETING_ROUTES = [
  "/signup",
  "/loyalty-for-cafes",
  "/loyalty-for-bars",
  "/loyalty-for-takeaways",
] as const

const ACQUISITION_ROUTES = ["/", "/pricing", "/signup"] as const

const PRIVATE_AUTH_ROUTES = ["/login", "/reset-password"] as const

test.describe("@public-route-metadata", () => {
  // Metadata proof must always come from the current server output, never a
  // previously installed PWA navigation cache.
  test.use({ serviceWorkers: "block" })

  // One test per route (a11y-sweep pattern): a fresh page per navigation keeps
  // the one-time service-worker claim reload from interrupting a second goto.
  for (const route of ACQUISITION_ROUTES) {
    test(`description budget and self-canonical: ${route}`, async ({
      page,
    }) => {
      await page.goto(route)

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content")
      expect(description, `${route} serves a meta description`).toBeTruthy()
      // Code points, not UTF-16 units or bytes (the em-dash measurement trap).
      const length = [...(description ?? "")].length
      expect(
        length,
        `${route} description is ${length} code points (budget 145-159)`
      ).toBeGreaterThanOrEqual(145)
      expect(
        length,
        `${route} description is ${length} code points (budget 145-159)`
      ).toBeLessThanOrEqual(159)

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href")
      // Next.js resolves the root canonical to the bare origin (no trailing
      // slash); every other route resolves to origin + path.
      expect(canonical, `${route} carries a self-canonical`).toBe(
        route === "/"
          ? "https://nabaperks.com"
          : `https://nabaperks.com${route}`
      )
    })
  }

  test("signup serves its own acquisition head, not the root fallback", async ({
    page,
  }) => {
    await page.goto("/signup")

    await expect(page).toHaveTitle(/Start Your Free Pilot/)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Start Your Free Pilot/
    )
  })

  test("merchant terms route is noindexed while legal copy requires review", async ({
    page,
  }) => {
    const response = await page.goto("/merchant/unknown-venue/terms")

    expect(response?.ok()).toBe(true)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /nofollow/
    )
    await expect(page.getByText(/Terms unavailable/)).toBeVisible()
  })

  test("public discovery files expose the approved indexable route registry", async ({
    request,
  }) => {
    const sitemapResponse = await request.get("/sitemap.xml")
    const llmsResponse = await request.get("/llms.txt")

    expect(sitemapResponse.ok()).toBe(true)
    expect(llmsResponse.ok()).toBe(true)

    const sitemap = await sitemapResponse.text()
    const llms = await llmsResponse.text()

    for (const url of INDEXABLE_SITE_URLS) {
      expect(sitemap).toContain(`<loc>${url}</loc>`)
      expect(llms).toContain(url)
    }

    for (const route of NON_INDEXABLE_MARKETING_ROUTES) {
      expect(sitemap).not.toContain(`<loc>https://nabaperks.com${route}</loc>`)
      expect(llms).not.toContain(`https://nabaperks.com${route}`)
    }
  })

  for (const route of NON_INDEXABLE_MARKETING_ROUTES) {
    test(`${route} is noindex but allows link discovery`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/
      )
      await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
        "content",
        /nofollow/
      )
    })
  }

  for (const route of PRIVATE_AUTH_ROUTES) {
    test(`${route} keeps account access out of search results`, async ({
      page,
    }) => {
      await page.goto(route)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/
      )
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /nofollow/
      )
    })
  }
})
