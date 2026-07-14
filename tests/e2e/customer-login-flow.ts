import { expect, test } from "@playwright/test"
import { parsePhoneNumberWithError } from "libphonenumber-js"

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

const GENERIC_REQUEST_MESSAGE =
  /If that number has Nabaperks cards, enter the code we sent/i
const DEV_OTP = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const WRONG_OTP = DEV_OTP === "000000" ? "111111" : "000000"
const SESSION_COOKIE = "nabaperks_customer_session"

function unusedUkMobile() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `074${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`
    try {
      if (parsePhoneNumberWithError(candidate, "GB").isValid()) return candidate
    } catch {
    }
  }
  return "07911123456"
}

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

      await page.locator("#contact").fill(unusedUkMobile())
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
