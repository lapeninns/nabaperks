import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"

/**
 * Smoke + accessibility coverage for the public, auth, and legal surfaces a
 * logged-out visitor can reach without a session, plus the safe-failure
 * behaviour of invalid public routes. The customer-card/reward routes resolve
 * the customer session before touching the database, so an anonymous visitor to
 * a random id lands on the calm "Card unavailable" recovery panel rather than a
 * stack trace — and the raw id is never echoed back into the page body.
 *
 * Every asserted string is the copy production renders (route pages, the legal
 * content module, and the customer-experience view model), so this guards the
 * real surfaces, not a fixture. No auth and no DB writes: each surface is either
 * fully public or short-circuits on the missing session.
 */

// Each surface renders a real heading/copy string and must pass the same WCAG 2
// A/AA axe gate as a11y.spec.ts. Titles are asserted by heading role + level so
// the marketing-layout chrome ("Nabaperks" wordmark) never causes a strict-mode
// multiple-match on the plain wordmark text.
const publicSurfaces = [
  {
    name: "start",
    path: "/start",
    heading: { level: 1, name: "Welcome to Nabaperks" },
  },
  {
    name: "merchant login",
    path: "/login",
    heading: { level: 2, name: "Continue merchant setup" },
  },
  {
    name: "merchant signup",
    path: "/signup",
    heading: { level: 2, name: "Start your 30-day free pilot" },
  },
  {
    name: "privacy notice",
    path: "/privacy",
    heading: { level: 1, name: "What happens to the data." },
  },
  {
    name: "platform terms",
    path: "/terms",
    heading: { level: 1, name: "The small print, kept legible." },
  },
  {
    name: "merchant terms",
    path: "/merchant/old-crown-girton/terms",
    heading: { level: 1, name: "Old Crown Girton loyalty terms" },
  },
] as const

test.describe("public, auth, and legal surfaces", () => {
  for (const surface of publicSurfaces) {
    test(`${surface.name} renders and has no automated violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(surface.path)

      await expect(
        page.getByRole("heading", {
          level: surface.heading.level,
          name: surface.heading.name,
        })
      ).toBeVisible()

      await expectNoAxeViolations(page, surface.name)
    })
  }

  test("merchant login surfaces the email + password form", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/login")

    await expect(
      page.getByText(
        "Use the email and password for your Nabaperks merchant account."
      )
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible()
  })

  test("merchant signup surfaces the create-account form", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/signup")

    await expect(page.getByText("Your first stamp is waiting.")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Create merchant account" })
    ).toBeVisible()
  })

  test("privacy notice carries the pre-launch review banner", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/privacy")

    await expect(page.getByText("Privacy, condensed").first()).toBeVisible()
    await expect(page.getByText("Review required").first()).toBeVisible()
  })

  test("platform terms carries the pre-launch review banner", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/terms")

    await expect(page.getByText("Terms, condensed").first()).toBeVisible()
    await expect(page.getByText("Review required").first()).toBeVisible()
  })

  test("merchant terms shows the venue earning rule and review banner", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/merchant/old-crown-girton/terms")

    await expect(page.getByText("Reward terms").first()).toBeVisible()
    await expect(
      page.getByText(
        "Collect 3 visit stamps from the venue QR. One stamp may be issued per UK date."
      )
    ).toBeVisible()
    await expect(page.getByText("Review required").first()).toBeVisible()
  })
})

// A non-existent membership/reward id, scanned by an anonymous visitor, must
// resolve to the calm recovery panel — never a redirect loop, a stack, or the
// raw id reflected into the page. The id only ever appears inside the
// "Open my cards" recovery href (an attribute), which `toContainText` ignores.
const badMembershipId = "00000000-0000-0000-0000-0000000000ff"
const badRewardId = "00000000-0000-0000-0000-0000000000fe"

test.describe("invalid public states fail safe without leaking the id", () => {
  test("invalid card id shows the recovery panel, not the raw id", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(`/card/${badMembershipId}`)

    await expect(
      page.locator('[data-screen-label="Customer flow"]')
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 1, name: "Card unavailable" })
    ).toBeVisible()
    await expect(
      page
        .getByText("Verify your identity from the venue QR to continue.")
        .first()
    ).toBeVisible()
    await expect(
      page
        .getByText(
          "Ask a team member for the current loyalty QR, or open your cards to find them."
        )
        .first()
    ).toBeVisible()

    await expect(page.locator("body")).not.toContainText(badMembershipId)

    await expectNoAxeViolations(page, "invalid card id")
  })

  test("invalid reward id shows the recovery panel, not the raw id", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(`/reward/${badRewardId}`)

    await expect(
      page.locator('[data-screen-label="Customer flow"]')
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 1, name: "Card unavailable" })
    ).toBeVisible()
    await expect(
      page
        .getByText("Verify your identity from the venue QR to continue.")
        .first()
    ).toBeVisible()

    await expect(page.locator("body")).not.toContainText(badRewardId)

    await expectNoAxeViolations(page, "invalid reward id")
  })

  test("missing merchant slug shows the not-found page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/m/missing-merchant")

    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
    await expect(page.locator("body")).not.toContainText("missing-merchant")
  })

  test("missing venue QR shows the calm unavailable card", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/q/missing-qr")

    await expect(
      page.getByRole("heading", { level: 1, name: "Card unavailable" })
    ).toBeVisible()
    await expect(
      page.getByText("This loyalty card is unavailable").first()
    ).toBeVisible()
    await expect(page.locator("body")).not.toContainText("missing-qr")
  })
})
