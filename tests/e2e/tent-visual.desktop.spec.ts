import { expect, test } from "@playwright/test"

import { TENT_DESIGN_IDS } from "@/lib/qr/tent-templates"

/**
 * Wet Ink baselines for every A4 fold-to-peak table tent. The sheet is
 * captured at its true A4 pixel size (scale 1) so the fold, the rotated back
 * face and both QRs stay stable run to run.
 */
test.describe("table tent visual regression @visual", () => {
  for (const design of TENT_DESIGN_IDS) {
    test(`Given the ${design} tent When it renders Then the sheet matches its approved baseline`, async ({
      page,
    }) => {
      await page.goto(`/dev/tent-preview?design=${design}`)
      const sheet = page.locator(".qr-poster-print-root article")
      await expect(async () => {
        await page.addStyleTag({
          content: `
            *,
            *::before,
            *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
            nextjs-portal,
            [data-nextjs-dev-overlay='true'] {
              display: none !important;
            }
            .qr-poster-print-root {
              --tent-screen-scale: 1 !important;
            }
          `,
        })
        await expect(sheet).toBeVisible()
        await page.evaluate(async () => {
          await document.fonts.ready
        })
      }).toPass({ timeout: 15_000 })
      const qrImages = sheet.locator("img")
      await expect(qrImages).toHaveCount(2)
      await expect
        .poll(() =>
          qrImages
            .first()
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0
            )
        )
        .toBe(true)
      await expect(sheet).toHaveScreenshot(`tent-${design}.png`, {
        maxDiffPixelRatio: 0.001,
      })
    })
  }
})
