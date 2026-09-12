import { expect, type Browser } from "@playwright/test"

import type { Sql } from "./admin-live-db"
import { dismissPwaInstall } from "./harness"
import {
  cleanupMerchantOnboardingLiveDbFixture,
  createMerchantOnboardingLiveDbFixture,
  type MerchantOnboardingLiveDbFixture,
} from "./merchant-onboarding-live-db"
import type { PublicQrRouterFixture } from "./public-qr-router-live-db"

/** Uses the disposable join fixture and the real merchant action, on loopback. */
export async function verifyWelcomeOfferCounter({
  sql,
  browser,
  fixture,
  entitlementId,
  baseURL,
}: {
  sql: Sql
  browser: Browser
  fixture: PublicQrRouterFixture
  entitlementId: string
  baseURL: string
}) {
  const context = await browser.newContext({ baseURL })
  let merchantSession: MerchantOnboardingLiveDbFixture | undefined
  const [original] = await sql`
    select owner_user_id::text from public.merchants
    where id = ${fixture.merchantId}::uuid`
  try {
    merchantSession = await createMerchantOnboardingLiveDbFixture(sql, context)
    await sql`update public.merchants set owner_user_id = ${merchantSession.userId}::uuid where id = ${fixture.merchantId}::uuid`
    // This owned fixture has incomplete setup while its issued pass stays valid.
    await sql`update public.qr_codes set is_active = false where merchant_id = ${fixture.merchantId}::uuid`
    await sql`update public.merchant_locations set address_line_1 = '1 Browser Lane', address_city = 'Cambridge', address_postcode = 'CB2 3PA' where merchant_id = ${fixture.merchantId}::uuid`
    const [token] = await sql`
      select id::text from public.offer_pass_scan_tokens
      where entitlement_id = ${entitlementId}::uuid and consumed_at is null
      order by expires_at desc limit 1`
    const scanPath = `/app/offers/scan/${token.id}`
    const page = await context.newPage()
    await dismissPwaInstall(page)
    await page.goto("/app/scan")
    await expect(page.locator("body")).not.toHaveAttribute("inert", "")
    const reminder = page.getByRole("progressbar", { name: /Setup progress/ })
    await expect(reminder).toBeVisible()
    // Next observes the native History API without replacing cached layout
    // children. This directly exercises the route-sensitive shell boundary.
    await page.evaluate((path) => history.pushState(null, "", path), scanPath)
    await expect(reminder).toHaveCount(0)
    await page.goBack()
    await expect(reminder).toBeVisible()

    // The inverse uses a real Next Link: initial counter load -> dashboard.
    await page.goto(scanPath)
    await expect(
      page.getByRole("heading", { name: "Check this pass." })
    ).toBeVisible()
    await expect(reminder).toHaveCount(0)
    await page.getByRole("link", { name: "Back to dashboard" }).click()
    await page.waitForURL((url) => url.pathname === "/app")
    await expect(reminder).toBeVisible()

    await page.goto(scanPath)
    await expect(
      page.getByText("One pass per person.", { exact: false }).last()
    ).toBeVisible()
    const [before] =
      await sql`select count(*)::int as count from public.offer_redemptions where merchant_id = ${fixture.merchantId}::uuid`
    expect(before.count).toBe(0)
    await page.locator('[name="idChecked"]').check()
    await page.locator('[name="noStacking"]').check()
    await page.getByRole("button", { name: "Apply 15% off" }).click()
    await expect(
      page.getByText("Discount use recorded", { exact: true })
    ).toBeVisible()
    const [after] =
      await sql`select count(*)::int as count from public.offer_redemptions where merchant_id = ${fixture.merchantId}::uuid`
    expect(after.count).toBe(1)
    const [pass] =
      await sql`select status, customer_id::text from public.offer_discount_entitlements where id = ${entitlementId}::uuid`
    expect(pass.status).toBe("active")
    const [fresh] = await sql`
      select * from public.create_offer_pass_scan_token(${entitlementId}::uuid, ${pass.customer_id}::uuid)`
    expect(fresh.scan_token).toBeTruthy()
    expect(fresh.scan_token).not.toBe(token.id)
  } finally {
    await context.close()
    await sql`update public.merchants set owner_user_id = ${original.owner_user_id}::uuid where id = ${fixture.merchantId}::uuid`
    await cleanupMerchantOnboardingLiveDbFixture(sql, merchantSession)
  }
}
