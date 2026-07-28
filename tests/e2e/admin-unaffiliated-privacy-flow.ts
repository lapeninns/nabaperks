import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  databaseIsReady,
  type Sql,
} from "./helpers/admin-live-db"
import { installSeededAdminAal2Session } from "./helpers/admin-mfa-session"
import { dismissPwaInstall } from "./helpers/harness"

type UnaffiliatedFixture = {
  readonly customerId: string
  readonly email: string
  readonly marker: string
}

export function describeAdminUnaffiliatedPrivacy(): void {
  test.describe("@admin-live-db unaffiliated customer privacy workflow", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ serviceWorkers: "block" })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("exports an unaffiliated customer's account data", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const fixture = await seedUnaffiliatedCustomer(sql, "export")
      try {
        await assertDatabaseReady(sql)
        const cleanupAdminMfa = await installSeededAdminAal2Session(
          page.context()
        )
        try {
          const details = await openUnaffiliatedActions(page, fixture)
          const form = details
            .locator("form:has(select[name='requestType'])")
            .filter({ visible: true })
          await expect(form).toHaveCount(1)

          await form.getByLabel("Request type").selectOption("export")
          await form.getByLabel("Channel").selectOption("email")
          await form.getByLabel("Notes").fill(fixture.marker)
          await form
            .getByRole("button", { name: "Process account request" })
            .click()

          const download = page.getByRole("link", {
            name: "Download customer data export",
          })
          await expect(download).toBeVisible({ timeout: 30_000 })
          const href = await download.getAttribute("href")
          const encodedPayload = href?.split(",", 2).at(1)
          expect(encodedPayload).toBeTruthy()

          const payload = JSON.parse(
            decodeURIComponent(encodedPayload ?? "")
          ) as {
            customer?: { id?: string }
            loyalty_invitations?: unknown
            memberships?: unknown
          }
          expect(payload.customer?.id).toBe(fixture.customerId)
          expect(payload.memberships).toEqual([])
          expect(Array.isArray(payload.loyalty_invitations)).toBe(true)

          await expect
            .poll(() =>
              auditCount(sql, fixture.marker, "customer_data_exported")
            )
            .toBe(1)
        } finally {
          await cleanupAdminMfa()
        }
      } finally {
        await cleanupUnaffiliatedCustomer(sql, fixture)
      }
    })

    test("records an account-wide consent opt-out", async ({ page }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const fixture = await seedUnaffiliatedCustomer(sql, "consent")
      try {
        await assertDatabaseReady(sql)
        await sql`
        insert into public.notification_preferences (
          customer_id,
          marketing_enabled
        )
        values (${fixture.customerId}::uuid, true)`

        const cleanupAdminMfa = await installSeededAdminAal2Session(
          page.context()
        )
        try {
          const details = await openUnaffiliatedActions(page, fixture)
          const form = details
            .locator(
              "form:has(input[name='source']):has(input[name='privacyScope'][value='unaffiliated'])"
            )
            .filter({ visible: true })
          await expect(form).toHaveCount(1)

          await form.getByLabel("Channel").selectOption("push")
          await form.getByLabel("Reason").fill(fixture.marker)
          await form
            .getByRole("button", { name: "Record account-wide opt-out" })
            .click()

          await expect(
            form.getByText(
              "Account-wide opt-out recorded. Logged to the audit trail.",
              { exact: true }
            )
          ).toBeVisible({ timeout: 30_000 })

          await expect.poll(() => accountWideConsentCount(sql, fixture)).toBe(1)
          const [preferences] = await sql<
            readonly { readonly marketing_enabled: boolean }[]
          >`
          select marketing_enabled
          from public.notification_preferences
          where customer_id = ${fixture.customerId}::uuid`
          expect(preferences?.marketing_enabled).toBe(false)
        } finally {
          await cleanupAdminMfa()
        }
      } finally {
        await cleanupUnaffiliatedCustomer(sql, fixture)
      }
    })

    test("erases an unaffiliated customer's live identity", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const fixture = await seedUnaffiliatedCustomer(sql, "deletion")
      try {
        await assertDatabaseReady(sql)
        const cleanupAdminMfa = await installSeededAdminAal2Session(
          page.context()
        )
        try {
          const details = await openUnaffiliatedActions(page, fixture)
          const form = details
            .locator("form:has(select[name='requestType'])")
            .filter({ visible: true })
          await expect(form).toHaveCount(1)

          await form.getByLabel("Request type").selectOption("deletion")
          await form.getByLabel("Channel").selectOption("email")
          await form.getByLabel("Notes").fill(fixture.marker)
          await form
            .getByRole("button", { name: "Process account request" })
            .click()

          await expect
            .poll(() => customerEmail(sql, fixture.customerId), {
              timeout: 30_000,
            })
            .toMatch(/^erased\+[0-9a-f]+@privacy\.invalid$/i)
          await expect(details).toHaveCount(0)
          await expect
            .poll(() => auditCount(sql, fixture.marker, "customer_pii_erased"))
            .toBe(1)
        } finally {
          await cleanupAdminMfa()
        }
      } finally {
        await cleanupUnaffiliatedCustomer(sql, fixture)
      }
    })
  })
}

async function assertDatabaseReady(sql: Sql) {
  expect(await databaseIsReady(sql)).toBe(true)
}

async function seedUnaffiliatedCustomer(
  sql: Sql,
  purpose: string
): Promise<UnaffiliatedFixture> {
  const customerId = randomUUID()
  const marker = `E2E ${purpose} ${randomUUID()}`
  const email = `unaffiliated-${purpose}-${randomUUID()}@test.local`

  await sql`
    insert into public.customers (
      id,
      email,
      email_verified_at,
      full_name,
      phone_last4,
      created_at,
      updated_at
    )
    values (
      ${customerId}::uuid,
      ${email},
      now(),
      'Unaffiliated browser fixture',
      '0520',
      now(),
      now()
    )`

  return { customerId, email, marker }
}

async function openUnaffiliatedActions(
  page: Page,
  fixture: UnaffiliatedFixture
) {
  await page.goto(
    `/admin/privacy?contact=${encodeURIComponent(fixture.email)}`,
    { waitUntil: "domcontentloaded" }
  )
  await expect(
    page.getByRole("heading", {
      name: "Verified customers without a membership",
    })
  ).toBeVisible({ timeout: 30_000 })

  const details = page
    .locator(
      `details:has(input[name="customerId"][value="${fixture.customerId}"]):has(input[name="privacyScope"][value="unaffiliated"])`
    )
    .filter({ visible: true })
  await expect(details).toHaveCount(1)
  await details.locator("summary").click()
  await expect(
    details.getByRole("button", { name: "Process account request" })
  ).toBeVisible()
  return details
}

async function cleanupUnaffiliatedCustomer(
  sql: Sql,
  fixture: UnaffiliatedFixture
) {
  try {
    await sql`
      delete from public.audit_logs
      where metadata ->> 'notes' = ${fixture.marker}
         or metadata ->> 'reason' = ${fixture.marker}`
    await sql`
      delete from public.consent_records
      where metadata ->> 'reason' = ${fixture.marker}`
    await sql`
      delete from public.customers
      where id = ${fixture.customerId}::uuid`
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function auditCount(
  sql: Sql,
  marker: string,
  action: string
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.audit_logs
    where action = ${action}
      and metadata ->> 'notes' = ${marker}`
  return row?.count ?? 0
}

async function accountWideConsentCount(
  sql: Sql,
  fixture: UnaffiliatedFixture
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.consent_records
    where customer_id = ${fixture.customerId}::uuid
      and merchant_id is null
      and consent_status = 'opted_out'
      and metadata ->> 'reason' = ${fixture.marker}`
  return row?.count ?? 0
}

async function customerEmail(sql: Sql, customerId: string): Promise<string> {
  const [row] = await sql<readonly { readonly email: string }[]>`
    select email
    from public.customers
    where id = ${customerId}::uuid`
  return row?.email ?? "missing"
}
