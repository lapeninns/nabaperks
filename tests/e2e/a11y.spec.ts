import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"

const surfaces = [
  { name: "home", path: "/", expected: "Nabaperks" },
  {
    name: "pricing",
    path: "/pricing",
    expected: "One price. The whole machine.",
  },
  {
    name: "merchant unavailable",
    path: "/m/missing-merchant",
    expected: "Page not found",
  },
  {
    name: "customer qr unavailable",
    path: "/q/missing-qr",
    expected: "Card unavailable",
  },
  {
    name: "customer join preview",
    path: "/dev/customer-flow/preview/join-hero",
    expected: "Keep your card on your phone",
  },
  {
    name: "customer reward preview",
    path: "/dev/customer-flow/preview/reward-ready",
    expected: "Customer reward",
  },
  {
    name: "launch preview",
    path: "/dev/launch-preview/live-kit",
    expected: "Launch kit",
  },
  {
    name: "design system",
    path: "/dev/design-system",
    expected: "Design system catalog",
  },
  { name: "offline", path: "/offline", expected: "You're offline" },
  { name: "not found", path: "/missing-route", expected: "Page not found" },
] as const

test.describe("accessibility (WCAG 2 A/AA)", () => {
  for (const surface of surfaces) {
    test(`${surface.name} has no automated violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(surface.path)

      if (surface.name === "customer reward preview") {
        await expect(
          page.locator(
            '[data-customer-flow-preview="reward-ready"][data-screen-label="Customer reward"]'
          )
        ).toBeVisible()
      } else {
        await expect(page.getByText(surface.expected).first()).toBeVisible()
      }

      await expectNoAxeViolations(page, surface.name)
    })
  }
})
