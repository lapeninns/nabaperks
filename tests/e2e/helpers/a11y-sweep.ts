import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./harness"

const PUBLIC_ROUTES = [
  "/",
  "/how-it-works",
  "/faq",
  "/pricing",
  "/loyalty-for-pubs",
  "/loyalty-for-cafes",
  "/loyalty-for-bars",
  "/loyalty-for-takeaways",
  "/guides/reward-regulars-without-an-app",
  "/guides/best-loyalty-ideas-for-pubs",
  "/guides/paper-vs-qr-loyalty-for-pubs",
  "/about",
  "/demo",
  "/privacy",
  "/terms",
  "/cookies",
  "/merchant-terms",
  "/data-processing",
  "/offline",
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
  // The offers lane renders one surface per request, so each surface is its own
  // sweep entry — otherwise the creator, the customer faces and the staff
  // redemption screen would never be audited.
  HARNESS_ROUTES.offers,
  `${HARNESS_ROUTES.offers}?surface=creator&step=benefits`,
  `${HARNESS_ROUTES.offers}?surface=creator&step=rules`,
  `${HARNESS_ROUTES.offers}?surface=creator&step=review`,
  `${HARNESS_ROUTES.offers}?surface=customer`,
  `${HARNESS_ROUTES.offers}?surface=staff`,
  HARNESS_ROUTES.skeletons,
  HARNESS_ROUTES.states,
  HARNESS_ROUTES.designSystem,
  HARNESS_ROUTES.posterPreview,
  HARNESS_ROUTES.tentPreview,
] as const

const A11Y_ROUTES = [...PUBLIC_ROUTES, ...HARNESS_LANES] as const

/**
 * The four offer surfaces, audited again at each named width.
 *
 * Every other route in this sweep is audited at whatever viewport its project
 * carries. The offer surfaces are swept at three widths instead because their
 * layouts change at two breakpoints — the creator's review step gains a second
 * column and the desk's metric tiles regroup — and a reading order or a target
 * size that is fine in one arrangement is not automatically fine in the others.
 */
const OFFER_BREAKPOINT_ROUTES = [
  HARNESS_ROUTES.offers,
  `${HARNESS_ROUTES.offers}?surface=creator&step=review`,
  `${HARNESS_ROUTES.offers}?surface=customer`,
  `${HARNESS_ROUTES.offers}?surface=staff`,
] as const

const A11Y_BREAKPOINTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const

async function auditRoute(page: Page, route: string): Promise<void> {
  const response = await page.goto(route)
  if (!response) {
    throw new Error(`${route} did not return a document response`)
  }
  expect(
    response.status(),
    `${route} did not resolve (status ${response.status()})`
  ).toBeLessThan(400)
  await expectNoAxeViolations(page, route)
}

export function defineA11yRouteSweep(label: string): void {
  test.describe(`${label} @a11y WCAG 2 A/AA sweep`, () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    for (const route of A11Y_ROUTES) {
      test(`no axe violations: ${route}`, async ({ page }) => {
        await auditRoute(page, route)
      })
    }
  })

  for (const breakpoint of A11Y_BREAKPOINTS) {
    test.describe(`${label} @a11y offers at ${breakpoint.width}px`, () => {
      test.use({ viewport: breakpoint })

      test.beforeEach(async ({ page }) => {
        await dismissPwaInstall(page)
      })

      for (const route of OFFER_BREAKPOINT_ROUTES) {
        test(`no axe violations at ${breakpoint.width}px: ${route}`, async ({
          page,
        }) => {
          await auditRoute(page, route)
        })
      }
    })
  }
}
