import { createHash, createHmac } from "node:crypto"

import { expect, test } from "@playwright/test"

import {
  customerOtpSendPhoneRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
} from "@/lib/customer/otp-rate-limit-core"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { DEV_OTP } from "./helpers/customer-join-live-db"
import { assertDisposablePhoneSafe } from "./helpers/disposable-phone-guard"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

test.describe("supported UK number policy at the local login boundary", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test("a reserved UK fixed-line number reaches verification and grants no unknown wallet", async ({
    page,
    context,
  }, testInfo) => {
    assertDisposablePhoneSafe(process.env)
    const sql = connectLocalDb()
    if (!sql) throw new Error("Owned local database is required")
    const secret = process.env.CUSTOMER_PHONE_HMAC_SECRET
    if (!secret) throw new Error("Fresh fixture phone HMAC key is required")
    const e164 = "+442079460018"
    const phoneHmac = createHmac("sha256", secret).update(e164).digest("hex")
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    try {
      const before = await sql`
        select id from public.customers where phone_hmac = ${phoneHmac}`
      expect(before).toHaveLength(0)
      await dismissPwaInstall(page)
      await gotoHydratedPage(page, "/home/login")
      await page.locator("#contact").fill("020 7946 0018")
      await page.getByRole("button", { name: "Send my code" }).click()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()
      await expect(
        page.getByText(/We couldn't find any cards for this number/i)
      ).toBeVisible()
      expect(
        (await context.cookies()).find(
          (cookie) => cookie.name === "nabaperks_customer_session"
        )
      ).toBeUndefined()
      const after = await sql`
        select id from public.customers where phone_hmac = ${phoneHmac}`
      expect(after).toHaveLength(0)
      expect(errors).toEqual([])
      await testInfo.attach("supported-uk-fixed-line-policy", {
        body: JSON.stringify({
          mode: "REAL_APP_REAL_DB_LOCAL_DEV_CODE_NO_PROVIDER_DELIVERY",
          acceptedAtVerification: true,
          unknownWalletRefused: true,
          customerRowsBefore: before.length,
          customerRowsAfter: after.length,
          browserErrors: errors,
        }),
        contentType: "application/json",
      })
    } finally {
      for (const key of [
        customerOtpSendPhoneRateLimitKey(e164),
        customerOtpVerifyPhoneRateLimitKey(e164),
      ]) {
        await sql`
          delete from public.rate_limit_buckets
          where bucket_key = ${createHash("sha256").update(key).digest("hex")}`
      }
      await sql.end({ timeout: 5 })
    }
  })
})
