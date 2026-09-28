import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { emailFallback, installFallbackClock } from "./helpers/email-fallback"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * The email join screens, rendered by the DB-free welcome-offer harness with
 * the real join components. Submitting needs a database, so these checks stop
 * at what each screen offers; the live journeys cover the actions. Email is
 * never a first option: phone leads in every mode, and the phone code step
 * offers email 30 seconds after the code was sent.
 */
test.describe("@customer-flow @a11y join by email screens", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the email step, reached as the fallback, says so and keeps phone one visible tap away", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/welcome-offer?surface=email&offer=none")
    const shell = page.locator('[data-screen-label="Customer join"]')
    await expect(shell.getByText("Verify · Email")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Get your code by email instead" })
    ).toBeVisible()
    const email = page.getByLabel("Email address")
    await expect(email).toHaveAttribute("type", "email")
    await expect(email).toHaveAttribute("autocomplete", "email")
    await expect(
      page.getByText(
        "Works over the venue's Wi-Fi, even with no mobile signal."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send my code" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Use my phone number instead" })
    ).toHaveAttribute("href", /step=phone/)
    await expectNoAxeViolations(page, "join email step")
  })

  test("an offer in progress on the email step says it needs a phone number", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=email&offer=attached"
    )
    await expect(
      page.getByText("This offer needs a phone number")
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Save your card with your email" })
    ).toBeVisible()
  })

  test("the email code step shows the masked address, resend and both ways out", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=email-code&offer=none"
    )
    await expect(page.getByText("j***@example.com")).toBeVisible()
    await expect(page.getByLabel("Your code")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Resend code" })
    ).toBeEnabled()
    await expect(
      page.getByRole("link", { name: "Use a different email" })
    ).toHaveAttribute("href", /step=email/)
    await expect(
      page.getByRole("link", { name: "Use my phone instead" })
    ).toHaveAttribute("href", /step=phone/)
    await expectNoAxeViolations(page, "join email code step")
  })

  test("the email code step after a failed send says the code is delayed, not sent", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=email-code-delayed&offer=none"
    )
    await expect(page.getByText("Not sent yet to")).toBeVisible()
    await expect(page.getByText("Sent to", { exact: true })).toHaveCount(0)
    await expect(
      page.getByText(
        "Email codes are delayed. Try again shortly or use your phone."
      )
    ).toBeVisible()
    await expect(
      page.getByText("It's in the email we just sent you.")
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Resend code" })
    ).toBeEnabled()
    await expect(
      page.getByRole("link", { name: "Use my phone instead" })
    ).toHaveAttribute("href", /step=phone/)
    await expectNoAxeViolations(page, "join email code step, send delayed")
  })

  test("the choice screen offers both answers equally, and only mode full can start a wallet", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=email-choice&offer=none"
    )
    await expect(
      page.getByRole("heading", {
        name: "Have you collected stamps with Nabaperks before?",
      })
    ).toBeVisible()
    const create = page.getByRole("button", {
      name: "No, I’m new here: start my wallet",
    })
    const phone = page.getByRole("button", {
      name: "Yes, with my phone number: use my phone",
    })
    await expect(create).toBeVisible()
    await expect(phone).toBeVisible()
    // Same classes: neither answer is styled as the expected one.
    await expect(create).toHaveClass((await phone.getAttribute("class")) ?? "")
    await expectNoAxeViolations(page, "join email choice")

    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=email-choice-existing&offer=none"
    )
    await expect(
      page.getByRole("heading", { name: "No wallet uses this email yet" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /start my wallet/ })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Use my phone instead" })
    ).toBeVisible()
  })

  test("phone leads in every mode, from the welcome CTA to the contact step, with no hydration errors", async ({
    page,
  }) => {
    const hydrationErrors = collectHydrationErrors(page)

    for (const surface of ["welcome", "welcome-email"]) {
      await gotoHydratedPage(
        page,
        `/dev/welcome-offer?surface=${surface}&offer=none`
      )
      await expect(
        page.getByRole("link", { name: "Claim my first stamp" })
      ).toHaveAttribute("href", /step=phone/)
      await expect(page.getByText(/your email/i)).toHaveCount(0)
    }

    for (const surface of ["contact", "contact-existing", "phone"]) {
      await gotoHydratedPage(
        page,
        `/dev/welcome-offer?surface=${surface}&offer=none`
      )
      await expect(page.getByLabel("UK phone number")).toBeVisible()
      await expect(page.getByText("Verify · Phone")).toBeVisible()
      await expect(page.getByLabel("Email address")).toHaveCount(0)
      await expect(page.getByRole("link", { name: /email/i })).toHaveCount(0)
      await expect(page.getByRole("button", { name: /email/i })).toHaveCount(0)
    }

    expect(hydrationErrors).toEqual([])
  })

  test("the phone code step offers email only once 30 seconds have passed since the send", async ({
    page,
  }) => {
    const hydrationErrors = collectHydrationErrors(page)
    await installFallbackClock(page)
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=code-email&offer=none&ref=FRIEND1"
    )
    await expect(page.getByLabel("Your code")).toBeVisible()
    const fallback = emailFallback(page)
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(20_000)
    await expect(fallback).toHaveCount(0)

    await page.clock.fastForward(11_000)
    await expect(fallback).toBeVisible()
    // Beside the phone's own recovery, not in place of it.
    await expect(
      page.getByRole("button", { name: "Resend code" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Wrong number? Use a different one" })
    ).toBeVisible()
    const wrongNumber = await page
      .getByRole("link", { name: "Wrong number? Use a different one" })
      .boundingBox()
    expect((await fallback.boundingBox())!.y).toBeGreaterThan(wrongNumber!.y)
    // The QR and referral travel with it.
    const href = new URL(
      (await fallback.getAttribute("href")) ?? "",
      "http://localhost"
    )
    expect(href.searchParams.get("step")).toBe("email")
    expect(href.searchParams.get("qr")).toBe("welcome-fixture-qr")
    expect(href.searchParams.get("ref")).toBe("FRIEND1")
    await expectNoAxeViolations(page, "join phone code step with email")
    expect(hydrationErrors).toEqual([])
  })

  test("a reload once the send is over 30 seconds old shows the email fallback at once", async ({
    page,
  }) => {
    await installFallbackClock(page)
    const sentAt = Math.floor(Date.now() / 1_000)
    const path = `/dev/welcome-offer?surface=code-email-existing&offer=none&sentAt=${sentAt}`
    await gotoHydratedPage(page, path)
    await expect(emailFallback(page)).toHaveCount(0)

    await page.clock.fastForward(40_000)
    await page.reload()
    // Well inside the 30 seconds a wait from the mount would need.
    await expect(emailFallback(page)).toBeVisible({ timeout: 5_000 })

    // A send time well in the past on a fresh load behaves the same.
    await gotoHydratedPage(
      page,
      `/dev/welcome-offer?surface=code-email&offer=none&sentAt=${sentAt - 45}`
    )
    await expect(emailFallback(page)).toBeVisible()
  })

  test("with email sign-in off the phone code step never offers email", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/welcome-offer?surface=code&offer=none")
    await expect(page.getByLabel("Your code")).toBeVisible()
    await page.clock.fastForward(120_000)
    await expect(emailFallback(page)).toHaveCount(0)
    await expect(page.getByRole("link", { name: /email/i })).toHaveCount(0)
  })
})

const HYDRATION_ERROR =
  /hydration failed|server rendered (text|html) didn't match|hydrated.*didn't match|hydration mismatch/i

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
