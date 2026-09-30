import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * DB-free harness lanes for QA BUG-036 (38c42a1..2c45031): the email step with
 * no code pending, on the profile's About-you card and on the reward
 * collection gate. The live behaviour (the pending-code cookie deciding the
 * step) is proven in customer-email-confirmation-states-live-db.spec.ts and
 * reward-gate-email-code-pending-bug-036-live-db.spec.ts; these lanes pin the
 * screens so they can be reviewed and captured without a database.
 */
test.describe("QA BUG-036 harness lanes", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("profile: with no code pending the About-you card offers to send one", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/home-harness/profile?email=no-code")

    await expect(page.getByText("Confirm your email")).toBeVisible()
    await expect(
      page.getByText("alex@example.test is not confirmed yet.", {
        exact: false,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send me a code", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Continue without email", exact: true })
    ).toBeVisible()
    await expect(page.getByText(/code we sent/i)).toHaveCount(0)
    await expect(page.getByLabel("Email code")).toHaveCount(0)
  })

  test("profile: the default lane still asks for the pending code", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/home-harness/profile")

    await expect(
      page.getByText("Enter the code we sent to alex@example.test", {
        exact: false,
      })
    ).toBeVisible()
    await expect(page.getByLabel("Email code")).toBeVisible()
  })

  test("reward gate: with no code pending the email step offers to send one", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/home-harness/redemption-second-factor?gate=email-send"
    )

    await expect(
      page.getByText("alex@example.test is not confirmed yet.", {
        exact: false,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send me a code", exact: true })
    ).toBeVisible()
    await expect(page.getByText(/code we sent/i)).toHaveCount(0)
    await expect(page.getByLabel("Email code")).toHaveCount(0)
  })
})
