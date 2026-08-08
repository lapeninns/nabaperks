import { expect, test } from "@playwright/test"

/**
 * A merchant or a regulator files the terms by printing them. Before this
 * guard the printed sheet carried the sticky site header and the four-column
 * marketing footer: measured at print media on /terms, both still rendered,
 * and the document was 5,694px against 5,230px without them.
 *
 * The rule is scoped with `:has([data-legal-document])`, so the second
 * assertion is the load-bearing half — an unscoped `header { display: none }`
 * would strip the chrome off every printed screen in the product.
 */
test.describe("legal print treatment", () => {
  test("Given a legal document When it is printed Then the site chrome is dropped", async ({
    page,
  }) => {
    await page.goto("/terms")
    await page.emulateMedia({ media: "print" })

    await expect(page.locator("header")).toBeHidden()
    await expect(page.locator("footer")).toBeHidden()
    await expect(page.locator("[data-legal-document]").first()).toBeVisible()
  })

  test("Given a non-legal page When it is printed Then the site chrome is kept", async ({
    page,
  }) => {
    await page.goto("/pricing")
    await page.emulateMedia({ media: "print" })

    await expect(page.locator("header")).toBeVisible()
    await expect(page.locator("footer")).toBeVisible()
  })
})
