import { expect, test } from "@playwright/test"

import { QR_POSTER_TEMPLATE_IDS } from "@/lib/qr/poster-templates"

test.describe("poster printing", () => {
  for (const template of QR_POSTER_TEMPLATE_IDS) {
    test(`${template} poster remains visible in print media`, async ({
      page,
      browserName,
    }) => {
      await page.goto(`/dev/poster-preview?template=${template}`)
      if (browserName === "chromium") {
        await page.evaluate(() => {
          window.print = () => {
            document.documentElement.dataset.printRequested = "true"
          }
        })
        await page.getByRole("button", { name: "Print or save PDF" }).click()
        await expect(page.locator("html")).toHaveAttribute(
          "data-print-requested",
          "true"
        )
      }
      await page.emulateMedia({ media: "print" })

      const printRoot = page.locator(".qr-poster-print-root")
      const posterSheet = printRoot.locator("article")

      await expect(printRoot).toHaveCSS("visibility", "visible")
      await expect(posterSheet).toHaveCSS("visibility", "visible")
      await expect(posterSheet.locator("img")).toHaveJSProperty(
        "naturalWidth",
        900
      )
      await expect(page.locator(".qr-poster-chrome")).toBeHidden()
      await expect(page.locator(".qr-poster-action-bar")).toBeHidden()
    })

    test(`${template} poster generates a nonblank PDF`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", "PDF generation is Chromium-only")

      await page.goto(`/dev/poster-preview?template=${template}`)
      const pdf = await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
      })

      expect(pdf.byteLength).toBeGreaterThan(10_000)
    })
  }
})
