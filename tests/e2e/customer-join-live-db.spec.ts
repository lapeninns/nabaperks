import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  DEV_OTP,
  disposableUkMobile,
  openOtpStep,
  readJoinedMembership,
  WRONG_OTP,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

test.describe("@customer-flow customer join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("joins from a disposable QR through OTP and records the first stamp", async ({
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

      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Check code" }).click()
      await expect(
        page.getByRole("heading", { name: "Collect your first stamp" })
      ).toBeVisible()

      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            url.searchParams.get("stamp") === "issued"
        ),
        page.getByRole("button", { name: "Get my first stamp" }).click(),
      ])

      const joined = await readJoinedMembership(sql, fixture, phone)
      if (!joined) {
        throw new Error("Join did not create a disposable membership.")
      }
      expect(joined.current_stamp_count).toBe(1)
      expect(joined.total_stamps_earned).toBe(1)
      expect(joined.stamp_count).toBe(1)
      expect(joined.join_event_count).toBe(1)
      expect(new URL(page.url()).pathname).toBe(`/card/${joined.membership_id}`)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("keeps a disposable QR join on the OTP step when the code is wrong", async ({
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

      await page.locator("#otp").fill(WRONG_OTP)
      await page.getByRole("button", { name: "Check code" }).click()

      await expect(
        page.getByText("That code was not accepted.", { exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await expect(readJoinedMembership(sql, fixture, phone)).resolves.toBe(
        undefined
      )
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
