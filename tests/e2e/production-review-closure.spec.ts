import { expect, test } from "@playwright/test"

test("private admin routes emit noindex and nofollow @MS-production-index-performance", async ({
  page,
}) => {
  await page.goto("/admin")

  const robots = page.locator('meta[name="robots"]')
  await expect(robots).toHaveAttribute("content", /noindex/)
  await expect(robots).toHaveAttribute("content", /nofollow/)
})
