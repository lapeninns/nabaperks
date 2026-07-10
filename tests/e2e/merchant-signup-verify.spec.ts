import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * Merchant signup email-verification focus regression (@signup-verify).
 *
 * The verify form mirrors the signup form's first-invalid-field focus: when the
 * server action rejects the code, focus returns to the code field instead of
 * staying on the submit button. The invalid-format path returns before any
 * Supabase/rate-limit I/O, and the GET render degrades to a null user without a
 * session, so this needs no auth or database — only a dev server.
 *
 * Mobile-safari project only (the `.spec.ts` suffix).
 */
test.describe("merchant signup verify @signup-verify @MS-auth-otp-alias-finalization", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("focuses the code field when the entered code is rejected", async ({
    page,
  }) => {
    await page.goto(
      "/signup/verify?email=harness%40example.com&name=Harness%20Operator"
    )

    const otp = page.getByLabel("Email code")
    await expect(otp).toBeVisible()

    // A too-short code fails the server-side format check and returns an OTP
    // error with no further I/O. Submitting moves focus to the button first.
    await otp.fill("1")
    await page.getByRole("button", { name: "Verify email" }).click()

    // The regression: focus lands back on the code field after the error.
    await expect(otp).toBeFocused()
  })
})
