import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openTermsStep,
  readJoinedMembership,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

type FunnelKeyRow = {
  readonly funnel_key: string
}

type FunnelEventRow = {
  readonly event_name: string
  readonly metadata: Record<string, unknown>
}

test.describe("durable join funnel", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("records rendered QR join milestones in the first-party ledger", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    let funnelKey: string | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return
      const activeFixture = fixture

      await openTermsStep(page, fixture, phone)
      await page.getByLabel(/Loyalty terms/i).check()
      await page.getByRole("button", { name: "Get my first stamp" }).click()
      await expect(page).toHaveURL(/\/card\/[^?]+/)

      const joined = await readJoinedMembership(sql, fixture, phone)
      if (!joined) throw new Error("Join did not create a membership.")
      await expect(page).toHaveURL(new RegExp(`/card/${joined.membership_id}`))

      await expect.poll(async () => {
        const rows = await sql<readonly FunnelKeyRow[]>`
            select metadata ->> 'funnel_key' as funnel_key
            from public.product_events
            where merchant_id = ${activeFixture.merchantId}::uuid
              and event_name = 'join_page_viewed'
              and metadata ->> 'step' = 'welcome'
            order by occurred_at desc
            limit 1`
        return rows.at(0)?.funnel_key
      }).toMatch(/^ana_v1_[A-Za-z0-9_-]{43}$/)

      const keyRows = await sql<readonly FunnelKeyRow[]>`
        select metadata ->> 'funnel_key' as funnel_key
        from public.product_events
        where merchant_id = ${activeFixture.merchantId}::uuid
          and event_name = 'join_page_viewed'
          and metadata ->> 'step' = 'welcome'
        order by occurred_at desc
        limit 1`
      funnelKey = keyRows.at(0)?.funnel_key
      if (!funnelKey) throw new Error("Join funnel key was not persisted.")

      const events = await sql<readonly FunnelEventRow[]>`
        select event_name, metadata
        from public.product_events
        where metadata ->> 'funnel_key' = ${funnelKey}
        order by occurred_at, event_name`
      const semanticEvents = events.map(
        (event) => `${event.event_name}:${String(event.metadata.step)}`
      )

      for (const expected of [
        "join_page_viewed:welcome",
        "join_page_viewed:phone",
        "join_phone_requested:phone",
        "join_page_viewed:otp",
        "join_otp_verified:otp",
        "join_page_viewed:terms",
        "join_terms_accepted:terms",
        "customer_card_viewed:card",
      ]) {
        expect(semanticEvents).toContain(expected)
      }
      expect(new Set(semanticEvents).size).toBe(semanticEvents.length)

      const serialized = JSON.stringify(events)
      expect(serialized).not.toContain(phone.e164)
      expect(serialized).not.toContain(activeFixture.activeQrId)
      expect(serialized).not.toContain("424242")
    } finally {
      if (funnelKey) {
        await sql`
          delete from public.product_events
          where metadata ->> 'funnel_key' = ${funnelKey}`
      }
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
