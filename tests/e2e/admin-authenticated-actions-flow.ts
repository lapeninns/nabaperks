import { expect, type Page, test } from "@playwright/test"

import {
  type AdminBrowserFixture,
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
import { dismissPwaInstall } from "./helpers/harness"

const ADMIN_EMAIL = "admin@nabaperks.test"
const ADMIN_PASSWORD = "NabaperksDemo1!"

async function signInAsSeededAdmin(page: Page): Promise<void> {
  await page.goto("/login?next=/admin/fraud")
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(ADMIN_EMAIL)
  await page.locator("#password").fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()

  await expect(
    page.getByRole("heading", { exact: true, name: "Fraud" })
  ).toBeVisible()
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
}

async function recordPrivacyActionsThroughUi(
  page: Page,
  fixture: AdminBrowserFixture
): Promise<void> {
  await page.goto("/admin/privacy")
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
}

export function describeAdminAuthenticatedActions(): void {
  test.describe("@admin-live-db authenticated admin actions", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

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
          await signInAsSeededAdmin(page)
          await expect(
            page.getByRole("heading", { exact: true, name: "Fraud flags" })
          ).toBeVisible()

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

          await recordPrivacyActionsThroughUi(page, fixture)
          await expect
            .poll(
              async () =>
                consentCountByReason(sql, fixture.optOutReason),
              { message: "privacy opt-out browser action writes consent evidence" }
            )
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
          await expect
            .poll(async () => auditCountByNotes(sql, fixture.dataRequestNotes), {
              message: "data request browser action writes an audit log",
            })
            .toBe(1)
        } finally {
          await cleanupAdminRows(sql, fixture)
        }
      } finally {
        await sql.end({ timeout: 5 })
      }
    })
  })
}
