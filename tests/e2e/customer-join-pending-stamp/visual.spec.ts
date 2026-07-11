import { expect, test } from "@playwright/test"

import { connectLocalDb } from "../helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openTermsStep,
  readJoinedMembership,
} from "../helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "../helpers/customer-readback-live-db"
import { dismissPwaInstall } from "../helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "../helpers/public-qr-router-live-db"

test.describe("@MS-customer-join-ledger-recovery first-stamp recovery", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("persists a failed first stamp and resolves one stamp after a safe retry", async ({
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

      await sql`
        update public.loyalty_cards
        set stamps_required = 1
        where id = ${fixture.loyaltyCardId}::uuid`
      await sql`
        update public.reward_pool_items
        set is_active = false
        where loyalty_card_id = ${fixture.loyaltyCardId}::uuid`

      await openTermsStep(page, fixture, phone)
      await page.getByLabel(/Loyalty terms/i).check()
      await page.getByRole("button", { name: "Get my first stamp" }).click()
      await expect(page).toHaveURL(/\/card\/[^?]+/)
      await expect(page.getByText("Your card is saved.")).toBeVisible()
      await expect(
        page.getByText("This venue is not taking stamps just now.")
      ).toBeVisible()

      await page.reload()
      await expect(page.getByText("Your card is saved.")).toBeVisible()

      const joined = await readJoinedMembership(sql, fixture, phone)
      expect(joined?.stamp_count).toBe(0)
      if (!joined) throw new Error("Join did not create a membership.")

      await sql`
        update public.reward_pool_items
        set is_active = true
        where loyalty_card_id = ${fixture.loyaltyCardId}::uuid`
      await sql`
        update public.customer_join_stamp_recoveries
        set reason = 'transient',
            resolution = 'retry',
            retry_until = now() + interval '10 minutes'
        where membership_id = ${joined.membership_id}::uuid`

      await page.reload()
      await page
        .getByRole("button", { name: "Try my first stamp again" })
        .click()
      await expect(page).toHaveURL(new RegExp(`/card/${joined.membership_id}`))
      await expect(page.getByText("That's the full card.")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Try my first stamp again" })
      ).toHaveCount(0)

      const resolved = await readJoinedMembership(sql, fixture, phone)
      expect(resolved?.stamp_count).toBe(1)
      expect(resolved?.current_stamp_count).toBe(1)

      const [replayed] = await sql`
        select * from public.retry_customer_join_first_stamp(
          ${joined.membership_id}::uuid,
          ${joined.customer_id}::uuid
        )`
      expect(replayed.outcome).toBe("not_found")
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
