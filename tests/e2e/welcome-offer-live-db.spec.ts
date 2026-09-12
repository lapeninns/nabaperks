import { createHash, randomBytes } from "node:crypto"
import { expect, test } from "@playwright/test"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { expectNoAxeViolations } from "./helpers/axe"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  installCustomerSession,
  readJoinedMembership,
  DEV_OTP,
  WRONG_OTP,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import { merchantOnboardingLiveDbSkipReason } from "./helpers/merchant-onboarding-live-db"
import { verifyWelcomeOfferCounter } from "./helpers/welcome-offer-counter-live-db"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

const EXTRA_TERMS =
  "Show a valid student or staff card each time. The 15% applies to your own food and drink, not to a shared or group bill.\nOne pass per person."

async function publishLocalOffer(sql: Sql, fixture: PublicQrRouterFixture) {
  const token = randomBytes(32).toString("base64url")
  const hash = createHash("sha256").update(token).digest("hex")
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    const [draft] = await tx`
      select * from public.create_offer_campaign_draft(
        ${fixture.merchantId}::uuid, null, 2, 15,
        public.uk_business_date(now()), public.uk_business_date(now()) + 30,
        true, ${EXTRA_TERMS}, ${hash}, 'local-browser-fixture',
        'Local welcome offer', 'Two welcome stamps and a pass when you join.')`
    await tx`select public.publish_offer_campaign(${fixture.merchantId}::uuid, ${draft.campaign_id}::uuid, null)`
  })
  return `/offer/${token}`
}

async function claimCount(sql: Sql, merchantId: string) {
  const [row] =
    await sql`select count(*)::int as count from public.offer_campaign_claims where merchant_id = ${merchantId}::uuid`
  return row.count as number
}

test.describe("@customer-flow welcome offer real local join", () => {
  const reason =
    customerReadbackLiveDbSkipReason() || merchantOnboardingLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test("grants only after verification and loyalty consent, and repeated scans keep the same card and pass", async ({
    page,
    browser,
  }, testInfo) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return
    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()
    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "local seed owner is unavailable")
      if (!fixture) return
      await dismissPwaInstall(page)
      const offerPath = await publishLocalOffer(sql, fixture)
      await page.goto(offerPath)
      await expect(
        page.getByRole("heading", { name: /2 bonus stamps and 15% off/ })
      ).toBeVisible()
      await page.reload()
      expect(await claimCount(sql, fixture.merchantId)).toBe(0)
      await page.getByRole("button", { name: "Claim this offer" }).click()
      await expect(
        page.getByRole("heading", { name: "Save your card to your number" })
      ).toBeVisible()
      await expect(
        page.getByRole("complementary", { name: "Offer in progress" })
      ).toContainText("Local welcome offer")
      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Send my code" }).click()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await page.locator("#otp").fill(WRONG_OTP)
      await page.getByRole("button", { name: "Check code" }).click()
      await expect(page.locator("#otp")).toHaveAttribute("aria-invalid", "true")
      expect(await claimCount(sql, fixture.merchantId)).toBe(0)
      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Check code" }).click()
      await expect(page.locator("#loyalty-terms")).toBeVisible()
      await expect(page.locator("#loyalty-terms")).not.toBeChecked()
      await expect(page.locator("#marketing-opt-in")).not.toBeChecked()
      expect(await claimCount(sql, fixture.merchantId)).toBe(0)
      await expectNoAxeViolations(page, "real offer loyalty consent")
      await page.locator("#loyalty-terms").check()
      await page.getByRole("button", { name: "Save my card" }).click()
      await page.waitForURL(/\/card\/[^/]+\?welcome=1&offer=1/)
      await expect(page.getByText("Offer added to your card.")).toBeVisible()
      const joined = await readJoinedMembership(sql, fixture, phone)
      expect(joined?.current_stamp_count).toBe(2)
      expect(joined?.stamp_count).toBe(2)
      if (!joined) throw new Error("Expected the saved local membership")
      const [pass] =
        await sql`select id::text, extra_terms from public.offer_discount_entitlements where membership_id = ${joined.membership_id}::uuid`
      expect(pass.extra_terms).toBe(EXTRA_TERMS)
      const [consent] =
        await sql`select count(*)::int as count from public.consent_records where customer_id = ${joined.customer_id}::uuid and merchant_id = ${fixture.merchantId}::uuid and consent_status = 'opted_in'`
      expect(consent.count).toBe(0)
      await page.screenshot({
        path: testInfo.outputPath("saved-welcome-card.png"),
        fullPage: true,
      })
      await testInfo.attach("saved-welcome-card", {
        path: testInfo.outputPath("saved-welcome-card.png"),
        contentType: "image/png",
      })
      await page.getByRole("link", { name: /^Show pass QR,/ }).click()
      const qr = page.getByRole("img", {
        name: /QR code for your 15% discount pass/,
      })
      await expect(qr).toBeVisible()
      await expect
        .poll(() => qr.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
      const firstSrc = await qr.getAttribute("src")
      await page.getByRole("button", { name: "Show a fresh code" }).click()
      await expect(qr).not.toHaveAttribute("src", firstSrc ?? "")
      await page.getByText("Extra terms", { exact: true }).click()
      await expect(page.getByText(EXTRA_TERMS, { exact: true })).toBeVisible()
      await expectNoAxeViolations(page, "real held offer pass")
      await page.screenshot({
        path: testInfo.outputPath("real-local-pass-qr.png"),
        fullPage: true,
      })
      await testInfo.attach("real-local-pass-qr", {
        path: testInfo.outputPath("real-local-pass-qr.png"),
        contentType: "image/png",
      })
      await page.goto(offerPath)
      await expect(
        page.getByRole("link", { name: "Open your card" })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Claim this offer" })
      ).toHaveCount(0)
      await page.reload()
      expect(await claimCount(sql, fixture.merchantId)).toBe(1)
      expect(
        (await readJoinedMembership(sql, fixture, phone))?.current_stamp_count
      ).toBe(2)

      // Another authenticated member cannot claim, and a forged success query
      // cannot display a grant that is absent from that member's ledger.
      const otherContext = await browser.newContext()
      try {
        await installCustomerSession(otherContext, fixture.session)
        const other = await otherContext.newPage()
        await dismissPwaInstall(other)
        await other.goto(offerPath)
        await expect(
          other.getByRole("heading", { name: "You are already a member here" })
        ).toBeVisible()
        await other.goto(`/card/${fixture.membershipId}?offer=1`)
        await expect(other.getByText("Offer added to your card.")).toHaveCount(
          0
        )
        expect(await claimCount(sql, fixture.merchantId)).toBe(1)
      } finally {
        await otherContext.close()
      }
      await verifyWelcomeOfferCounter({
        sql,
        browser,
        fixture,
        entitlementId: pass.id as string,
        baseURL: new URL(page.url()).origin,
      })
    } finally {
      if (fixture) {
        // The loopback-only fixture crosses browser connections, so it cannot
        // use the rollback transaction used by tests/db. Suppress the local
        // append-only trigger only for this transaction's exact owned rows.
        const merchantId = fixture.merchantId
        await sql.begin(async (tx) => {
          await tx`set local session_replication_role = replica`
          await tx`delete from public.offer_redemptions where merchant_id = ${merchantId}::uuid`
        })
        await sql`delete from public.offer_pass_scan_tokens where merchant_id = ${fixture.merchantId}::uuid`
        await sql`delete from public.offer_campaigns where merchant_id = ${fixture.merchantId}::uuid`
      }
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
