import { randomUUID } from "node:crypto"

import { expect, test, type BrowserContext } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
  type BrowserCustomerSession,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"

// referral bonus stamp — RB-9 (share surface, secondary journey proof).
// A member on their collecting card can discover and share their "Bring a
// Regular" link, which carries their card's opaque referral_code as ?ref=<code>
// (never the membership UUID). Seeds a membership + browser session directly and
// loads /card/[id], so the proof is the card render itself, not the join wizard.
// Cleanup is scoped to the single customer this test creates.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

async function applySession(
  context: BrowserContext,
  session: BrowserCustomerSession
): Promise<void> {
  await context.addCookies([
    {
      name: session.cookieName,
      value: session.cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}

test.describe("@customer-flow referral bonus share live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a member can share their referral link from their card", async ({
    page,
    context,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let customerId: string | undefined

    try {
      // An available merchant with an active loyalty card — so the card renders
      // in its collecting state (not an unavailable panel).
      const [merchant] = await sql<readonly { id: string }[]>`
        select m.id::text as id
        from public.merchants m
        join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
        where m.status in ('trial', 'active')
          and (
            m.requires_billing = false
            or exists (
              select 1 from public.billing_customers bc
              where bc.merchant_id = m.id
                and bc.status in ('trial', 'trialing', 'active')
            )
          )
        order by m.created_at
        limit 1`
      test.skip(
        !merchant,
        "no available merchant with an active card is seeded"
      )
      if (!merchant) return

      const [customer] = await sql<readonly { id: string }[]>`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`share-${randomUUID()}@test.local`}, now(), now(), now())
        returning id::text as id`
      customerId = customer.id

      const [membership] = await sql<
        readonly { id: string; referral_code: string; business_slug: string }[]
      >`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${merchant.id}::uuid, ${customer.id}::uuid)
        returning
          id::text as id,
          referral_code,
          (select business_slug from public.merchants where id = ${merchant.id}::uuid) as business_slug`

      const session = await createBrowserCustomerSession(sql, customer.id)
      await applySession(context, session)

      await page.goto(`/card/${membership.id}`)

      // The card surfaces the "Bring a Regular" share panel, whose link carries
      // the opaque referral_code — never the membership UUID or customer id.
      const share = page.getByTestId("referral-share-panel")
      await expect(share).toBeVisible()
      const refUrl = await share
        .getByTestId("referral-share-url")
        .getAttribute("data-url")
      expect(refUrl).toContain(
        `/m/${membership.business_slug}/join?ref=${membership.referral_code}`
      )
      expect(refUrl).not.toContain(membership.id)
      expect(refUrl).not.toContain(customerId)
    } finally {
      if (customerId) {
        await sql`delete from public.customer_sessions where customer_id = ${customerId}::uuid`
        await sql`delete from public.stamp_events where customer_id = ${customerId}::uuid`
        await sql`delete from public.customer_memberships where customer_id = ${customerId}::uuid`
        await sql`delete from public.customers where id = ${customerId}::uuid`
      }
      await sql.end()
    }
  })
})
