import { expect, test } from "@playwright/test"

import { connectLocalDb } from "../helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  WRONG_OTP,
} from "../helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "../helpers/customer-readback-live-db"
import { dismissPwaInstall } from "../helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  publicQrPath,
  type PublicQrRouterFixture,
} from "../helpers/public-qr-router-live-db"

test.describe("@MS-customer-join-auth-abuse OTP resilience", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("keeps country, resend, and wrong-code failures inside the composed join flow", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await page.goto(`${publicQrPath(fixture.activeQrId)}?ref=FRIEND01`)
      await page.getByRole("link", { name: "Get today's stamp" }).click()
      await page.locator("#contact").fill("+1 202 555 0123")
      await page.getByRole("button", { name: "Text me the code" }).click()
      await expect(page.getByText("Enter a UK phone number.")).toBeVisible()

      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Text me the code" }).click()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      expect(new URL(page.url()).searchParams.get("ref")).toBe("FRIEND01")

      await page.getByRole("button", { name: "Resend code" }).click()
      await expect(
        page.getByText("New code sent. It can take a moment to arrive.")
      ).toBeVisible()

      await page.locator("#otp").fill(WRONG_OTP)
      await page.getByRole("button", { name: "Check code" }).click()
      await expect(page.getByText("That code was not accepted.")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Resend code" })
      ).toBeVisible()
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
