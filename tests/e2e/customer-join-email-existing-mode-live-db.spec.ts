import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupEmailJoinRows,
  confirmJoinCode,
  customerJoinEmailSkipReason,
  installKnownDevice,
  readEmailWallets,
  requestJoinEmailCode,
  uniqueJoinEmail,
} from "./helpers/customer-join-email-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

/**
 * Email sign-in in mode `existing`: an email opens a wallet that already holds
 * it but never creates one, even when the new-wallet request is forged.
 *
 * Opt-in like customer-join-email-live-db.spec.ts, with
 * CUSTOMER_EMAIL_AUTH_MODE=existing. The server reads the mode per request, so
 * this runs against its own dev server rather than the mode `full` one.
 */

const NO_CARD_HEADING = "No card uses this email"
const CREATION_OFF =
  "You can't join with email just now. Use your mobile number instead."

test.describe("@customer-flow join by email (live database, mode existing)", () => {
  const reason =
    customerReadbackLiveDbSkipReason() ??
    customerJoinEmailSkipReason("existing")
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a verified email with no wallet says no card uses it, offers only the phone, and a forged start creates nothing", async ({
    context,
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueJoinEmail("existing")
    const phone = disposableUkMobile()
    let fixture: PublicQrRouterFixture | undefined
    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return
      await installKnownDevice(context)

      // Phone leads; email is the code step's fallback after 30 seconds.
      await requestJoinEmailCode(page, fixture, email, phone)
      await confirmJoinCode(page)

      await expect(
        page.getByRole("heading", { name: NO_CARD_HEADING })
      ).toBeVisible()
      await expect(page.getByRole("button", { name: /Continue/ })).toHaveCount(
        0
      )
      await expect(
        page.getByRole("button", { name: "Use my mobile number" })
      ).toBeVisible()
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])

      // Forge the new-wallet request: the harness renders the real confirmed-
      // email form bound to the real action. Point it at this venue, whose
      // verified-email handoff this device now holds, so only the mode can
      // refuse it.
      await gotoHydratedPage(
        page,
        "/dev/welcome-offer?surface=email-confirmed&offer=none"
      )
      const start = page.getByRole("button", {
        name: "Continue",
        exact: true,
      })
      const form = start.locator("xpath=ancestor::form")
      await form
        .locator('input[name="merchantSlug"]')
        .evaluate(
          (input, slug) => ((input as HTMLInputElement).value = slug),
          fixture.merchantSlug
        )
      await form
        .locator('input[name="qrId"]')
        .evaluate(
          (input, qr) => ((input as HTMLInputElement).value = qr),
          fixture.activeQrId
        )
      await start.click()
      await expect(page.getByText(CREATION_OFF)).toBeVisible()
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupEmailJoinRows(sql, [email])
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
