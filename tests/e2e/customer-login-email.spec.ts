import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import {
  emailFallback,
  installFallbackClock,
  takeEmailFallback,
} from "./helpers/email-fallback"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * /home/login with email sign-in, rendered by the DB-free customer-login
 * harness with the real form and display-only actions (no code is sent and no
 * session is minted). `?mode=` stands in for CUSTOMER_EMAIL_AUTH_MODE. The live
 * journey needs a database and is covered separately. Phone always leads;
 * the phone code step offers email 30 seconds after the code was sent.
 */
const HYDRATION_ERROR =
  /hydration failed|server rendered (text|html) didn't match|hydrated.*didn't match|hydration mismatch/i

test.describe("@customer-flow @a11y wallet sign-in by email", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("phone leads in every mode with no email option beside the number", async ({
    page,
  }) => {
    const errors = collectHydrationErrors(page)
    for (const mode of ["full", "existing", "off"]) {
      await gotoHydratedPage(page, `/dev/customer-login?mode=${mode}`)
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible()
      await expect(
        page.getByLabel("Phone number", { exact: true })
      ).toBeVisible()
      await expect(page.getByLabel("Email address")).toHaveCount(0)
      await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
    }
    await expectNoAxeViolations(page, "login phone step")
    expect(errors).toEqual([])
  })

  test("the phone code step offers email only once 30 seconds have passed since the send, and it opens the email step", async ({
    page,
  }) => {
    const errors = collectHydrationErrors(page)
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
    await page.getByRole("button", { name: "Send code" }).click()
    await expect(page.getByLabel("Phone code")).toBeVisible()
    const fallback = emailFallback(page)
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(20_000)
    await expect(fallback).toHaveCount(0)
    // A wrong code keeps the step, and the wait, where they were.
    await page.getByLabel("Phone code").fill("000000")
    await page.getByRole("button", { name: "Open my cards" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code was not accepted."
    )
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(11_000)
    await expect(fallback).toBeVisible()
    // Beside the phone code's own recovery, below it, never instead of it.
    await expect(
      page.getByRole("button", { name: "Resend code" })
    ).toBeVisible()
    const wrongNumber = page.getByRole("button", {
      name: "Wrong number? Use a different one",
    })
    await expect(wrongNumber).toBeVisible()
    expect((await fallback.boundingBox())!.y).toBeGreaterThan(
      (await wrongNumber.boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login phone code step with email")

    await fallback.click()
    await expect(
      page.getByRole("heading", { name: "Get your code by email instead" })
    ).toBeVisible()
    const email = page.getByLabel("Email address")
    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute("type", "email")
    await expect(email).toHaveAttribute("autocomplete", "email")
    await expect(page.getByLabel("Phone code")).toHaveCount(0)
    await expect(
      page.getByText(
        "Works over the venue's Wi-Fi, even with no mobile signal."
      )
    ).toBeVisible()
    const phoneInstead = page.getByRole("button", {
      name: "Use my phone number instead",
    })
    const send = page.getByRole("button", { name: "Send my code" })
    expect((await send.boundingBox())!.y).toBeLessThan(
      (await phoneInstead.boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login email step")

    await phoneInstead.click()
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("the email code step shows the masked address, rejects a wrong code and says no wallet only after a valid one", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(
      page,
      "/dev/customer-login?mode=full&scenario=email-unknown"
    )
    await openLoginEmailStep(page)
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
    // The scan step #387 gives a phone with no cards, not another code.
    await expect(
      page.getByRole("heading", { name: "No cards on this email" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toHaveAttribute("href", "/scan")
    await expect(
      page.getByRole("button", { name: "Send my code", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Use my phone instead" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "login email scan step")
    expect(await page.context().cookies()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nabaperks_customer_session" }),
      ])
    )

    await page.getByRole("button", { name: "Use a different email" }).click()
    await expect(page.getByLabel("Email address")).toHaveValue(
      "guest@example.com"
    )
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toHaveCount(0)
  })

  test("a phone with no cards gets the scan step, one tap from email", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/customer-login?mode=existing&scenario=unknown"
    )
    await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
    await page.getByRole("button", { name: "Send code" }).click()
    await page.getByLabel("Phone code").fill("424242")
    await page.getByRole("button", { name: "Open my cards" }).click()

    await expect(
      page.getByRole("heading", { name: "No cards on this number" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toHaveAttribute("href", "/scan")
    await expect(
      page.getByRole("button", { name: "Send code", exact: true })
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Use my email instead" }).click()
    await expect(page.getByLabel("Email address")).toBeVisible()
  })

  test("a different email refills the field, and a delayed provider keeps the customer on the email step", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await openLoginEmailStep(page)
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
    await openLoginEmailStep(page)
    await page.getByLabel("Email address").fill("guest@example.com")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Email codes are delayed. Try again shortly or use your phone."
    )
    await expect(
      page.getByRole("button", { name: "Use my phone number instead" })
    ).toBeVisible()
  })

  test("with email sign-in off the login screen has no email option", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login")
    await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Email address")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)

    // Nor on the phone code step, however long the code takes.
    await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
    await page.getByRole("button", { name: "Send code" }).click()
    await expect(page.getByLabel("Phone code")).toBeVisible()
    await page.clock.fastForward(120_000)
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
  })
})

/** Phone first, a code sent, then the 30-second fallback to the email step. */
async function openLoginEmailStep(page: Page): Promise<void> {
  await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
  await page.getByRole("button", { name: "Send code" }).click()
  await expect(page.getByLabel("Phone code")).toBeVisible()
  await takeEmailFallback(page)
  await expect(
    page.getByRole("heading", { name: "Get your code by email instead" })
  ).toBeVisible()
}

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
