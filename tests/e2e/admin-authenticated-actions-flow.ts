import { expect, type Page, test } from "@playwright/test"

import {
  type AdminBrowserFixture,
  type Sql,
  adminLiveDbSkipReason,
  auditCountByNotes,
  auditCountByReason,
  cleanupAdminRows,
  connectLocalDb,
  consentCountByReason,
  createAdminBrowserFixture,
  databaseIsReady,
  fraudFlagStatus,
  insertFraudFlag,
  pickSeedMembership,
} from "./helpers/admin-live-db"
import { installSeededAdminAal2Session } from "./helpers/admin-mfa-session"
import { dismissPwaInstall } from "./helpers/harness"

const LIVE_ADMIN_CONTENT_TIMEOUT_MS = 30_000

async function openFraudAsSeededAdmin(page: Page): Promise<void> {
  await page.goto("/admin/fraud", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { exact: true, name: "Fraud" })
  ).toBeVisible({ timeout: LIVE_ADMIN_CONTENT_TIMEOUT_MS })
  expect(new URL(page.url()).pathname).toBe("/admin/fraud")
}

async function resolveFraudFlagThroughUi(
  page: Page,
  fixture: AdminBrowserFixture
): Promise<void> {
  const dismissForm = page
    .locator(
      `form:has(input[name="fraudFlagId"][value="${fixture.flagId}"]):has(input[name="status"][value="dismissed"])`
    )
    .filter({ visible: true })

  await expect(dismissForm).toHaveCount(1)
  await dismissForm.getByLabel("Reason").fill(fixture.fraudReviewReason)
  await dismissForm.getByRole("button", { name: "Dismiss" }).click()
  await expect(
    page.getByText("Flag dismissed. Logged to the audit trail.", {
      exact: true,
    })
  ).toBeVisible()
  await page.waitForLoadState("load")
}

function isFraudRefreshInterruption(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("interrupted by another navigation") &&
    error.message.includes("/admin/privacy") &&
    error.message.includes("/admin/fraud")
  )
}

async function openPrivacyAfterFraudAction(page: Page): Promise<void> {
  try {
    await page.goto("/admin/privacy", { waitUntil: "domcontentloaded" })
  } catch (error) {
    if (!isFraudRefreshInterruption(error)) {
      throw error
    }

    await page.waitForURL((url) => url.pathname === "/admin/fraud", {
      waitUntil: "load",
    })
    await page.goto("/admin/privacy", { waitUntil: "domcontentloaded" })
  }
}

async function recordPrivacyActionsThroughUi(
  page: Page,
  fixture: AdminBrowserFixture,
  sql: Sql
): Promise<void> {
  await openPrivacyAfterFraudAction(page)
  await expect(
    page.getByRole("heading", { name: "Privacy support" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Data request workflow" })
  ).toBeVisible()

  const optOutForm = page
    .locator(
      `form:has(input[name="customerId"][value="${fixture.membership.customer_id}"]):has(input[name="policyVersion"])`
    )
    .filter({ visible: true })
  await expect(optOutForm).toHaveCount(1)
  await optOutForm.getByLabel("Channel").selectOption("email")
  await optOutForm.getByLabel("Reason").fill(fixture.optOutReason)
  await optOutForm.getByRole("button", { name: "Record opt-out" }).click()
  await expect
    .poll(async () => consentCountByReason(sql, fixture.optOutReason), {
      message: "privacy opt-out browser action writes consent evidence",
    })
    .toBe(1)
  await expect
    .poll(
      async () =>
        auditCountByReason(
          sql,
          "consent_opt_out_recorded",
          fixture.optOutReason
        ),
      { message: "privacy opt-out browser action writes an audit log" }
    )
    .toBe(1)
  await expect(
    page.getByRole("heading", { name: "Data request workflow" })
  ).toBeVisible()

  const dataRequestForm = page
    .locator(
      `form:has(input[name="customerId"][value="${fixture.membership.customer_id}"]):has(select[name="requestType"])`
    )
    .filter({ visible: true })
  await expect(dataRequestForm).toHaveCount(1)
  await dataRequestForm.getByLabel("Request type").selectOption("access")
  await dataRequestForm.getByLabel("Channel").selectOption("email")
  await dataRequestForm.getByLabel("Notes").fill(fixture.dataRequestNotes)
  await dataRequestForm.getByRole("button", { name: "Log request" }).click()
  await expect
    .poll(async () => auditCountByNotes(sql, fixture.dataRequestNotes), {
      message: "data request browser action writes an audit log",
    })
    .toBe(1)
}

export function describeAdminAuthenticatedActions(): void {
  test.describe("@admin-live-db authenticated admin actions", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ serviceWorkers: "block" })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("seeded admin can render admin pages and submit audited support actions", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      try {
        const ready = await databaseIsReady(sql)
        test.skip(!ready, "local Supabase DB is not migrated for admin actions")

        const membership = await pickSeedMembership(sql)
        test.skip(!membership, "seed customer membership is not available")
        if (!membership) return

        const fixture = createAdminBrowserFixture(membership)
        await insertFraudFlag(sql, fixture)

        try {
          const cleanupAdminMfa = await installSeededAdminAal2Session(
            page.context()
          )

          try {
            await openFraudAsSeededAdmin(page)
            await expect(
              page.getByRole("heading", { exact: true, name: "Fraud flags" })
            ).toBeVisible({ timeout: LIVE_ADMIN_CONTENT_TIMEOUT_MS })

            await resolveFraudFlagThroughUi(page, fixture)
            await expect
              .poll(async () => fraudFlagStatus(sql, fixture.flagId), {
                message: "fraud flag status is updated through the browser",
              })
              .toBe("dismissed")
            await expect
              .poll(
                async () =>
                  auditCountByReason(
                    sql,
                    "fraud_flag_resolved",
                    fixture.fraudReviewReason
                  ),
                { message: "fraud browser action writes an audit log" }
              )
              .toBe(1)

            await recordPrivacyActionsThroughUi(page, fixture, sql)
          } finally {
            await cleanupAdminMfa()
          }
        } finally {
          await cleanupAdminRows(sql, fixture)
        }
      } finally {
        await sql.end({ timeout: 5 })
      }
    })
  })
}
