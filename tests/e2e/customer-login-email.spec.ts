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
        page.getByRole("heading", { name: "Open my cards" })
      ).toBeVisible()
      await expect(
        page.getByLabel("UK mobile number", { exact: true })
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
    await page
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.getByLabel("Your code")).toBeVisible()
    const fallback = emailFallback(page)
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(20_000)
    await expect(fallback).toHaveCount(0)
    // A wrong code keeps the step, and the wait, where they were.
    await page.getByLabel("Your code").fill("000000")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code didn't work. Check it and try again."
    )
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(11_000)
    await expect(fallback).toBeVisible()
    // Beside the phone code's own recovery, below it, never instead of it.
    await expect(
      page.getByRole("button", { name: "Send a new code" })
    ).toBeVisible()
    const wrongNumber = page.getByRole("button", {
      name: "Wrong number? Change it",
    })
    await expect(wrongNumber).toBeVisible()
    expect((await fallback.boundingBox())!.y).toBeGreaterThan(
      (await wrongNumber.boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login phone code step with email")

    await fallback.click()
    await expect(
      page.getByRole("heading", {
        name: "Get your code by email",
        exact: true,
      })
    ).toBeVisible()
    const email = page.getByLabel("Email address")
    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute("type", "email")
    await expect(email).toHaveAttribute("autocomplete", "email")
    await expect(page.getByLabel("Your code")).toHaveCount(0)
    await expect(
      page.getByText(
        "Useful when there's no mobile signal. Works on the venue's Wi-Fi."
      )
    ).toBeVisible()
    const phoneInstead = page.getByRole("button", {
      name: "Back to the text code",
    })
    const send = page.getByRole("button", { name: "Send code by email" })
    expect((await send.boundingBox())!.y).toBeLessThan(
      (await phoneInstead.boundingBox())!.y
    )
    await expectNoAxeViolations(page, "login email step")

    await phoneInstead.click()
    await expect(
      page.getByLabel("UK mobile number", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("a resend restarts the 30 seconds from the new code, even once email was showing", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await page
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.getByLabel("Your code")).toBeVisible()
    const fallback = emailFallback(page)

    // Resent 20 seconds in: email waits 30 seconds from the new code.
    await page.clock.fastForward(20_000)
    await resendAndSettle(page)
    await page.clock.fastForward(11_000)
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(20_000)
    await expect(fallback).toBeVisible()

    // Resent while email shows: hidden again until the new code's wait ends.
    await resendAndSettle(page)
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(29_000)
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(2_000)
    await expect(fallback).toBeVisible()
  })

  test("a reload with a phone code pending opens its code step, with the server's wait left", async ({
    page,
  }) => {
    await installFallbackClock(page)
    const now = Math.floor(Date.now() / 1_000)
    // Sent 10 seconds ago: about 20 seconds left.
    await gotoHydratedPage(
      page,
      `/dev/customer-login?mode=full&sentAt=${now - 10}`
    )
    await expect(page.getByLabel("Your code")).toBeVisible()
    await expect(
      page.getByLabel("UK mobile number", { exact: true })
    ).toHaveCount(0)
    await expect(page.getByText(/to 07•••• ••123\./)).toBeVisible()
    const fallback = emailFallback(page)
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(15_000)
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(7_000)
    await expect(fallback).toBeVisible()

    // Sent over 30 seconds ago: email at once.
    await gotoHydratedPage(
      page,
      `/dev/customer-login?mode=full&sentAt=${now - 45}`
    )
    await expect(page.getByLabel("Your code")).toBeVisible()
    await expect(fallback).toBeVisible()

    // Email off: the code step, never email.
    await gotoHydratedPage(
      page,
      `/dev/customer-login?mode=off&sentAt=${now - 45}`
    )
    await expect(page.getByLabel("Your code")).toBeVisible()
    await expect(fallback).toHaveCount(0)
  })

  test("a phone code that could not be sent at all offers email beside the error, only while email is on", async ({
    page,
  }) => {
    for (const mode of ["off", "full"]) {
      await gotoHydratedPage(
        page,
        `/dev/customer-login?mode=${mode}&scenario=send-error`
      )
      await page
        .getByLabel("UK mobile number", { exact: true })
        .fill("07700900123")
      await page.getByRole("button", { name: "Send my code" }).click()
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "couldn't send a code"
      )
      const useEmail = page.getByRole("button", {
        name: "Get a code by email instead",
      })
      if (mode === "off") {
        await expect(page.getByRole("button", { name: /email/i })).toHaveCount(
          0
        )
        continue
      }
      await expect(useEmail).toBeVisible()
      await expectNoAxeViolations(page, "login phone send failure with email")
      await useEmail.click()
      await expect(page.getByLabel("Email address")).toBeVisible()
    }
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
    await page.getByRole("button", { name: "Send code by email" }).click()

    await expect(
      page.getByRole("heading", { name: "Enter your code" })
    ).toBeVisible()
    await expect(page.getByText("g***@example.com")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Send a new code in \d+:\d{2}$/ })
    ).toBeDisabled()
    await expect(
      page.getByRole("button", { name: "Back to the text code" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "login email code step")

    await page.getByLabel("Your code").fill("000000")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code didn't work. Check it and try again."
    )

    await page.getByLabel("Your code").fill("424242")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(
      page.getByText("You can use your mobile number instead.")
    ).toBeVisible()
    // The scan step #387 gives a phone with no cards, not another code.
    await expect(
      page.getByRole("heading", { name: "No card uses this email" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toHaveAttribute("href", "/scan")
    await expect(
      page.getByRole("button", { name: "Send code by email", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Use my mobile number" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "login email scan step")
    expect(await page.context().cookies()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nabaperks_customer_session" }),
      ])
    )

    await page.getByRole("button", { name: "Change email" }).click()
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
    await page
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await page.getByRole("button", { name: "Send my code" }).click()
    await page.getByLabel("Your code").fill("424242")
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(
      page.getByRole("heading", {
        name: "We couldn't find any cards for this number.",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Scan a venue QR" })
    ).toHaveAttribute("href", "/scan")
    await expect(
      page.getByRole("button", { name: "Send my code", exact: true })
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Get a code by email instead" })
      .click()
    await expect(page.getByLabel("Email address")).toBeVisible()
  })

  test("a different email refills the field, and a delayed provider keeps the customer on the email step", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await openLoginEmailStep(page)
    await page.getByLabel("Email address").fill("guest@example.com")
    await page.getByRole("button", { name: "Send code by email" }).click()
    await page.getByRole("button", { name: "Change email" }).click()
    const email = page.getByLabel("Email address")
    await expect(email).toBeFocused()
    await expect(email).toHaveValue("guest@example.com")
    await expect(page.getByLabel("Your code")).toHaveCount(0)

    await gotoHydratedPage(
      page,
      "/dev/customer-login?mode=full&scenario=email-send-error"
    )
    await openLoginEmailStep(page)
    await page.getByLabel("Email address").fill("guest@example.com")
    await page.getByRole("button", { name: "Send code by email" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Email is slow right now. Try again shortly, or go back to the text code."
    )
    await expect(
      page.getByRole("button", { name: "Back to the text code" })
    ).toBeVisible()
  })

  test("with email sign-in off the login screen has no email option", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login")
    await expect(
      page.getByLabel("UK mobile number", { exact: true })
    ).toBeVisible()
    await expect(page.getByLabel("Email address")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)

    // Nor on the phone code step, however long the code takes.
    await page
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.getByLabel("Your code")).toBeVisible()
    await page.clock.fastForward(120_000)
    await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
  })
})

/** Phone first, a code sent, then the 30-second fallback to the email step. */
async function openLoginEmailStep(page: Page): Promise<void> {
  await page.getByLabel("UK mobile number", { exact: true }).fill("07700900123")
  await page.getByRole("button", { name: "Send my code" }).click()
  await expect(page.getByLabel("Your code")).toBeVisible()
  await takeEmailFallback(page)
  await expect(
    page.getByRole("heading", {
      name: "Get your code by email",
      exact: true,
    })
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

/** Resend the phone code and wait until its answer is on the page. */
async function resendAndSettle(page: Page): Promise<void> {
  const resend = page.getByRole("button", { name: "Send a new code" })
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    resend.click(),
  ])
  await expect(resend).toBeEnabled()
}
