import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import {
  CUSTOMER_FLOW_PREVIEW_STEPS,
  customerFlowPreviewPath,
} from "../../lib/dev/customer-flow-preview"

const outputRoot = "docs/screenshots/customer-flow"

test("captures mocked customer flow screens from the dev harness", async ({
  page,
}) => {
  for (const step of CUSTOMER_FLOW_PREVIEW_STEPS) {
    await page.goto(customerFlowPreviewPath(step.id))
    await expect(page.locator(`[data-customer-flow-preview="${step.id}"]`)).toBeVisible()
    await expect(page.locator(`[data-screen-label="${step.screenLabel}"]`).first()).toBeVisible()

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
