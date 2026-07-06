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

// MS-referral-attribution — proves RA-2 (a `ref` supplied on the join URL
// survives the phone -> OTP -> terms wizard) and RA-3 (a friend joining via a
// referrer's code is durably attributed to that referrer), plus RA-4
// (self-referral is silently skipped). Live-DB tier: drive the real wizard with
// the dev OTP, then assert the `referrals` edge in Postgres.
test.describe("@customer-flow referral attribution live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a friend joining via ?ref is attributed to the referrer (RA-2, RA-3)", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const friendPhone = disposableUkMobile()
    const referrerPhone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      // Referrer A: an existing member at this venue, holding a share code.
      const referrer = await seedReferrerMembership(sql, fixture, referrerPhone)

      // Friend B lands on the venue join link carrying A's referral code and
      // completes the normal, consented wizard.
      await openOtpStep(page, fixture, friendPhone, { ref: referrer.referral_code })

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

      // The attribution edge links the friend (referred) to the referrer.
      const edge = await readReferralEdge(sql, friend.membership_id)
      expect(edge).toBeTruthy()
      expect(edge?.referrer_membership_id).toBe(referrer.membership_id)
      expect(edge?.referral_code_used).toBe(referrer.referral_code)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, friendPhone)
      await cleanupCustomerJoinRows(sql, fixture, referrerPhone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("a member using their own code is not self-attributed (RA-4)", async ({
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

      // Seed the member and reuse THEIR OWN code as the ref on a fresh join.
      const self = await seedReferrerMembership(sql, fixture, phone)

      await openOtpStep(page, fixture, phone, { ref: self.referral_code })
      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Save my card" }).click()

      // Same phone -> same customer -> returning member, so no new attribution
      // edge is ever written for this membership.
      const edge = await readReferralEdge(sql, self.membership_id)
      expect(edge).toBeFalsy()
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
