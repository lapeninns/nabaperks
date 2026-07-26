import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  databaseIsReady,
  pickSeedMembership,
} from "./helpers/admin-live-db"
import { installSeededAdminAal2Session } from "./helpers/admin-mfa-session"
import { dismissPwaInstall } from "./helpers/harness"

/**
 * db privacy lifecycle — the admin subject-access export journey.
 *
 * A GDPR Article 15 export must actually hand the admin the customer's data.
 * A seeded AAL2 admin submits an `export` data request and the console renders
 * a download control for the customer-data export JSON. Gated behind
 * ADMIN_LIVE_DB_E2E=1 with local Supabase, like the other @admin-live-db proofs.
 */

test.describe("@admin-live-db admin subject-access export", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("export request renders a downloadable customer-data export", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const notes = `E2E export ${randomUUID()}`
    try {
      const ready = await databaseIsReady(sql)
      test.skip(!ready, "local Supabase DB is not migrated for admin actions")

      const membership = await pickSeedMembership(sql)
      test.skip(!membership, "seed customer membership is not available")
      if (!membership) return

      const cleanupAdminMfa = await installSeededAdminAal2Session(
        page.context()
      )
      try {
        await page.goto("/admin/privacy", { waitUntil: "domcontentloaded" })
        await expect(
          page.getByRole("heading", { name: "Data request workflow" })
        ).toBeVisible({ timeout: 30_000 })

        // The record's forms sit behind a collapsed disclosure — open it.
        await page
          .locator(
            `details:has(input[name="customerId"][value="${membership.customer_id}"])`
          )
          .filter({ visible: true })
          .first()
          .locator("summary")
          .first()
          .click()

        const dataRequestForm = page
          .locator(
            `form:has(input[name="customerId"][value="${membership.customer_id}"]):has(select[name="requestType"])`
          )
          .filter({ visible: true })
        await expect(dataRequestForm).toHaveCount(1)
        await dataRequestForm.getByLabel("Request type").selectOption("export")
        await dataRequestForm.getByLabel("Channel").selectOption("email")
        await dataRequestForm.getByLabel("Notes").fill(notes)
        await dataRequestForm
          .getByRole("button", { name: "Log request" })
          .click()

        const download = page.getByRole("link", {
          name: "Download customer data export",
        })
        await expect(download).toBeVisible({ timeout: 30_000 })
        await expect(download).toHaveAttribute(
          "download",
          /customer-data-export-.*\.json/
        )
        await expect(download).toHaveAttribute(
          "href",
          /^data:application\/json/
        )
        const href = await download.getAttribute("href")
        const encodedPayload = href?.split(",", 2).at(1)
        expect(encodedPayload).toBeTruthy()
        const exportPayload = JSON.parse(
          decodeURIComponent(encodedPayload ?? "")
        ) as { loyalty_invitations?: unknown }
        expect(Array.isArray(exportPayload.loyalty_invitations)).toBe(true)
      } finally {
        await cleanupAdminMfa()
      }
    } finally {
      await sql`
        delete from public.audit_logs
        where action = 'customer_data_exported'
          and metadata ->> 'notes' = ${notes}`
      await sql.end({ timeout: 5 })
    }
  })
})
