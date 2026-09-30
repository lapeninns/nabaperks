import { expect, test } from "@playwright/test"

import { emailFallback, installFallbackClock } from "./helpers/email-fallback"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * QA BUG-019: on /home/login, taking the email fallback from the phone code
 * step by keyboard replaced the focused button and left focus on <body>, so
 * the next Tab started from the top of the page. The join page's equivalent
 * switch focuses the email field; /home/login must do the same. Rendered by
 * the DB-free customer-login harness with the real form.
 */
test.describe("@customer-flow @a11y wallet sign-in email fallback focus", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("switching to email by keyboard moves focus to the email field", async ({
    page,
  }) => {
    await installFallbackClock(page)
    await gotoHydratedPage(page, "/dev/customer-login?mode=full")
    await page
      .getByLabel("UK mobile number", { exact: true })
      .fill("07700900123")
    await page.getByRole("button", { name: "Send my code" }).click()
    await expect(page.getByLabel("Your code")).toBeVisible()

    await page.clock.fastForward(31_000)
    const fallback = emailFallback(page)
    await expect(fallback).toBeVisible()
    await fallback.focus()
    await page.keyboard.press("Enter")

    await expect(
      page.getByRole("heading", {
        name: "Get your code by email",
        exact: true,
      })
    ).toBeVisible()
    await expect(page.getByLabel("Email address")).toBeFocused()
  })
})
