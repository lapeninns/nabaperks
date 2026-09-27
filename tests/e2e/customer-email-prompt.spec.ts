import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * Email sign-in Step 0 — the add-your-email prompt on the customer dashboard,
 * DB-free. The harness drives the prompt states; the real server actions are
 * not submitted here (they need a signed-in customer and a database). The
 * confirmation, the conflict and the UI after the action re-renders are
 * covered against local Supabase in customer-email-prompt-live-db.spec.ts.
 */
const HOME = "/dev/home-harness/home"
const EMAIL_HEADING = "Add your email"
const BIRTHDAY_HEADING = "Add your birthday for a treat on us"

test.describe("@customer-flow customer email prompt", () => {
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
      prompt.getByText(
        "A confirmed email is needed before you collect a reward.",
        {
          exact: false,
        }
      )
    ).toBeVisible()
    await expect(page.getByText(BIRTHDAY_HEADING)).toHaveCount(0)
  })

  test("email sign-in modes explain the Wi-Fi sign-in instead", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HOME}?email=missing&mode=existing`)

    await expect(
      page.getByText(
        "Add your email so you can sign in over Wi-Fi when there's no signal."
      )
    ).toBeVisible()
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
      prompt.getByRole("button", { name: "Email me a new code" })
    ).toBeVisible()

    await prompt.getByRole("button", { name: "Use a different email" }).click()
    await expect(prompt.getByLabel("Email", { exact: true })).toHaveValue(
      "alex@example.test"
    )
  })

  test("a verified email shows no email prompt", async ({ page }) => {
    await gotoHydratedPage(page, `${HOME}?email=verified`)

    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    await expect(page.getByText(BIRTHDAY_HEADING)).toBeVisible()
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
    await expect(page.getByText(BIRTHDAY_HEADING)).toBeVisible()

    await page.reload()
    await expect(page.getByText(BIRTHDAY_HEADING)).toBeVisible()
    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
  })

  test("after a stamp the compact email card sits below the stamp card", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/home-harness/referral-bank?email=missing"
    )
    const prompt = page.getByTestId("email-prompt")

    await expect(
      prompt.getByRole("heading", { name: EMAIL_HEADING })
    ).toBeVisible()
    await expect(prompt.getByRole("button", { name: "Not now" })).toBeVisible()
  })

  test("after a stamp a pending email opens the compact card at the code step", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/home-harness/referral-bank?email=pending"
    )
    const prompt = page.getByTestId("email-prompt")

    await expect(
      prompt.getByText("Enter the code we sent to alex@example.test.")
    ).toBeVisible()
    await expect(prompt.getByLabel("Email code")).toBeVisible()
    await expect(prompt.getByLabel("Email", { exact: true })).toHaveCount(0)

    await prompt.getByRole("button", { name: "Use a different email" }).click()
    await expect(prompt.getByLabel("Email", { exact: true })).toHaveValue(
      "alex@example.test"
    )
  })

  test("a card visit without a fresh stamp shows no email card", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/home-harness/referral-bank")

    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
  })
})
