import { randomUUID } from "node:crypto"
import { expect, type Page, type TestInfo, test } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  type Sql,
} from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"

type BillingSeedRow = {
  readonly id: string
  readonly stripe_customer_id: string
  readonly stripe_subscription_id: string | null
  readonly status: string
  readonly current_period_end: string | null
  readonly merchant_name: string
}

type BillingRedactionFixture = {
  readonly previous: BillingSeedRow
  readonly stripeCustomerId: string
  readonly stripeSubscriptionId: string
  readonly maskedCustomerRef: string
  readonly maskedSubscriptionRef: string
}

const ADMIN_EMAIL = "admin@nabaperks.test"
const ADMIN_PASSWORD = "NabaperksDemo1!"

const BILLING_FIXTURE_IDS = {
  chromium: "19000000-0000-0000-0000-000000000001",
  "iphone-customer-flow": "19000000-0000-0000-0000-000000000002",
} as const

async function signInAsSeededAdmin(page: Page): Promise<void> {
  await page.goto("/login?next=/admin/billing")
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(ADMIN_EMAIL)
  await page.locator("#password").fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()

  await expect(
    page.getByRole("heading", { exact: true, name: "Billing" })
  ).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/admin/billing")
}

async function prepareBillingRedactionFixture(
  sql: Sql,
  testInfo: TestInfo
): Promise<BillingRedactionFixture | undefined> {
  const fixtureId =
    BILLING_FIXTURE_IDS[
      testInfo.project.name as keyof typeof BILLING_FIXTURE_IDS
    ] ?? BILLING_FIXTURE_IDS.chromium
  const rows = await sql<readonly BillingSeedRow[]>`
    select
      billing_customers.id::text as id,
      billing_customers.stripe_customer_id,
      billing_customers.stripe_subscription_id,
      billing_customers.status,
      billing_customers.current_period_end::text as current_period_end,
      merchants.business_name as merchant_name
    from public.billing_customers
    join public.merchants
      on merchants.id = billing_customers.merchant_id
    where billing_customers.id = ${fixtureId}::uuid
    limit 1`
  const previous = rows.at(0)
  if (!previous) return undefined

  const runId = randomUUID().replaceAll("-", "").slice(0, 8)
  const stripeCustomerId = `cus_admin_redaction_${runId}_123456`
  const stripeSubscriptionId = `sub_admin_redaction_${runId}_789012`

  await sql`
    update public.billing_customers
    set stripe_customer_id = ${stripeCustomerId},
        stripe_subscription_id = ${stripeSubscriptionId},
        status = 'past_due',
        current_period_end = now() + interval '7 days'
    where id = ${previous.id}::uuid`

  return {
    previous,
    stripeCustomerId,
    stripeSubscriptionId,
    maskedCustomerRef: "cus_...123456",
    maskedSubscriptionRef: "sub_...789012",
  }
}

async function restoreBillingRedactionFixture(
  sql: Sql,
  fixture: BillingRedactionFixture
): Promise<void> {
  await sql`
    update public.billing_customers
    set stripe_customer_id = ${fixture.previous.stripe_customer_id},
        stripe_subscription_id = ${fixture.previous.stripe_subscription_id},
        status = ${fixture.previous.status},
        current_period_end = ${fixture.previous.current_period_end}::timestamptz
    where id = ${fixture.previous.id}::uuid`
}

export function describeAdminBillingRedaction(): void {
  test.describe("@admin-live-db admin billing redaction", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("seeded admin sees masked Stripe references and formatted billing status", async ({
      page,
    }, testInfo) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      try {
        const fixture = await prepareBillingRedactionFixture(sql, testInfo)
        test.skip(!fixture, "seed billing row is not available")
        if (!fixture) return

        try {
          const visibleText = (text: string) =>
            page.getByText(text).filter({ visible: true }).first()

          await signInAsSeededAdmin(page)
          await expect(visibleText(fixture.previous.merchant_name)).toBeVisible()
          await expect(visibleText(fixture.maskedSubscriptionRef)).toBeVisible()
          await expect(visibleText(fixture.maskedCustomerRef)).toBeVisible()
          await expect(visibleText("Past due")).toBeVisible()

          const html = await page.content()
          expect(html).not.toContain(fixture.stripeSubscriptionId)
          expect(html).not.toContain(fixture.stripeCustomerId)
        } finally {
          await restoreBillingRedactionFixture(sql, fixture)
        }
      } finally {
        await sql.end({ timeout: 5 })
      }
    })
  })
}
