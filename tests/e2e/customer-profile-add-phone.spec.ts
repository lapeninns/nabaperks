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
    // Only the confirmation: the invitation to add a phone is gone.
    await expect(
      section.getByRole("heading", { name: "Phone number added" })
    ).toBeVisible()
    await expect(
      section.getByRole("heading", { name: "Add a phone number" })
    ).toHaveCount(0)
    await expect(
      section.getByText("Your wallet opens with your email.", { exact: false })
    ).toHaveCount(0)
    await expect(section.getByLabel("Phone code")).toHaveCount(0)
  })

  test("a WhatsApp code that never arrives can be sent by text instead", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator("[data-add-phone]")
    await section
      .getByLabel("Phone number", { exact: true })
      .fill("07700900123")
    await section.getByRole("button", { name: "Send my code" }).click()
    const textInstead = section.getByRole("button", { name: "Text me instead" })
    await expect(textInstead).toBeVisible()
    await expect(
      section.getByRole("button", { name: "Resend code" })
    ).toBeVisible()

    await textInstead.click()
    // Sent by text now: nothing left to switch to, and the code step stays.
    await expect(textInstead).toHaveCount(0)
    await expect(section.getByText("Phone ending")).toContainText("0123")
    await expect(section.getByRole("status")).toContainText(
      "If a code arrives for that number, enter it here."
    )
    await expectNoAxeViolations(page, "add phone code step after a text")
    await section.getByLabel("Phone code").fill("424242")
    await section.getByRole("button", { name: "Add phone number" }).click()
    await expect(
      section.getByRole("heading", { name: "Phone number added" })
    ).toBeVisible()
  })

  test("a phone that cannot be recorded is not added and can be tried again", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator("[data-add-phone]")
    await section
      .getByLabel("Phone number", { exact: true })
      .fill("07700900998")
    await section.getByRole("button", { name: "Send my code" }).click()
    await section.getByLabel("Phone code").fill("424242")
    await section.getByRole("button", { name: "Add phone number" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "We couldn't add this phone number just now. Try again shortly."
    )
    await expect(
      section.getByRole("heading", { name: "Add a phone number" })
    ).toBeVisible()
    await expect(
      section.getByRole("button", { name: "Send my code" })
    ).toBeVisible()
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
