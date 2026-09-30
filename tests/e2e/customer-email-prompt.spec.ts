import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"
import { expectNoAxeViolations } from "./helpers/axe"

/**
 * Email sign-in Step 0 — the add-your-email prompt on the customer dashboard,
 * DB-free. The harness drives the prompt states; the real server actions are
 * not submitted here (they need a signed-in customer and a database). The
 * confirmation, the conflict and the UI after the action re-renders are
 * covered against local Supabase in customer-email-prompt-live-db.spec.ts.
 */
const HOME = "/dev/home-harness/home"
const EMAIL_HEADING = "Add your email"
const BIRTHDAY_HEADING = "Add your birthday"

test.describe("@customer-flow customer email prompt", () => {
  test("confirming an email that holds earlier stamps brings them together", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=pending&wallet=link-email`)
    const prompt = page.getByTestId("email-prompt")
    // Linking rules are not explained inside the contact form.
    await expect(prompt).not.toContainText(/wallet/i)
    await prompt.getByLabel("Email code").fill("000000")
    await prompt.getByRole("button", { name: "Confirm email" }).click()
    await expect(prompt).toContainText("That code was not accepted.")
    await expect(
      prompt.getByRole("link", { name: "Open my cards" })
    ).toHaveCount(0)
    await prompt.getByLabel("Email code").fill("424242")
    await prompt.getByRole("button", { name: "Confirm email" }).click()
    await expect(
      prompt.getByRole("heading", { name: "Your stamps are together now" })
    ).toBeVisible()
    await expect(prompt.getByRole("status")).toContainText(
      "Your stamps are together now."
    )
    await expect(
      prompt.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home")
    await expectNoAxeViolations(page, "email wallet linked")
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: ".omo/evidence/wallet-link-ux-email-success.png",
      fullPage: true,
    })
  })
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("missing email opens at the email step and outranks the birthday prompt", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=missing`)
    const prompt = page.getByTestId("email-prompt")

    await expect(
      prompt.getByRole("heading", { name: EMAIL_HEADING })
    ).toBeVisible()
    await expect(prompt.getByLabel("Email", { exact: true })).toHaveAttribute(
      "autocomplete",
      "email"
    )
    await expect(
      prompt.getByRole("button", { name: "Send my code" })
    ).toBeVisible()
    await expect(
      prompt.getByText("You'll need a confirmed email to collect rewards.", {
        exact: false,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: BIRTHDAY_HEADING })
    ).toHaveCount(0)
  })

  test("email fallback modes add why it helps, never an email sign-in", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=missing&mode=existing`)

    await expect(
      page.getByText(
        "You'll need a confirmed email to collect rewards. It also helps if a code can't reach your phone."
      )
    ).toBeVisible()
    await expect(page.getByTestId("email-prompt")).not.toContainText(
      /sign in|wallet/i
    )
  })

  test("a pending email opens at the code step and can go back to change it", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=pending`)
    const prompt = page.getByTestId("email-prompt")

    await expect(
      prompt.getByText("Enter the code we sent to alex@example.test.")
    ).toBeVisible()
    await expect(prompt.getByLabel("Email code")).toHaveAttribute(
      "autocomplete",
      "one-time-code"
    )
    await expect(
      prompt.getByRole("button", { name: "Send a new code" })
    ).toBeVisible()

    await prompt.getByRole("button", { name: "Use a different email" }).click()
    await expect(prompt.getByLabel("Email", { exact: true })).toHaveValue(
      "alex@example.test"
    )
  })

  test("a verified email shows no email prompt", async ({ page }) => {
    await gotoHydratedPage(page, `${HOME}?email=verified`)

    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: BIRTHDAY_HEADING })
    ).toBeVisible()
  })

  test("Not now hides the email prompt and lets the birthday prompt through", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=missing`)
    await page
      .getByTestId("email-prompt")
      .getByRole("button", { name: "Not now" })
      .click()

    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: BIRTHDAY_HEADING })
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole("heading", { name: BIRTHDAY_HEADING })
    ).toBeVisible()
    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    // Only ever one suggestion on screen.
    await expect(page.getByTestId("home-setup-suggestion")).toHaveCount(1)
  })

  test("after a stamp the card asks for nothing: the stamp result stands alone", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/home-harness/referral-bank?stamped=1")

    await expect(page.getByText("Stamp added.")).toBeVisible()
    await expect(
      page.getByText("Next stamp from Fri 17 Jul, 06:00.")
    ).toBeVisible()
    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
  })

  test("a card visit without a fresh stamp shows no email card", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/home-harness/referral-bank")

    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
  })
})
