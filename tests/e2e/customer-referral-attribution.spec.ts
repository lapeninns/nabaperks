import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  DEV_OTP,
  disposableUkMobile,
  openOtpStep,
  readJoinedMembership,
  readReferralEdge,
  seedReferrerMembership,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

// MS-referral-attribution — RA-2 + RA-3. A `ref` supplied on the join URL
// survives the phone -> OTP -> terms wizard, and the friend's new membership is
// durably attributed to the referrer. Live-DB tier: drive the real wizard with
// the dev OTP, then assert the referrals edge in Postgres. (Self / cross-venue /
// unknown / returning guards are proven at the DB tier.)
test.describe("@customer-flow referral attribution live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a friend joining via ?ref is attributed to the referrer", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const friendPhone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      // Referrer A holds a card at this venue and a minted share code.
      const referrer = await seedReferrerMembership(sql, fixture)

      // Friend B arrives on A's referral link and completes the normal wizard.
      await openOtpStep(page, fixture, friendPhone, {
        ref: referrer.referralCode,
      })
      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Save my card" }).click()
      await expect(
        page.getByRole("heading", { name: "Collect your first stamp" })
      ).toBeVisible()

      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL((url) => url.pathname.startsWith("/card/")),
        page.getByRole("button", { name: "Get my first stamp" }).click(),
      ])

      const friend = await readJoinedMembership(sql, fixture, friendPhone)
      if (!friend) {
        throw new Error("Friend join did not create a membership.")
      }

      // The `ref` survived every step: the edge links friend -> referrer.
      const edge = await readReferralEdge(sql, friend.membership_id)
      expect(edge).toBeTruthy()
      expect(edge?.referrerMembershipId).toBe(referrer.membershipId)
      expect(edge?.referralCodeUsed).toBe(referrer.referralCode)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, friendPhone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
