import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import {
  MERCHANT_ADMIN_PREVIEW_SCREENS,
  previewPath,
} from "../../lib/dev/merchant-admin-preview"

const outputRoot = "docs/screenshots/merchant-admin"

// The merchant/admin console redesign is measured at a phone, tablet, and
// desktop width so the no-horizontal-overflow guard catches layouts that only
// break at a single breakpoint.
const WIDTHS = [
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
  { w: 1280, h: 900 },
] as const

for (const surface of MERCHANT_ADMIN_PREVIEW_SCREENS) {
  for (const { w: width, h: height } of WIDTHS) {
    test(`${surface.id} @ ${width}px has no horizontal overflow`, async ({
      page,
    }) => {
      // First hit per route compiles under Turbopack; give it room.
      test.setTimeout(120_000)

      await page.setViewportSize({ width, height })
      await page.goto(previewPath(surface.id))

      // Readiness: the preview wrapper must be mounted before measuring.
      await expect(
        page.locator(`[data-ma-preview="${surface.id}"]`)
      ).toBeVisible()

      // Capture BEFORE asserting so the screenshot persists even when the
      // overflow assertion fails (the redesign worklist needs the evidence).
      await capture(page, join(surface.console, `${surface.id}-${width}.png`))

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )

      // 1px tolerance for sub-pixel rounding.
      expect(
        overflow,
        `${surface.id} @ ${width}px horizontal overflow`
      ).toBeLessThanOrEqual(1)
    })
  }
}

async function capture(page: Page, relativePath: string): Promise<void> {
  const target = join(outputRoot, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: target, fullPage: true })
}

// Floating overlays that are not part of the console UI under test: the Next.js
// dev overlay, plus the PWA "Install Nabaperks / Add to Home Screen" hint, which
// floats over the console at the iPhone width this project emulates. The hint's
// production component (components/pwa/app-pwa.tsx) always renders its root as
// `<aside aria-label="Install Nabaperks">`.
const NON_CONSOLE_OVERLAY_SELECTORS =
  'nextjs-portal, [data-nextjs-dev-overlay="true"], aside[aria-label="Install Nabaperks"]'

// Dismissal flag the install-hint component already honours on mount; setting it
// makes the component unmount itself. Test-only — no production code is changed.
const PWA_INSTALL_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      ${NON_CONSOLE_OVERLAY_SELECTORS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate(
    ({ selectors, dismissKey }) => {
      try {
        window.localStorage.setItem(dismissKey, "1")
      } catch {
        // localStorage may be unavailable; the CSS above still hides the hint.
      }

      for (const element of document.querySelectorAll(selectors)) {
        element.setAttribute("aria-hidden", "true")

        if (element instanceof HTMLElement) {
          element.style.display = "none"
          element.style.visibility = "hidden"
        }
      }
    },
    {
      selectors: NON_CONSOLE_OVERLAY_SELECTORS,
      dismissKey: PWA_INSTALL_DISMISS_KEY,
    }
  )
}
