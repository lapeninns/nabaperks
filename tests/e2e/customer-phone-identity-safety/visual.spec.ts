import { expect, test } from "@playwright/test"

import { connectLocalDb } from "../helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openOtpStep,
} from "../helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "../helpers/customer-readback-live-db"
import { dismissPwaInstall } from "../helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "../helpers/public-qr-router-live-db"

const pendingPhoneCookieName = "nabaperks_pending_phone"

test.describe("@MS-customer-phone-identity-safety pending phone privacy", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("keeps the pending phone opaque and fails safely after tampering", async ({
    context,
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

      await openOtpStep(page, fixture, phone)
      const pending = (await context.cookies()).find(
        (cookie) => cookie.name === pendingPhoneCookieName
      )

      expect(pending).toBeDefined()
      expect(pending?.httpOnly).toBe(true)
      expect(pending?.sameSite).toBe("Lax")
      expect(pending?.path).toBe("/")
      expect(pending?.value).not.toContain(phone.e164)
      expect(pending?.value.split(".")).toHaveLength(4)
      expect(await page.locator("body").textContent()).not.toContain(phone.e164)
      expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
        phone.e164
      )

      if (!pending) return
      const replacement = pending.value.endsWith("A") ? "B" : "A"
      await context.addCookies([
        {
          ...pending,
          value: `${pending.value.slice(0, -1)}${replacement}`,
        },
      ])
      await page.reload()
      await expect(
        page.getByRole("heading", { name: "Keep your card on your phone" })
      ).toBeVisible()
      await expect(page.locator("#otp")).toHaveCount(0)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
