import { expect, test } from "@playwright/test"

import { disposableUkMobile } from "./helpers/customer-join-live-db"
import { openPhoneLoginStep } from "./helpers/customer-login-phone"
import { dismissPwaInstall } from "./helpers/harness"

/**
 * customer auth wallet - anti-enumeration wallet login (e2e).
 *
 * This flow drives the real `/home/login` server actions against a customer-flow
 * dev server (.env.local + local Supabase, with CUSTOMER_DEV_OTP_CODE bypassing
 * Twilio so `424242` verifies). It proves the source-level security contract in
 * the browser: an unknown number reaches the same OTP step, shows failed-code
 * feedback, and is denied a session after a valid code.
 *
 * Opt-in: run with CUSTOMER_FLOW_E2E=1 against such a server; the default
 * DB-free e2e CI job leaves it skipped.
 */

// The same answer whether or not the number holds a wallet (#332 copy).
const GENERIC_REQUEST_MESSAGE =
  /If a code arrives for that number, enter it here\. Otherwise scan a venue QR to join first\./i
const DEV_OTP = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const WRONG_OTP = DEV_OTP === "000000" ? "111111" : "000000"
const SESSION_COOKIE = "nabaperks_customer_session"

export function describeCustomerLoginAntiEnumeration() {
  test.describe("@customer-flow wallet login (anti-enumeration)", () => {
    test.skip(
      !process.env.CUSTOMER_FLOW_E2E,
      "set CUSTOMER_FLOW_E2E=1 with a customer-flow dev server + local Supabase"
    )

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("an unknown number reaches the OTP step but a valid code grants no session", async ({
      page,
      context,
    }) => {
      const response = await page.goto("/home/login")
      test.skip(
        !response || response.status() >= 400,
        "customer-flow dev server is not serving /home/login"
      )
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible()
      await openPhoneLoginStep(page)

      // A fresh number holds no wallet; the helper refuses unless nothing
      // could text it (QA BUG-052).
      await page.locator("#contact").fill(disposableUkMobile().national)
      await page.getByRole("button", { name: "Send code" }).click()

      await expect(page.getByText(GENERIC_REQUEST_MESSAGE)).toBeVisible()
      await expect(page.locator("#otp")).toBeVisible()

      await page.locator("#otp").fill(WRONG_OTP)
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/home/login") &&
            response.request().method() === "POST"
        ),
        page.getByRole("button", { name: "Open my cards" }).click(),
      ])
      await expect(
        page
          .locator('[role="alert"]')
          .filter({ hasText: /That code was not accepted/i })
      ).toBeVisible()
      await expect(page.locator("#otp")).toBeVisible()

      await page.locator("#otp").fill(DEV_OTP)
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/home/login") &&
            response.request().method() === "POST"
        ),
        page.getByRole("button", { name: "Open my cards" }).click(),
      ])

      await expect(
        page.getByText(/No cards found for that number yet/i)
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Scan a venue QR" })
      ).toHaveAttribute("href", "/scan")
      await expect(
        page.getByRole("button", { name: "Send code", exact: true })
      ).toHaveCount(0)

      const cookies = await context.cookies()
      expect(
        cookies.find((cookie) => cookie.name === SESSION_COOKIE),
        "no customer session is minted for an unknown number"
      ).toBeUndefined()
      expect(
        new URL(page.url()).pathname,
        "stays on the login page, not redirected into /home"
      ).toBe("/home/login")
    })
  })
}
