import { expect, test } from "@playwright/test"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  installRewardCustomerSession,
  installRewardOwnerSession,
} from "./helpers/reward-id-check-sessions"
import {
  cleanupVenueCodeFixture,
  createVenueCodeFixture,
  readVenueCode,
  readVenueCodeStampState,
} from "./helpers/venue-code-live-db"

// ~90km from the seeded Girton venue — unambiguously out of range.
const FAR_FROM_VENUE = { latitude: 51.5074, longitude: -0.1278, accuracy: 10 }

/**
 * The whole fallback, live: a member scans from far away and is refused, a
 * team member reads today's code off the owner dashboard, the member types it
 * and the stamp lands through the ordinary pipeline; a reload shows it
 * persisted, and the database carries the evidence.
 */
export function registerCustomerVenueCodeLiveDbTests() {
  test.describe("customer venue-code fallback — live database", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ serviceWorkers: "block" })

    test("refused location → owner reads code → member enters it → stamp persists", async ({
      page,
      context,
      browser,
      baseURL,
    }, testInfo) => {
      const sql = connectLocalDb()
      if (!sql || !baseURL)
        throw new Error("Local browser database and base URL are required")
      const fixture = await createVenueCodeFixture(sql)
      if (!fixture) throw new Error("Seed venue fixture is required")
      const ownerContext = await browser.newContext({
        baseURL,
        viewport: page.viewportSize() ?? undefined,
        isMobile: testInfo.project.use.isMobile,
        hasTouch: testInfo.project.use.hasTouch,
        deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
        userAgent: testInfo.project.use.userAgent,
        reducedMotion: "reduce",
      })
      const owner = await ownerContext.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      owner.on("pageerror", (error) => errors.push(error.message))

      try {
        await dismissPwaInstall(page)
        await dismissPwaInstall(owner)
        await installRewardCustomerSession(
          sql,
          context,
          fixture.customerId,
          baseURL
        )
        await context.grantPermissions(["geolocation"], { origin: baseURL })
        await context.setGeolocation(FAR_FROM_VENUE)

        // 1. The member scans from far away. This visit must confirm location,
        //    so the screen offers "Use my location" and the code side by side;
        //    the location check refuses the far fix.
        await page.goto(
          `/card/${fixture.membershipId}/stamp?qr=${fixture.qrId}`
        )
        const root = page.locator("[data-stamp-phase]")
        await expect(
          root.getByRole("button", { name: "Enter venue code" })
        ).toBeVisible()
        await root.getByRole("button", { name: "Use my location" }).click()
        await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
        await expect(root.locator("[data-stamp-status-band]")).toContainText(
          "ask a team member for today's code"
        )
        const form = root.locator("[data-venue-code-form]")
        await expect(form).toBeVisible()

        // 2. The owner reads today's code off the dashboard.
        await installRewardOwnerSession(sql, ownerContext, baseURL)
        await owner.goto("/app")
        const codeLine = owner.locator("[data-venue-code]")
        await expect(codeLine).toHaveAttribute("data-venue-code", "hidden")
        await owner.getByRole("button", { name: "Show code" }).click()
        await expect(codeLine).toHaveAttribute("data-venue-code", "shown")
        const shownCode = (await codeLine.textContent())?.trim() ?? ""
        expect(shownCode).toMatch(/^[0-9]{6}$/)
        expect(shownCode).toBe(await readVenueCode(sql, fixture))

        // 3. A wrong code is refused and counted; the right one prints the stamp.
        const input = form.getByLabel("Today's code from a team member")
        await input.fill(
          String((Number(shownCode) + 1) % 1000000).padStart(6, "0")
        )
        await form.getByRole("button", { name: "Add my stamp" }).click()
        await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
        await expect(root.locator("[data-venue-code-form]")).toContainText(
          "4 tries left"
        )

        await root.getByLabel("Today's code from a team member").fill(shownCode)
        await root.getByRole("button", { name: "Add my stamp" }).click()
        await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
        await expect(
          root.getByText(`Stamp 2 of ${fixture.stampsRequired} added.`)
        ).toBeVisible()

        // 4. The persisted outcome survives a reload, and the evidence is durable.
        await page.reload()
        await expect(page.locator("[data-stamp-phase]")).toContainText(
          "You're stamped for today."
        )
        const state = await readVenueCodeStampState(sql, fixture)
        expect(state.earned).toBe(2)
        expect(state.venueCodeStamps).toBe(1)
        expect(state.linkedReceipts).toBe(1)
        expect(state.reviewedRefusals).toBe(1)
        expect(errors).toEqual([])
      } finally {
        await ownerContext.close()
        await cleanupVenueCodeFixture(sql, fixture)
        await sql.end({ timeout: 5 })
      }
    })
  })
}
