import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import { expectNoAxeViolations } from "./helpers/axe"
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

test.describe("@customer-flow @a11y direct customer join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("joins without issuing a first stamp when no QR proof is present", async ({
    page,
  }, testInfo) => {
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
      await expectNoAxeViolations(page, "direct customer join terms step")
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
      await testInfo.attach("direct-join-terms", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      })
      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            !url.searchParams.has("stamp") &&
            !url.searchParams.has("firststamp")
        ),
        page.getByRole("button", { name: "Save my card" }).click(),
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
