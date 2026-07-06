import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  DEV_OTP,
  disposableUkMobile,
  readReferralEdge,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"

// MS-referral-attribution — RA-2 + RA-3. Proves the real member-facing referral
// link `/m/[slug]/join?ref=<code>` (no QR) renders the join, survives the
// phone -> OTP -> terms wizard, and durably attributes the friend's new
// membership to the referrer. Runs against the seed merchant (old-crown-girton),
// which resolves slug-only just like a live merchant. Cleanup is scoped to the
// two customers this test creates — never the shared seed merchant's own rows.
const SEED_MERCHANT_SLUG = "old-crown-girton"

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

    const friendPhone = disposableUkMobile()
    let referrerCustomerId: string | undefined
    let friendCustomerId: string | undefined

    try {
      const [merchant] = await sql<readonly { id: string }[]>`
        select id::text as id from public.merchants
        where business_slug = ${SEED_MERCHANT_SLUG} limit 1`
      test.skip(!merchant, "seed merchant old-crown-girton is not present")
      if (!merchant) return

      // Referrer A: a member at this venue with a minted share code.
      const [refCustomer] = await sql<readonly { id: string }[]>`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`ref-${randomUUID()}@test.local`}, now(), now(), now())
        returning id::text as id`
      referrerCustomerId = refCustomer.id
      const [referrer] = await sql<
        readonly { membership_id: string; referral_code: string }[]
      >`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${merchant.id}::uuid, ${refCustomer.id}::uuid)
        returning id::text as membership_id, referral_code`

      // Friend B opens A's real referral link and completes the wizard.
      await page.goto(
        `/m/${SEED_MERCHANT_SLUG}/join?ref=${encodeURIComponent(
          referrer.referral_code
        )}`
      )
      await expect(
        page.getByRole("heading", { name: "Save your card to your number" })
      ).toBeVisible()
      await page.locator("#contact").fill(friendPhone.national)
      await page.getByRole("button", { name: "Text me the code" }).click()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
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

      const [friend] = await sql<
        readonly { membership_id: string; customer_id: string }[]
      >`
        select cm.id::text as membership_id, cm.customer_id::text as customer_id
        from public.customer_memberships cm
        join public.customers c on c.id = cm.customer_id
        where cm.merchant_id = ${merchant.id}::uuid
          and c.phone_hmac = ${friendPhone.phoneHmac}
        order by cm.created_at desc
        limit 1`
      if (!friend) {
        throw new Error("Friend join did not create a membership.")
      }
      friendCustomerId = friend.customer_id

      // The `ref` survived every step: the edge links friend -> referrer.
      const edge = await readReferralEdge(sql, friend.membership_id)
      expect(edge).toBeTruthy()
      expect(edge?.referrerMembershipId).toBe(referrer.membership_id)
      expect(edge?.referralCodeUsed).toBe(referrer.referral_code)
    } finally {
      // Scoped cleanup: only the two customers this test created (referrals
      // cascade when their memberships are deleted). The seed merchant is left
      // intact.
      for (const customerId of [friendCustomerId, referrerCustomerId]) {
        if (!customerId) continue
        await sql`delete from public.customer_sessions where customer_id = ${customerId}::uuid`
        await sql`delete from public.product_events where customer_id = ${customerId}::uuid`
        await sql`delete from public.reward_events where customer_id = ${customerId}::uuid`
        await sql`delete from public.stamp_events where customer_id = ${customerId}::uuid`
        await sql`delete from public.consent_records where customer_id = ${customerId}::uuid`
        await sql`delete from public.customer_memberships where customer_id = ${customerId}::uuid`
        await sql`delete from public.customers where id = ${customerId}::uuid`
      }
      await sql.end()
    }
  })
})
