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

  // A visit from the third onwards at a venue with the check on. The browser
  // in these lanes has NOT been granted geolocation, so every location tap
  // answers PERMISSION_DENIED at once — the shape of the reported failure.
  test.describe("customer verified visit", () => {
    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("both methods are offered before any refusal, and no stamp press", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-grace-spent")

      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "Confirm you're at the venue."
      )
      await expect(
        root.getByRole("button", { name: "Use my location" })
      ).toBeEnabled()
      await expect(
        root.getByRole("button", { name: "Enter venue code" })
      ).toBeEnabled()
      await expect(
        root.getByRole("button", { name: "Add today's stamp" })
      ).toHaveCount(0)
      await expect(root.locator("[data-venue-code-form]")).toHaveCount(0)
    })

    test("with the grace spent, ten blocked location taps send nothing and the code still works", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-grace-spent")

      for (let tap = 0; tap < 10; tap += 1) {
        await root.getByRole("button", { name: "Use my location" }).click()
        await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      }
      await expect(page.locator("[data-submit-count]")).toHaveText("0")
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "enter today's venue code"
      )
      await expect(
        root.getByRole("button", { name: "Use my location" })
      ).toBeEnabled()

      // The form opened with the first refusal; the code lands as usual.
      const form = root.locator("[data-venue-code-form]")
      await expect(form).toBeVisible()
      await form.getByLabel("Today's code from a team member").fill("482913")
      await form.getByRole("button", { name: "Add my stamp" }).click()

      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(root.getByText("Stamp 4 of 5 added.")).toBeVisible()
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "Confirmed using today's venue code."
      )
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
    })

    test("the code can be entered first, without a failed location attempt", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-grace-spent")

      await root.getByRole("button", { name: "Enter venue code" }).click()
      const form = root.locator("[data-venue-code-form]")
      await expect(form).toBeVisible()
      await expect(
        root.getByRole("button", { name: "Enter venue code" })
      ).toHaveCount(0)
      await expect(
        root.getByRole("button", { name: "Use my location" })
      ).toBeVisible()

      await form.getByLabel("Today's code from a team member").fill("482913")
      await page.keyboard.press("Enter")
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      await expect(page.locator("[data-last-location-status]")).toHaveText("", {
        timeout: 1000,
      })
    })

    test("with grace left, a blocked location tap is sent once and the stamp lands unverified", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-grace-left")

      await root.getByRole("button", { name: "Use my location" }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      await expect(page.locator("[data-last-location-status]")).toHaveText(
        "denied"
      )
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "Added without a location check. Next time, location or the venue code is needed."
      )
    })

    test("a granted fix is sent with the request", async ({
      page,
      context,
      baseURL,
    }) => {
      if (!baseURL) throw new Error("baseURL is required")
      await context.grantPermissions(["geolocation"], { origin: baseURL })
      await context.setGeolocation({
        latitude: 52.2437,
        longitude: 0.0836,
        accuracy: 12,
      })
      const root = await openVerifiedVisit(page, "verify-located")

      await root.getByRole("button", { name: "Use my location" }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      await expect(page.locator("[data-last-location-status]")).toHaveText(
        "granted"
      )
      await expect(root.locator("[data-stamp-status-band]")).not.toContainText(
        "without a location check"
      )
    })

    test("a throttled stamp path keeps the code on screen", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-rate-limited")

      await root.getByRole("button", { name: "Use my location" }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "Or enter today's venue code below."
      )
      const form = root.locator("[data-venue-code-form]")
      await expect(form).toBeVisible()
      await form.getByLabel("Today's code from a team member").fill("482913")
      await form.getByRole("button", { name: "Add my stamp" }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    })

    test("a code lockout on a verified visit shows only the lockout notice — no press, no location", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-code-locked")
      await root.getByRole("button", { name: "Enter venue code" }).click()
      const form = root.locator("[data-venue-code-form]")
      await form.getByLabel("Today's code from a team member").fill("000000")
      await form.getByRole("button", { name: "Add my stamp" }).click()

      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await expect(root.locator("[data-venue-code-locked]")).toContainText(
        "Too many tries"
      )
      await expect(root.locator("[data-venue-code-form]")).toHaveCount(0)
      await expect(
        root.getByRole("button", { name: "Use my location" })
      ).toHaveCount(0)
      await expect(
        root.getByRole("button", {
          name: /add today's stamp|try today's stamp again/i,
        })
      ).toHaveCount(0)
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
    })

    test("a throttled code path withholds the form but keeps location", async ({
      page,
    }) => {
      const root = await openVerifiedVisit(page, "verify-code-throttled")
      await root.getByRole("button", { name: "Enter venue code" }).click()
      const form = root.locator("[data-venue-code-form]")
      await form.getByLabel("Today's code from a team member").fill("482913")
      await form.getByRole("button", { name: "Add my stamp" }).click()

      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await expect(root.locator("[data-stamp-status-band]")).toContainText(
        "Too many code tries in a row"
      )
      await expect(root.locator("[data-stamp-status-band]")).not.toContainText(
        "venue code below"
      )
      await expect(root.locator("[data-venue-code-form]")).toHaveCount(0)
      await expect(
        root.getByRole("button", { name: "Use my location" })
      ).toBeEnabled()
      await expect(
        root.getByRole("button", {
          name: /add today's stamp|try today's stamp again/i,
        })
      ).toHaveCount(0)
    })

    test("the verified-visit offer has no accessibility violations @a11y", async ({
      page,
    }) => {
      await openVerifiedVisit(page, "verify-grace-spent")
      await expectNoAxeViolations(
        page,
        "customer stamp screen offering location and venue code"
      )
    })
  })
}

async function openVerifiedVisit(page: Page, mode: string) {
  await page.goto(`/dev/home-harness/stamp?mode=${mode}&delay=40`)
  const root = page.locator("[data-stamp-phase]")
  await expect(root).toHaveAttribute("data-stamp-phase", "idle")
  return root
}

async function refuseLocation(page: Page, mode: string) {
  await page.goto(`/dev/home-harness/stamp?mode=${mode}&delay=40`)
  const root = page.locator("[data-stamp-phase]")
  await root.getByRole("button", { name: "Add today's stamp" }).click()
  await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
  return root
}
