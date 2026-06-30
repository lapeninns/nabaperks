import { expect, test } from "@playwright/test"

const PUBLIC_SITE_URLS = [
  "https://nabaperks.com/",
  "https://nabaperks.com/loyalty-for-pubs",
  "https://nabaperks.com/pricing",
  "https://nabaperks.com/about",
  "https://nabaperks.com/guides/best-loyalty-ideas-for-pubs",
  "https://nabaperks.com/guides/reward-regulars-without-an-app",
  "https://nabaperks.com/guides/paper-vs-qr-loyalty-for-pubs",
  "https://nabaperks.com/signup",
  "https://nabaperks.com/privacy",
  "https://nabaperks.com/terms",
] as const

test.describe("@public-route-metadata", () => {
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
    await expect(page.getByText(/Terms unavailable|Review required/)).toBeVisible()
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

    for (const url of PUBLIC_SITE_URLS) {
      expect(sitemap).toContain(`<loc>${url}</loc>`)
      expect(llms).toContain(url)
    }
  })
})
