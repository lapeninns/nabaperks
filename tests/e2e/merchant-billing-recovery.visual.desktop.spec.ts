import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

test("annual billing receipt desktop @visual", async ({ page }) => {
  await dismissPwaInstall(page)
  await page.goto(`${HARNESS_ROUTES.account}?tab=billing&billing=active-year`)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
  await page.locator("nextjs-portal").evaluate((portal) => {
    const style = document.createElement("style")
    style.textContent = ":host { display: none !important; }"
    portal.shadowRoot?.append(style)
  })

  await expect(page.getByText("£699.90 a year", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Paid upfront after the pilot", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Free trial", { exact: true })).toHaveCount(0)
  await expect(page).toHaveScreenshot("annual-billing-receipt.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.04,
  })
})
