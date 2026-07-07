import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./harness"

const PUBLIC_ROUTES = [
  "/",
  "/how-it-works",
  "/pricing",
  "/about",
  "/loyalty-for-pubs",
  "/loyalty-for-cafes",
  "/loyalty-for-takeaways",
  "/loyalty-for-bars",
  "/privacy",
  "/terms",
  "/offline",
  "/guides/best-loyalty-ideas-for-pubs",
  "/guides/reward-regulars-without-an-app",
  "/guides/paper-vs-qr-loyalty-for-pubs",
  "/signup",
  "/signup/verify?email=test@example.com",
  "/login",
  "/reset-password",
  "/home/login",
  "/start",
] as const

const HARNESS_LANES = [
  HARNESS_ROUTES.dashboard,
  HARNESS_ROUTES.customers,
  HARNESS_ROUTES.activity,
  HARNESS_ROUTES.account,
  HARNESS_ROUTES.qr,
  HARNESS_ROUTES.scan,
  HARNESS_ROUTES.rewardScan,
  HARNESS_ROUTES.launch,
  HARNESS_ROUTES.onboarding,
  HARNESS_ROUTES.skeletons,
  HARNESS_ROUTES.states,
  HARNESS_ROUTES.designSystem,
  HARNESS_ROUTES.posterPreview,
] as const

const A11Y_ROUTES = [...PUBLIC_ROUTES, ...HARNESS_LANES] as const

export function defineA11yRouteSweep(label: string): void {
  test.describe(`${label} @a11y WCAG 2 A/AA sweep`, () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    for (const route of A11Y_ROUTES) {
      test(`no axe violations: ${route}`, async ({ page }) => {
        const response = await page.goto(route)
        if (!response) {
          throw new Error(`${route} did not return a document response`)
        }
        expect(
          response.status(),
          `${route} did not resolve (status ${response.status()})`
        ).toBeLessThan(400)
        await expectNoAxeViolations(page, route)
      })
    }
  })
}
