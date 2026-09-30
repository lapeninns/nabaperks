import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openTermsStep,
  readJoinedMembership,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

test.describe("@customer-flow customer join terms live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("keeps a QR join on the terms step when loyalty terms are missing", async ({
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

      await openTermsStep(page, fixture, phone)
      await page.getByRole("button", { name: "Add my first stamp" }).click()

      await expect(
        page.getByText("Tick the card terms to continue.", { exact: true })
      ).toBeVisible()
      const terms = page.getByLabel(/Card terms/i)
      await expect(terms).toBeFocused()
      await expect(terms).toHaveAttribute("aria-invalid", "true")
      // The error first, then the reward requirements line it always carries.
      await expect(terms).toHaveAttribute(
        "aria-describedby",
        "loyalty-terms-error loyalty-terms-requirements"
      )
      await expect(
        page.getByRole("heading", { name: /^Join the card at / })
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
