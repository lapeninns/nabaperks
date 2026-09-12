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

  test("poor accuracy spends no grace until explicit rapid taps persist exactly one unverified visit", async ({
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
      const [allowance] =
        await sql`select public.geofence_unverified_grace_limit()::int as remaining`
      expect(allowance.remaining).toBeGreaterThan(0)
      await dismissPwaInstall(page)
      await installRewardCustomerSession(
        sql,
        context,
        fixture.customerId,
        baseURL
      )
      // A fix at the venue is still unusable when its reported uncertainty
      // exceeds the precision ceiling. Only the browser callback is simulated.
      await page.addInitScript(
        ({ latitude, longitude }) => {
          Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: {
              getCurrentPosition(success: PositionCallback) {
                setTimeout(
                  () =>
                    success({
                      coords: { latitude, longitude, accuracy: 101 },
                    } as GeolocationPosition),
                  20
                )
              },
            },
          })
        },
        { latitude: pin.latitude, longitude: pin.longitude }
      )
      const read = async () => {
        const [row] = await sql`
          select count(*)::int as earned,
            count(*) filter (where metadata->>'geo_verification' = 'unverified')::int as unverified,
            count(*) filter (where metadata->>'geo_verification' = 'verified')::int as verified
          from public.stamp_events where membership_id = ${fixture.membershipId}::uuid and event_type = 'earned'`
        return row
      }
      await page.goto(`/card/${fixture.membershipId}/stamp?qr=${fixture.qrId}`)
      const root = page.locator("[data-stamp-phase]")
      await root
        .getByRole("button", { name: "Use my location", exact: true })
        .click()
      await expect(
        root.getByText("Location isn't accurate enough", { exact: true })
      ).toBeVisible()
      await expect(root).not.toHaveAttribute("aria-busy", "true")
      expect(await read()).toEqual({ earned: 1, unverified: 0, verified: 0 })
      const [beforeAttempts] =
        await sql`select count(*)::int as n from public.rate_limit_buckets where bucket_key = ${`selfstamp-attempt:${fixture.membershipId}`}`
      expect(beforeAttempts.n).toBe(0)
      const fallback = root.getByRole("button", {
        name: "Add without location",
        exact: true,
      })
      await root
        .getByText("Can't get location working?", { exact: true })
        .click()
      await expect(fallback).toBeVisible()
      // Two immediate activation events exercise the submission guard without
      // Playwright waiting for a second button after the first starts work.
      await fallback.evaluate((button) => {
        if (!(button instanceof HTMLButtonElement))
          throw new Error("Expected the unverified stamp button")
        button.click()
        button.click()
      })
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(root).toContainText("Added without a location check.")
      expect(await read()).toEqual({ earned: 2, unverified: 1, verified: 0 })
      const [afterAttempts] =
        await sql`select count from public.rate_limit_buckets where bucket_key = ${`selfstamp-attempt:${fixture.membershipId}`}`
      expect(afterAttempts.count).toBe(1)
      await page.reload()
      await expect(page.locator("[data-stamp-phase]")).toContainText(
        "You're stamped for today."
      )
      expect(await read()).toEqual({ earned: 2, unverified: 1, verified: 0 })
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
