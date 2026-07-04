import { expect, test } from "@playwright/test"

const routes = [
  { name: "home", path: "/" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "pricing", path: "/pricing" },
  { name: "loyalty-for-pubs", path: "/loyalty-for-pubs" },
  { name: "harness-dashboard", path: "/dev/app-harness/dashboard" },
  { name: "harness-qr", path: "/dev/app-harness/qr" },
] as const

test.describe("visual regression @visual", () => {
  for (const route of routes) {
    test(`Given ${route.name} When it renders Then the viewport matches the approved Wet Ink baseline`, async ({
      page,
    }) => {
      await page.goto(route.path)
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
        `,
      })
      await expect(page.locator("body")).toBeVisible()

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
      })
    })
  }
})
