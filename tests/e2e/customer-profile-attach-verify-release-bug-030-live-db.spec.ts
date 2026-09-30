import { createHash, randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { customerOtpVerifyPhoneRateLimitKey } from "@/lib/customer/otp-rate-limit-core"

import type { Sql } from "./helpers/admin-live-db"
import {
  DEV_OTP,
  WRONG_OTP,
  cleanupCustomerJoinRows,
  disposableUkMobile,
  installCustomerSession,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import {
  connectCustomerReadbackDb,
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * QA BUG-030 remainder (38c42a1..2c45031): adding a phone from the profile
 * reserved a verify attempt in the per-phone bucket and never gave it back,
 * so correct codes used up the five-per-15-minutes limit. Only a rejected
 * code may count (FIX-PLAN Q2). Proven here on the real action and the real
 * `rate_limit_buckets` row: one wrong code then the correct one leaves one
 * attempt counted, not two.
 *
 * Opt-in like the other @customer-flow live-DB specs; the local dev code
 * stands in for the text message.
 */

const ATTACHED = "Your phone number is added. You can sign in with it too."

test.describe("@customer-flow profile phone codes only count when rejected (QA BUG-030)", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a correct attach code gives back its verify attempt; a wrong one keeps it", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const phone = disposableUkMobile()
    const customerId = randomUUID()
    try {
      await seedEmailOnlyWallet(sql, customerId)
      await installCustomerSession(
        context,
        await createBrowserCustomerSession(sql, customerId)
      )

      const section = await sendAttachCode(page, phone)
      await section.getByLabel("Phone code").fill(WRONG_OTP)
      await section.getByRole("button", { name: "Add phone number" }).click()
      await expect(
        section.getByText("That code was not accepted.")
      ).toBeVisible()
      await expect.poll(() => verifyAttempts(sql, phone)).toBe(1)

      await section.getByLabel("Phone code").fill(DEV_OTP)
      await section.getByRole("button", { name: "Add phone number" }).click()
      await expect(section.getByRole("status")).toHaveText(ATTACHED)
      await expect.poll(() => verifyAttempts(sql, phone)).toBe(1)
    } finally {
      await sql`
        delete from public.audit_logs
        where customer_id = ${customerId}::uuid`
      await sql`
        delete from public.product_events
        where customer_id = ${customerId}::uuid`
      await sql`
        delete from public.customers
        where id = ${customerId}::uuid`
      await cleanupCustomerJoinRows(sql, undefined, phone)
      await sql.end()
    }
  })
})

async function sendAttachCode(page: Page, phone: DisposablePhone) {
  await gotoHydratedPage(page, "/home/profile")
  const section = page.locator("[data-add-phone]")
  await expect(
    section.getByRole("heading", { name: "Add a phone number" })
  ).toBeVisible()
  await section.getByLabel("Phone number", { exact: true }).fill(phone.national)
  await section.getByRole("button", { name: "Send my code" }).click()
  await expect(section.getByText("Phone ending")).toContainText(phone.last4)
  return section
}

async function verifyAttempts(sql: Sql, phone: DisposablePhone) {
  const bucket = createHash("sha256")
    .update(customerOtpVerifyPhoneRateLimitKey(phone.e164))
    .digest("hex")
  const rows = await sql<readonly { count: number }[]>`
    select count::int as count
    from public.rate_limit_buckets
    where bucket_key = ${bucket}
      and reset_at > now()`
  return rows.at(0)?.count ?? 0
}

/** Confirmed email, name and adult date of birth; no phone yet. */
async function seedEmailOnlyWallet(sql: Sql, customerId: string) {
  const email = `attach-limit-${customerId.slice(0, 12)}@example.test`
  await sql`
    insert into public.customers (
      id, email, email_hmac, email_verified_at, full_name, date_of_birth
    )
    values (
      ${customerId}::uuid, ${email}, ${customerEmailHmac(email)}, now(),
      'Attach Limit Browser', date '1990-01-01'
    )`
}
