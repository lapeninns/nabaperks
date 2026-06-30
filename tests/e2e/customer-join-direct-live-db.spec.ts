import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openDirectTermsStep,
  readJoinedMembership,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

test.describe("@customer-flow direct customer join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("joins without issuing a first stamp when no QR proof is present", async ({
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

      await openDirectTermsStep(page, fixture.merchantSlug, phone)
      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            !url.searchParams.has("stamp") &&
            !url.searchParams.has("firststamp")
        ),
        page.getByRole("button", { name: "Get my first stamp" }).click(),
      ])

      const joined = await readJoinedMembership(sql, fixture, phone)
      if (!joined) {
        throw new Error("Direct join did not create a disposable membership.")
      }
      expect(joined.current_stamp_count).toBe(0)
      expect(joined.total_stamps_earned).toBe(0)
      expect(joined.stamp_count).toBe(0)
      expect(joined.join_event_count).toBe(1)
      expect(new URL(page.url()).pathname).toBe(`/card/${joined.membership_id}`)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
