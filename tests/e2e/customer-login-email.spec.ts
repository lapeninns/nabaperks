import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * /home/login with email sign-in, rendered by the DB-free customer-login
 * harness with the real form and display-only actions (no code is sent and no
 * session is minted). `?mode=` stands in for CUSTOMER_EMAIL_AUTH_MODE. The live
 * journey needs a database and is covered separately.
 */
const LAST_METHOD_KEY = "nabaperks.last-contact-method"
const HYDRATION_ERROR =
  /hydration failed|server rendered (text|html) didn't match|hydrated.*didn't match|hydration mismatch/i

test.describe("@customer-flow @a11y wallet sign-in by email", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("mode full leads with email on a fresh device and keeps phone one visible tap away", async ({
    page,
  }) => {
    const errors = collectHydrationErrors(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")

    const email = page.getByLabel("Email address")
    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute("type", "email")
    await expect(email).toHaveAttribute("autocomplete", "email")
    await expect(page.getByLabel("Phone number", { exact: true })).toHaveCount(
      0
    )
    await expect(
      page.getByText(
        "Works over the venue's Wi-Fi, even with no mobile signal."
      )
    ).toBeVisible()
    const phoneInstead = page.getByRole("button", {
      name: "Use my phone number instead",
    })
    await expect(phoneInstead).toBeVisible()
    // Directly under the send button, never hidden.
    const send = page.getByRole("button", { name: "Send my code" })
    expect((await send.boundingBox())!.y).toBeLessThan(
      (await phoneInstead.boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login email step")

    await phoneInstead.click()
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Use my email instead" })
    ).toBeVisible()
    expect(errors).toEqual([])
  })

  test("a device that last verified by phone leads with phone, and mode existing leads with phone", async ({
    page,
  }) => {
    const errors = collectHydrationErrors(page)
    await page.addInitScript(
      ([key]) => window.localStorage.setItem(key, "phone"),
      [LAST_METHOD_KEY]
    )
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Email address")).toHaveCount(0)

    await page.evaluate(
      (key) => window.localStorage.removeItem(key),
      LAST_METHOD_KEY
    )
    await gotoHydratedPage(page, "/dev/customer-login?mode=existing")
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Use my email instead" })
    ).toBeVisible()
    expect(errors).toEqual([])
  })

  test("the email code step shows the masked address, rejects a wrong code and says no wallet only after a valid one", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/customer-login?mode=full&scenario=email-unknown"
    )
    await page.getByLabel("Email address").fill("Guest@Example.com")
    await page.getByRole("button", { name: "Send my code" }).click()

    await expect(
      page.getByRole("heading", { name: "Enter your code" })
    ).toBeVisible()
    await expect(page.getByText("g***@example.com")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Resend code in \d+s$/ })
    ).toBeDisabled()
    await expect(
      page.getByRole("button", { name: "Use my phone instead" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "login email code step")

    await page.getByLabel("Email code").fill("000000")
    await page.getByRole("button", { name: "Open my cards" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code was not accepted."
    )

    await page.getByLabel("Email code").fill("424242")
    await page.getByRole("button", { name: "Open my cards" }).click()
    await expect(
      page.getByText(
        "No wallet uses this email yet. Scan a venue QR to join, or sign in with your phone."
      )
    ).toBeVisible()
    await expect(page.getByLabel("Email address")).toHaveValue(
      "guest@example.com"
    )
    // Nothing signed in, so the device does not start leading with email.
    expect(
      await page.evaluate((key) => localStorage.getItem(key), LAST_METHOD_KEY)
    ).toBeNull()
    expect(await page.context().cookies()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nabaperks_customer_session" }),
      ])
    )
  })

  test("a different email refills the field, and a delayed provider keeps the customer on the email step", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await page.getByLabel("Email address").fill("guest@example.com")
    await page.getByRole("button", { name: "Send my code" }).click()
    await page
      .getByRole("button", { name: "Wrong email? Use a different one" })
      .click()
    const email = page.getByLabel("Email address")
    await expect(email).toBeFocused()
    await expect(email).toHaveValue("guest@example.com")
    await expect(page.getByLabel("Email code")).toHaveCount(0)

    await gotoHydratedPage(
      page,
      "/dev/customer-login?mode=full&scenario=email-send-error"
    )
    await page.getByLabel("Email address").fill("guest@example.com")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Email codes are delayed. Try again shortly or use your phone."
    )
    await expect(
      page.getByRole("button", { name: "Use my phone number instead" })
    ).toBeVisible()
  })

  test("a phone code that never arrives is one tap from email on the code step", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/customer-login?mode=existing")
    await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
    await page.getByRole("button", { name: "Send code" }).click()
    await expect(page.getByLabel("Phone code")).toBeVisible()

    const emailInstead = page.getByRole("button", {
      name: "Use my email instead",
    })
    await expect(emailInstead).toBeVisible()
    // Beside the phone code's own recovery links, below the code button.
    expect((await emailInstead.boundingBox())!.y).toBeGreaterThan(
      (await page
        .getByRole("button", { name: "Wrong number? Use a different one" })
        .boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login phone code step with email")

    await emailInstead.click()
    await expect(page.getByLabel("Email address")).toBeVisible()
    await expect(page.getByLabel("Phone code")).toHaveCount(0)
  })

  test("with email sign-in off the login screen has no email option", async ({
    page,
  }) => {
    await page.addInitScript(
      ([key]) => window.localStorage.setItem(key, "email"),
      [LAST_METHOD_KEY]
    )
    await gotoHydratedPage(page, "/dev/customer-login")
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Email address")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)

    // Nor on the phone code step.
    await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
    await page.getByRole("button", { name: "Send code" }).click()
    await expect(page.getByLabel("Phone code")).toBeVisible()
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
  })
})

/** Page errors, and console errors that report a hydration mismatch. */
function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_ERROR.test(message.text())) {
      errors.push(message.text())
    }
  })
  return errors
}
