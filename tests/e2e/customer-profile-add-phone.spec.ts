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
  test("home suggests one mobile number step to guests who joined by email", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/home-harness/home?wallet=email-only&dob=set"
    )
    const suggestion = page.getByTestId("home-setup-suggestion")
    await expect(suggestion).toHaveCount(1)
    await expect(
      suggestion.getByRole("heading", { name: "Add your mobile number" })
    ).toBeVisible()
    await expect(suggestion).toContainText("You'll need it to collect rewards.")
    await expect(
      suggestion.getByRole("link", { name: "Add my number" })
    ).toHaveAttribute("href", "/home/profile#add-phone")
    await expectNoAxeViolations(page, "mobile number suggestion")

    // Set aside, the next suggestion takes its place: never two at once.
    await suggestion.getByRole("button", { name: "Not now" }).click()
    await expect(page.getByTestId("home-setup-suggestion")).toHaveCount(1)
    await expect(
      page.getByRole("heading", { name: "Find my previous stamps" })
    ).toBeVisible()

    // An empty home offers only the scan action.
    await gotoHydratedPage(
      page,
      "/dev/home-harness/home?wallet=email-only-empty"
    )
    await expect(page.getByTestId("home-setup-suggestion")).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toBeVisible()
  })

  test("finds previous stamps as its own task and confirms them together afterwards", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    // Contact asks for a number without explaining linking rules.
    await expect(page.locator('[data-add-phone="contact"]')).not.toContainText(
      /wallet|link/i
    )
    const task = page.locator("#previous-stamps")
    await expect(task).toContainText(
      "Confirm the other number and we'll bring its stamps here."
    )
    await task.getByText("Find my previous stamps").click()
    const section = page.locator('[data-add-phone="previous"]')
    await section
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900997")
    await section.getByRole("button", { name: "Send my code" }).click()
    await section.getByLabel("Your code").fill("424242")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(
      section.getByRole("heading", { name: "Your stamps are together now." })
    ).toBeVisible()
    await expect(section.getByRole("status")).toContainText(
      "Sign in with your mobile number."
    )
    await expect(section.getByRole("status")).not.toContainText(/email/i)
    await expect(
      section.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home")
    await expectNoAxeViolations(page, "linked wallet confirmation")
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: ".omo/evidence/wallet-link-ux-success.png",
      fullPage: true,
    })
  })

  test("provides recovery actions when linking needs a fresh sign-in or review", async ({
    page,
  }) => {
    for (const [phone, label] of [
      ["07700900996", "Sign in again"],
      ["07700900995", "Open my cards"],
    ]) {
      await gotoHydratedPage(page, EMAIL_ONLY)
      const section = page.locator('[data-add-phone="contact"]')
      await section.getByLabel("UK mobile number", { exact: true }).fill(phone)
      await section.getByRole("button", { name: "Send my code" }).click()
      await section.getByLabel("Your code").fill("424242")
      await section.getByRole("button", { name: "Continue" }).click()
      await expect(
        section.getByRole(phone.endsWith("996") ? "button" : "link", {
          name: label,
        })
      ).toBeVisible()
      await expectNoAxeViolations(page, `link recovery ${phone.slice(-3)}`)
      if (phone.endsWith("996")) {
        await section.getByRole("button", { name: "Sign in again" }).click()
        await expect(page).toHaveURL(/\/home\/login\?next=%2Fhome%2Fprofile/)
      }
    }
  })
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("offers to add a phone and hides phone-only settings", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const account = page.locator("[data-account-section]")
    // Phone is the only way in: no email sign-in route, no rollout warning.
    await expect(account).not.toContainText(/Sign back in with|paused/)
    await expect(
      page.getByText(
        "Add your mobile number so you can sign in on another phone."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Add your mobile number" })
    ).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Reminders by phone" })
    ).toHaveCount(0)
    // Marketing offers email only until a phone is added.
    await expect(page.getByText("Offers by Email")).toBeAttached()
    await expect(page.getByText("Offers by Text")).toHaveCount(0)
    await expect(page.getByText("Offers by WhatsApp")).toHaveCount(0)
    await expectNoAxeViolations(page, "email-only profile")

    // The phone profile keeps its existing layout: no add-phone form.
    await gotoHydratedPage(page, "/dev/home-harness/profile")
    await expect(page.locator('[data-add-phone="contact"]')).toHaveCount(0)
  })

  test("confirms the number with a code before adding it", async ({ page }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator('[data-add-phone="contact"]')
    const number = section.getByLabel("UK mobile number", { exact: true })

    await number.fill("123")
    await section.getByRole("button", { name: "Send my code" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "Enter a UK mobile number, like 07700 900123."
    )

    await number.fill("07700900123")
    await section.getByRole("button", { name: "Send my code" }).click()
    await expect(section.getByText("Sent to the number ending")).toContainText(
      "0123"
    )
    const code = section.getByLabel("Your code")
    await code.fill("000000")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "That code didn't work. Check it and try again."
    )

    await section.getByLabel("Your code").fill("424242")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(section.getByRole("status")).toContainText(
      "Your mobile number is confirmed. You can use it to sign in."
    )
    // Only the confirmation: the invitation to add a phone is gone.
    await expect(
      section.getByRole("heading", { name: "Mobile number confirmed" })
    ).toBeVisible()
    await expect(
      section.getByRole("heading", { name: "Add your mobile number" })
    ).toHaveCount(0)
    await expect(
      section.getByText("Your wallet opens with your email.", { exact: false })
    ).toHaveCount(0)
    await expect(section.getByLabel("Your code")).toHaveCount(0)
  })

  test("a WhatsApp code that never arrives can be sent by text instead", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator('[data-add-phone="contact"]')
    await section
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await section.getByRole("button", { name: "Send my code" }).click()
    const textInstead = section.getByRole("button", { name: "Text me instead" })
    await expect(textInstead).toBeVisible()
    await expect(
      section.getByRole("button", { name: "Send a new code" })
    ).toBeVisible()

    await textInstead.click()
    // Sent by text now: nothing left to switch to, and the code step stays.
    await expect(textInstead).toHaveCount(0)
    await expect(section.getByText("Sent to the number ending")).toContainText(
      "0123"
    )
    await expect(section.getByRole("status")).toContainText(
      "If a code arrives for that number, enter it here."
    )
    await expectNoAxeViolations(page, "add phone code step after a text")
    await section.getByLabel("Your code").fill("424242")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(
      section.getByRole("heading", { name: "Mobile number confirmed" })
    ).toBeVisible()
  })

  test("a phone that cannot be recorded is not added and can be tried again", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator('[data-add-phone="contact"]')
    await section
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900998")
    await section.getByRole("button", { name: "Send my code" }).click()
    await section.getByLabel("Your code").fill("424242")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "We couldn't save your number just now. Send a new code and try again."
    )
    await expect(
      section.getByRole("heading", { name: "Add your mobile number" })
    ).toBeVisible()
    await expect(
      section.getByRole("button", { name: "Send my code" })
    ).toBeVisible()
  })

  test("a number another wallet holds is refused with a way to get help", async ({
    page,
  }) => {
    await gotoHydratedPage(page, EMAIL_ONLY)
    const section = page.locator('[data-add-phone="contact"]')
    await section
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900999")
    await section.getByRole("button", { name: "Send my code" }).click()
    await section.getByLabel("Your code").fill("424242")
    await section.getByRole("button", { name: "Continue" }).click()
    await expect(section.getByRole("alert")).toContainText(
      "used by another card"
    )
    await expect(section.getByRole("alert")).toContainText("ask staff for help")
    await expect(
      section.getByLabel("UK mobile number", { exact: true })
    ).toBeVisible()
  })
})
