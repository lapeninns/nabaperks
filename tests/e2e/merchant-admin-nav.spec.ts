import { expect, test, type Page } from "@playwright/test"

import { previewPath } from "../../lib/dev/merchant-admin-preview"

/**
 * Mobile navigation interaction for the merchant/admin console shells. The
 * screenshot spec proves the layouts do not overflow; this spec proves the
 * mobile sidebar Sheet is operable at a phone width: the trigger has an
 * accessible name and a >=44px hit area, the Sheet opens and lists the nav
 * links, the surface's tab is marked active (driven by the `/dev` `activePath`
 * override), the trigger and items meet the 44px touch-target floor, and link
 * selection plus Escape close the Sheet. Both consoles are exercised via their
 * `-customers` surface.
 */

const PHONE = { width: 375, height: 812 } as const
const MIN_TAP_TARGET = 44

// Floating overlays that are not part of the console UI under test: the Next.js
// dev overlay plus the PWA "Install Nabaperks" hint, which floats over the
// console at the iPhone width this project emulates. Mirrors the suppression in
// merchant-admin-redesign-screenshots.spec.ts so the Sheet/trigger is not
// obscured. The hint's production root is `<aside aria-label="Install Nabaperks">`.
const NON_CONSOLE_OVERLAY_SELECTORS =
  'nextjs-portal, [data-nextjs-dev-overlay="true"], aside[aria-label="Install Nabaperks"]'

// Dismissal flag the install-hint component honours on mount; setting it makes
// the component unmount itself. Test-only — no production code is changed.
const PWA_INSTALL_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

async function suppressNonConsoleOverlays(page: Page): Promise<void> {
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
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error
        }
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

async function expectAtLeastTapTarget(
  locator: ReturnType<Page["getByRole"]>,
  label: string
): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, `${label} should have a bounding box`).not.toBeNull()
  expect(
    box?.height ?? 0,
    `${label} height ≥ ${MIN_TAP_TARGET}px`
  ).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
}

type NavCase = {
  console: "merchant" | "admin"
  surfaceId: "merchant-customers" | "admin-customers"
  links: string[]
  activeLabel: string
}

const CASES: NavCase[] = [
  {
    console: "merchant",
    surfaceId: "merchant-customers",
    links: ["Home", "Launch", "Customers", "Activity", "Profile", "Billing"],
    activeLabel: "Customers",
  },
  {
    console: "admin",
    surfaceId: "admin-customers",
    links: [
      "Pilot",
      "Merchants",
      "Customers",
      "Billing",
      "Privacy",
      "Fraud",
      "Audit",
    ],
    activeLabel: "Customers",
  },
]

for (const navCase of CASES) {
  test(`${navCase.console} mobile nav opens, marks the active surface, and closes`, async ({
    page,
  }) => {
    // First hit per route compiles under Turbopack; give it room.
    test.setTimeout(120_000)

    await page.setViewportSize(PHONE)
    await page.goto(previewPath(navCase.surfaceId))

    // Readiness anchor shared with the screenshot/a11y specs.
    await expect(
      page.locator(`[data-ma-preview="${navCase.surfaceId}"]`)
    ).toBeVisible()

    await suppressNonConsoleOverlays(page)

    const trigger = page.getByRole("button", { name: "Toggle Sidebar" })
    await expect(trigger).toBeVisible()
    await expectAtLeastTapTarget(trigger, `${navCase.console} menu trigger`)

    // Open the Sheet via the trigger.
    await trigger.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Every nav link is listed and reachable inside the Sheet.
    for (const label of navCase.links) {
      const link = dialog.getByRole("link", { name: label, exact: true })
      await expect(link).toBeVisible()
      await expectAtLeastTapTarget(
        link,
        `${navCase.console} "${label}" nav item`
      )
    }

    // The surface's tab is marked active via the `activePath` override:
    // `aria-current="page"` + the active `data-active` styling hook.
    const activeLink = dialog.getByRole("link", {
      name: navCase.activeLabel,
      exact: true,
    })
    await expect(activeLink).toHaveAttribute("aria-current", "page")
    await expect(activeLink).toHaveAttribute("data-active", "true")

    // A non-active sibling must NOT be marked current.
    const inactiveLabel = navCase.links.find(
      (label) => label !== navCase.activeLabel
    )
    if (!inactiveLabel) {
      throw new Error("Expected a non-active nav label")
    }
    const inactiveLink = dialog.getByRole("link", {
      name: inactiveLabel,
      exact: true,
    })
    await expect(inactiveLink).not.toHaveAttribute("aria-current", "page")

    await inactiveLink.click()
    await expect(dialog).toBeHidden()

    await page.goto(previewPath(navCase.surfaceId))
    await expect(
      page.locator(`[data-ma-preview="${navCase.surfaceId}"]`)
    ).toBeVisible()
    await suppressNonConsoleOverlays(page)
    await trigger.click()
    await expect(dialog).toBeVisible()

    // Keyboard close: Escape dismisses the Sheet (Radix Dialog behaviour).
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })
}
