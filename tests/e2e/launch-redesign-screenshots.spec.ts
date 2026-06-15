import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import {
  LAUNCH_PREVIEW_STATES,
  launchPreviewPath,
} from "../../lib/dev/launch-preview"

const outputRoot = "docs/screenshots/launch"

test.use({
  viewport: { width: 1280, height: 900 },
  isMobile: false,
  hasTouch: false,
  deviceScaleFactor: 2,
  // Desktop UA so the merchant console renders at desktop breakpoints and the
  // iOS-only PWA install hint stays out of the capture.
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
})

test("captures the redesigned launch hub from the dev harness", async ({
  page,
}) => {
  for (const state of LAUNCH_PREVIEW_STATES) {
    await page.goto(launchPreviewPath(state.id))
    await expect(
      page.locator(`[data-launch-preview="${state.id}"]`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-screen-label="${state.screenLabel}"]`).first()
    ).toBeVisible()

    await capture(page, state.screenshot)
  }
})

async function capture(page: Page, relativePath: string): Promise<void> {
  const target = join(outputRoot, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: target, fullPage: true })
}

async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-overlay="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate(() => {
    const selectors = "nextjs-portal, [data-nextjs-dev-overlay='true']"

    for (const element of document.querySelectorAll(selectors)) {
      element.setAttribute("aria-hidden", "true")

      if (element instanceof HTMLElement) {
        element.style.display = "none"
        element.style.visibility = "hidden"
      }
    }
  })
}
