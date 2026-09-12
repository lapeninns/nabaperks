import { expect, test } from "@playwright/test"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import { installRewardCustomerSession } from "./helpers/reward-id-check-sessions"
import {
  cleanupVenueCodeFixture,
  createVenueCodeFixture,
} from "./helpers/venue-code-live-db"

test.describe("location recovery with the real local stamp action", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test("blocked retries spend no grace or attempts; the recovered fix persists exactly one verified visit", async ({
    page,
    context,
    baseURL,
  }) => {
    const sql = connectLocalDb()
    if (!sql || !baseURL)
      throw new Error("Local database and base URL required")
    const fixture = await createVenueCodeFixture(sql)
    if (!fixture) throw new Error("Seed venue required")
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      const [pin] =
        await sql`select latitude::float8, longitude::float8 from public.merchant_locations where id = ${fixture.locationId}::uuid`
      await dismissPwaInstall(page)
      await installRewardCustomerSession(
        sql,
        context,
        fixture.customerId,
        baseURL
      )
      // Model a browser whose first two requests are denied, then whose user
      // has allowed access. No permission is modified; only test callbacks.
      await page.addInitScript(
        ({ latitude, longitude }) => {
          let calls = 0
          Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: {
              getCurrentPosition(
                success: PositionCallback,
                failure: PositionErrorCallback
              ) {
                const denied = calls++ < 2
                setTimeout(
                  () =>
                    denied
                      ? failure({
                          code: 1,
                          PERMISSION_DENIED: 1,
                          POSITION_UNAVAILABLE: 2,
                          TIMEOUT: 3,
                          message: "denied",
                        })
                      : success({
                          coords: { latitude, longitude, accuracy: 12 },
                        } as GeolocationPosition),
                  20
                )
              },
            },
          })
        },
        { latitude: pin.latitude, longitude: pin.longitude }
      )
      await page.goto(`/card/${fixture.membershipId}/stamp?qr=${fixture.qrId}`)
      const root = page.locator("[data-stamp-phase]")
      await root
        .getByRole("button", { name: "Use my location", exact: true })
        .click()
      await expect(
        root.getByText("Location access is blocked", { exact: true })
      ).toBeVisible()
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(root).not.toHaveAttribute("aria-busy", "true")
      const read = async () => {
        const [row] = await sql`
          select count(*)::int as earned,
            count(*) filter (where metadata->>'geo_verification' = 'unverified')::int as unverified,
            count(*) filter (where metadata->>'geo_verification' = 'verified')::int as verified
          from public.stamp_events where membership_id = ${fixture.membershipId}::uuid and event_type = 'earned'`
        return row
      }
      expect(await read()).toEqual({ earned: 1, unverified: 0, verified: 0 })
      const [beforeAttempts] =
        await sql`select count(*)::int as n from public.rate_limit_buckets where bucket_key = ${`selfstamp-attempt:${fixture.membershipId}`}`
      expect(beforeAttempts.n).toBe(0)
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      expect(await read()).toEqual({ earned: 2, unverified: 0, verified: 1 })
      const [afterAttempts] =
        await sql`select count from public.rate_limit_buckets where bucket_key = ${`selfstamp-attempt:${fixture.membershipId}`}`
      expect(afterAttempts.count).toBe(1)
      await page.reload()
      await expect(page.locator("[data-stamp-phase]")).toContainText(
        "You're stamped for today."
      )
      expect(await read()).toEqual({ earned: 2, unverified: 0, verified: 1 })
      expect(errors).toEqual([])
    } finally {
      try {
        await cleanupVenueCodeFixture(sql, fixture)
        await sql`delete from public.rate_limit_buckets where bucket_key in (${`selfstamp-attempt:${fixture.membershipId}`}, ${`selfstamp:${fixture.membershipId}`})`
      } finally {
        await sql.end({ timeout: 5 })
      }
    }
  })
})
