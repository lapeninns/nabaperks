import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  installCustomerSession,
  readMerchantMembershipCount,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

test.describe("@customer-flow @MS-customer-join-frictionless-ux existing member join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("redirects an existing QR member to stamp without creating another membership", async ({
    context,
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return
      const activeFixture = fixture

      await installCustomerSession(context, activeFixture.session)
      await page.goto(
        `/m/${activeFixture.merchantSlug}/join?qr=${encodeURIComponent(
          activeFixture.activeQrId
        )}`
      )

      await expect(page).toHaveURL(
        (url) =>
          url.pathname === `/card/${activeFixture.membershipId}/stamp` &&
          url.searchParams.get("qr") === activeFixture.activeQrId
      )
      await expect(readMerchantMembershipCount(sql, activeFixture)).resolves.toBe(
        1
      )
    } finally {
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
