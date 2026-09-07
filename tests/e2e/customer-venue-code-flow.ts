import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

/**
 * The venue-code fallback on the customer stamp screen, driven by the DB-free
 * `/dev/home-harness/stamp` lane. Registered by both the mobile-safari and
 * the desktop spec shims so one journey runs in every browser project.
 *
 * What it proves: a refused location check offers the six-digit code form; a
 * keyboard-only entry of the code prints the stamp through the ordinary
 * choreography; a wrong code counts down tries and keeps the form; a lockout
 * withholds the form and says when it lifts; the offered state has no axe
 * violations.
 */
export function registerCustomerVenueCodeTests() {
  test.describe("customer venue-code fallback", () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("a refused location check offers the code, and the right code prints the stamp", async ({
      page,
    }) => {
      const root = await refuseLocation(page, "location-blocked")

      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "ask a team member for today's code"
      )
      const form = root.locator("[data-venue-code-form]")
      await expect(form).toBeVisible()
      const input = form.getByLabel("Today's code from a team member")
      await expect(input).toHaveAttribute("inputmode", "numeric")
      await expect(
        form.getByRole("button", { name: "Add my stamp" })
      ).toBeDisabled()

      // Keyboard only: focus the field, type, submit with Enter.
      await input.focus()
      await page.keyboard.type("48 29 13")
      await expect(input).toHaveValue("482913")
      await page.keyboard.press("Enter")

      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(root.getByText("Stamp 4 of 5 added.")).toBeVisible()
      await expect(root.locator("[data-venue-code-form]")).toHaveCount(0)
      await expect(page.locator("[data-submit-count]")).toHaveText("2")
    })

    test("a wrong code counts down tries and keeps the form", async ({
      page,
    }) => {
      const root = await refuseLocation(page, "code-rejected")
      const form = root.locator("[data-venue-code-form]")

      await form.getByLabel("Today's code from a team member").fill("000000")
      await form.getByRole("button", { name: "Add my stamp" }).click()

      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "That code isn't right"
      )
      await expect(root.locator("[data-venue-code-form]")).toContainText(
        "3 tries left"
      )
      await expect(
        root.getByLabel("Today's code from a team member")
      ).toHaveAttribute("aria-invalid", "true")
    })

    test("a lockout withholds the form and names when it lifts", async ({
      page,
    }) => {
      const root = await refuseLocation(page, "code-locked")

      await root
        .locator("[data-venue-code-form]")
        .getByLabel("Today's code from a team member")
        .fill("000000")
      await root.getByRole("button", { name: "Add my stamp" }).click()

      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await expect(root.locator("[data-venue-code-form]")).toHaveCount(0)
      await expect(root.locator("[data-venue-code-locked]")).toContainText(
        "Too many tries"
      )
      await expect(root.locator("[data-venue-code-locked]")).toContainText(
        "try again after"
      )
    })

    test("the offered state has no accessibility violations @a11y", async ({
      page,
    }) => {
      await refuseLocation(page, "location-blocked")
      await expectNoAxeViolations(
        page,
        "customer stamp screen with the venue-code fallback"
      )
    })
  })
}

async function refuseLocation(page: Page, mode: string) {
  await page.goto(`/dev/home-harness/stamp?mode=${mode}&delay=40`)
  const root = page.locator("[data-stamp-phase]")
  await root.getByRole("button", { name: "Add today's stamp" }).click()
  await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
  return root
}
