import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import {
  CUSTOMER_FLOW_PREVIEW_STEPS,
  customerFlowPreviewPath,
} from "../../lib/dev/customer-flow-preview"

const outputRoot = "docs/screenshots/customer-flow"

// Floating overlays that are not part of the customer flow under test: the
// Next.js dev overlay, plus the PWA "Install Nabaperks / Add to Home Screen"
// hint, which floats over the mock screens at the iPhone width this project
// emulates and obscures primary content (e.g. the "Add today's stamp" button on
// the stamp-confirm screen). The hint's production component
// (components/pwa/app-pwa.tsx) always renders its root as
// `<aside aria-label="Install Nabaperks">`.
const NON_FLOW_OVERLAY_SELECTORS =
  'nextjs-portal, [data-nextjs-dev-overlay="true"], aside[aria-label="Install Nabaperks"]'

// Dismissal flag the install-hint component already honours on mount; setting it
// before the first navigation makes the component unmount itself so it never
// renders over the captured screens. Test-only — no production code is changed.
const PWA_INSTALL_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

test("captures mocked customer flow screens from the dev harness", async ({
  page,
}) => {
  await page.addInitScript((dismissKey) => {
    window.localStorage.setItem(dismissKey, "1")
  }, PWA_INSTALL_DISMISS_KEY)

  for (const step of CUSTOMER_FLOW_PREVIEW_STEPS) {
    await page.goto(customerFlowPreviewPath(step.id))
    await expect(
      page.locator(`[data-customer-flow-preview="${step.id}"]`)
    ).toBeVisible()
    await expect(
      page.locator(`[data-screen-label="${step.screenLabel}"]`).first()
    ).toBeVisible()

    await capture(page, step.screenshot)
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
      ${NON_FLOW_OVERLAY_SELECTORS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate((selectors) => {
    for (const element of document.querySelectorAll(selectors)) {
      element.setAttribute("aria-hidden", "true")

      if (element instanceof HTMLElement) {
        element.style.display = "none"
        element.style.visibility = "hidden"
      }
    }
  }, NON_FLOW_OVERLAY_SELECTORS)
}
