import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const routes = [
  { name: "marketing-landing", path: "/" },
  { name: "marketing-how-it-works", path: "/how-it-works" },
  { name: "marketing-faq", path: "/faq" },
  { name: "marketing-pricing", path: "/pricing" },
  { name: "marketing-loyalty-for-pubs", path: "/loyalty-for-pubs" },
  {
    name: "marketing-guide-paper-vs-qr",
    path: "/guides/paper-vs-qr-loyalty-for-pubs",
  },
  { name: "marketing-demo", path: "/demo" },
  { name: "marketing-about", path: "/about" },
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
  // The offers lane renders one surface per request. Each of the four carries a
  // state the others cannot show, so each needs its own baseline.
  { name: "harness-offers-desk", path: "/dev/app-harness/offers" },
  {
    name: "harness-offers-creator",
    path: "/dev/app-harness/offers?surface=creator&step=review",
  },
  {
    name: "harness-offers-customer",
    path: "/dev/app-harness/offers?surface=customer",
  },
  {
    name: "harness-offers-staff",
    path: "/dev/app-harness/offers?surface=staff",
  },
] as const

const auditClosureRoutes = new Set([
  "harness-launch-billing",
  "harness-onboarding",
  "harness-dashboard-empty",
])

test.describe("visual regression @visual", () => {
  for (const route of routes) {
    const auditTag = auditClosureRoutes.has(route.name)
      ? " @merchant-ux-audit"
      : ""

    test(`Given ${route.name} When it renders Then the viewport matches the approved Wet Ink baseline${auditTag}`, async ({
      page,
    }, testInfo) => {
      const isAuthRoute = route.name.startsWith("auth-")
      if (isAuthRoute) await dismissPwaInstall(page)
      await page.goto(route.path)
      await expect(async () => {
        await page.waitForLoadState("domcontentloaded")
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
          `,
        })
        await expect(page.locator("body")).toBeVisible()
        await page.evaluate(async () => {
          await document.fonts.ready
        })
      }).toPass({ timeout: 15_000 })
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              getComputedStyle(document.documentElement)
                .getPropertyValue("--background")
                .trim().length > 0
          )
        )
        .toBe(true)
      if (
        route.name === "marketing-loyalty-for-pubs" &&
        testInfo.project.name === "mobile-safari"
      ) {
        // The mobile guide spine hides its server-rendered list after hydration.
        // Wait for that stable post-hydration state before taking a full-page
        // screenshot, otherwise the list can be captured mid-transition.
        await expect(
          page.locator('[aria-controls="pub-guide-spine-list"]')
        ).toBeVisible()
      }
      if (
        route.name === "harness-dashboard" ||
        route.name === "harness-dashboard-empty"
      ) {
        const qr = page.getByRole("img", {
          name: "QR code for Old Crown Girton",
        })
        await expect(qr).toBeVisible()
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
      }

      const strictComparison =
        route.name === "harness-dashboard" ||
        route.name === "harness-dashboard-empty" ||
        (testInfo.project.name === "mobile-safari" &&
          route.name === "harness-qr")
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: strictComparison ? 0.001 : 0.04,
      })
    })
  }
})
