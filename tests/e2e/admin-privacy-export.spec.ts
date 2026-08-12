import { createHash, randomUUID } from "node:crypto"

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
 * A seeded AAL2 admin submits an `export` data request and receives the direct
 * protected POST response without placing the disclosure in page state. Gated behind
 * ADMIN_LIVE_DB_E2E=1 with local Supabase, like the other @admin-live-db proofs.
 */

test.describe("@admin-live-db admin subject-access export", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("export request streams a no-store neutral customer-data download", async ({
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
        const [response, download] = await Promise.all([
          page.waitForResponse(
            (candidate) =>
              candidate.url().endsWith("/admin/privacy/export") &&
              candidate.request().method() === "POST"
          ),
          page.waitForEvent("download"),
          dataRequestForm
            .getByRole("button", { name: "Download export" })
            .click(),
        ])

        expect(response.status()).toBe(200)
        expect(response.headers()["cache-control"]).toContain("no-store")
        expect(response.headers()["content-disposition"]).toMatch(
          /^attachment; filename="customer-data-export-\d{4}-\d{2}-\d{2}\.json"$/
        )
        expect(download.suggestedFilename()).toMatch(
          /^customer-data-export-\d{4}-\d{2}-\d{2}\.json$/
        )
        expect(download.suggestedFilename()).not.toContain(
          membership.customer_id
        )

        const stream = await download.createReadStream()
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const bytes = Buffer.concat(chunks)
        expect(bytes.byteLength).toBeGreaterThan(0)
        expect(JSON.parse(bytes.toString("utf8"))).toBeTruthy()
        expect(createHash("sha256").update(bytes).digest("hex")).toMatch(
          /^[0-9a-f]{64}$/
        )

        await expect(page.locator('a[href^="data:"]')).toHaveCount(0)
        expect(page.url()).not.toContain(membership.customer_id)
        const storage = await page.evaluate(() => ({
          local: Object.values(localStorage),
          session: Object.values(sessionStorage),
        }))
        expect(JSON.stringify(storage)).not.toContain(membership.customer_id)

        await page.reload({ waitUntil: "domcontentloaded" })
        await expect(page.getByRole("link", { name: /download/i })).toHaveCount(
          0
        )
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
