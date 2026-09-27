import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * The profile of a wallet started with an email, rendered by the DB-free
 * profile harness with the real sections and a display-only "add a phone
 * number" action (no code is sent and no wallet changes). The live attach
 * needs a database and is covered separately.
 */
const EMAIL_ONLY = "/dev/home-harness/profile?wallet=email-only"

test.describe("@customer-flow @a11y email-only wallet profile", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("offers to add a phone and hides phone-only settings", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const account = page.locator("[data-account-section]")
    await expect(
      account.getByText("Sign back in with your email.", { exact: false })
    ).toBeVisible()
    await expect(
      account.getByRole("heading", { name: "Add a phone number" })
    ).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Phone messages" })
    ).toHaveCount(0)
    // Marketing offers email only until a phone is added.
    await expect(page.getByText("Receive Email updates")).toBeAttached()
    await expect(page.getByText("Receive SMS updates")).toHaveCount(0)
    await expect(page.getByText("Receive WhatsApp updates")).toHaveCount(0)
    await expectNoAxeViolations(page, "email-only profile")

    // The phone profile keeps its existing layout: no add-phone form.
    await gotoHydratedPage(page, "/dev/home-harness/profile")
    await expect(page.locator("[data-add-phone]")).toHaveCount(0)
  })

  test("confirms the number with a code before adding it", async ({ page }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator("[data-add-phone]")
    const number = section.getByLabel("Phone number", { exact: true })

    await number.fill("123")
    await section.getByRole("button", { name: "Send my code" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "Enter a valid phone number."
    )

    await number.fill("07700900123")
    await section.getByRole("button", { name: "Send my code" }).click()
    await expect(section.getByText("Phone ending")).toContainText("0123")
    const code = section.getByLabel("Phone code")
    await code.fill("000000")
    await section.getByRole("button", { name: "Add phone number" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "That code was not accepted."
    )

    await section.getByLabel("Phone code").fill("424242")
    await section.getByRole("button", { name: "Add phone number" }).click()
    await expect(section.getByRole("status")).toContainText(
      "Your phone number is added. You can sign in with it too."
    )
  })

  test("a number another wallet holds is refused with a way to get help", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator("[data-add-phone]")
    await section
      .getByLabel("Phone number", { exact: true })
      .fill("07700900999")
    await section.getByRole("button", { name: "Send my code" }).click()
    await section.getByLabel("Phone code").fill("424242")
    await section.getByRole("button", { name: "Add phone number" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "already used by another Nabaperks wallet"
    )
    await expect(section.getByRole("alert")).toContainText(
      "ask the venue for help"
    )
    await expect(
      section.getByLabel("Phone number", { exact: true })
    ).toBeVisible()
  })
})
