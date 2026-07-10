import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const routes = [
  { name: "home", path: "/" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "pricing", path: "/pricing" },
  { name: "loyalty-for-pubs", path: "/loyalty-for-pubs" },
  { name: "loyalty-for-cafes", path: "/loyalty-for-cafes" },
  { name: "loyalty-for-takeaways", path: "/loyalty-for-takeaways" },
  { name: "loyalty-for-bars", path: "/loyalty-for-bars" },
  { name: "auth-signup", path: "/signup" },
  {
    name: "auth-signup-verify",
    path: "/signup/verify?email=operator%40example.test&name=Alex%20Morgan",
  },
  { name: "auth-login", path: "/login" },
  {
    name: "auth-reset-password",
    path: "/reset-password?email=operator%40example.test",
  },
  { name: "harness-dashboard", path: "/dev/app-harness/dashboard" },
  { name: "harness-qr", path: "/dev/app-harness/qr" },
  {
    name: "harness-launch-billing",
    path: "/dev/app-harness/launch?tab=billing&state=billing",
  },
  { name: "harness-onboarding", path: "/dev/app-harness/onboarding" },
  {
    name: "harness-dashboard-empty",
    path: "/dev/app-harness/dashboard?members=empty",
  },
] as const

const auditClosureRoutes = new Set([
  "harness-launch-billing",
  "harness-onboarding",
  "harness-dashboard-empty",
])

test.describe("visual regression @visual", () => {
  for (const route of routes) {
    const microSpecTag = auditClosureRoutes.has(route.name)
      ? " @MS-merchant-ux-audit-closure"
      : ""

    test(`Given ${route.name} When it renders Then the viewport matches the approved Wet Ink baseline${microSpecTag}`, async ({
      page,
    }) => {
      const isAuthRoute = route.name.startsWith("auth-")
      const hideDevOverlay = isAuthRoute || auditClosureRoutes.has(route.name)
      if (isAuthRoute) await dismissPwaInstall(page)
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
          ${hideDevOverlay ? "nextjs-portal, [data-nextjs-dev-overlay='true'] { display: none !important; }" : ""}
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
