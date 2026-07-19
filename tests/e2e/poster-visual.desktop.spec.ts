import { expect, test } from "@playwright/test"

import { QR_POSTER_TEMPLATE_IDS } from "@/lib/qr/poster-templates"

/**
 * Wet Ink baselines for every registered A4 poster sheet — the eight
 * counter-kit concepts (Nº 06–15). The sheet element is snapshotted (not
 * the preview chrome) at the default three-stamp card so the artwork, not
 * the harness, is under test.
 */
test.describe("poster sheet visual regression @visual", () => {
  for (const template of QR_POSTER_TEMPLATE_IDS) {
    test(`Given the ${template} poster When it renders Then the sheet matches its approved baseline`, async ({
      page,
    }) => {
      await page.goto(`/dev/poster-preview?template=${template}`)
      const poster = page.locator(".qr-poster-print-root article")
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
            /* Capture the sheet at its true A4 pixel size: the preview's
               fractional fit-to-viewport scale rasterises with run-to-run
               anti-aliasing jitter. */
            .qr-poster-print-root {
              --poster-screen-scale: 1 !important;
            }
          `,
        })
        await expect(poster).toBeVisible()
        await page.evaluate(async () => {
          await document.fonts.ready
        })
      }).toPass({ timeout: 15_000 })
      const qr = poster.locator("img")
      await expect(qr).toHaveCount(1)
      await expect
        .poll(() =>
          qr.evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0
          )
        )
        .toBe(true)
      await expect(poster).toHaveScreenshot(`poster-${template}.png`, {
        maxDiffPixelRatio: 0.001,
      })
    })
  }
})
