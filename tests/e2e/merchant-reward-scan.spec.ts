import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"
import {
  cleanupRewardCollectionFixture,
  createRewardCollectionFixture,
  readRewardCollectionState,
  type RewardCollectionFixture,
} from "./helpers/reward-collection-live-db"

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

async function signInAsSeededMerchant(
  page: Page,
  next: string,
  rateLimitNonce: string
): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": localLoopbackIp(rateLimitNonce),
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"))
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}

/**
 * MS-merchant-scan-pos — DB-free harness tier.
 *
 * Proves the reward-collection surface renders its two states (ready vs
 * collected) and shows only a masked member label (MS-7), against the real
 * ScanShell + RewardTicket + collection form mounted on the DB-free
 * /dev/app-harness/reward-scan lane. The live single-use consumption invariant
 * (MS-2/MS-3) is proven separately in tests/db/reward-scan-single-use.test.mjs.
 */
test.describe("merchant reward scan — collection surface", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("ready state shows the reward + a collect affordance + masked member", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.rewardScan)

    await expect(
      page.getByRole("heading", { level: 1, name: "Check and collect reward" })
    ).toBeVisible()
    await expect(page.getByText("Free hot drink")).toBeVisible()
    await expect(page.getByText("Ready to collect")).toBeVisible()

    // MS-7: only a masked member label is shown — never a raw phone number.
    await expect(page.getByText("Phone ending 421")).toBeVisible()
    await expect(page.getByText(/\+?\d{7,}/)).toHaveCount(0)
  })

  test("collected state shows the closed/redeemed banner", async ({ page }) => {
    await page.goto(`${HARNESS_ROUTES.rewardScan}?collected=1`)
    const collectedBanner = page
      .getByRole("alert")
      .filter({ hasText: "Reward collected" })

    await expect(
      page.getByRole("heading", { level: 1, name: "Check and collect reward" })
    ).toBeVisible()
    await expect(collectedBanner).toBeVisible()
    // The pre-collection "Ready to collect" affordance is gone once collected.
    await expect(page.getByText("Ready to collect")).toHaveCount(0)
  })

  test.describe("@admin-live-db merchant collection route", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("seeded merchant collects a minted reward scan token through /r", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: RewardCollectionFixture | undefined

      try {
        fixture = await createRewardCollectionFixture(sql)
        test.skip(!fixture, "reward collection fixture is not available")
        if (!fixture) return

        await signInAsSeededMerchant(
          page,
          `/r/${fixture.scanToken}`,
          fixture.scanToken
        )
        const collectedBanner = page
          .getByRole("alert")
          .filter({ hasText: "Reward collected" })

        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Check and collect reward",
          })
        ).toBeVisible()
        await expect(page.getByText(fixture.rewardName)).toBeVisible()
        await expect(page.getByText("Ready to collect")).toBeVisible()
        await expect(collectedBanner).toHaveCount(0)

        await page.getByRole("button", { name: "Mark reward collected" }).click()

        await expect(page).toHaveURL((url) => {
          return (
            url.pathname === `/app/rewards/scan/${fixture?.scanToken}` &&
            url.searchParams.get("collected") === "1"
          )
        })
        await expect(collectedBanner).toBeVisible()
        await expect(collectedBanner).toContainText("Reward marked collected.")
        await expect(page.getByText("Ready to collect")).toHaveCount(0)

        const afterCollect = await readRewardCollectionState(
          sql,
          fixture.rewardEventId
        )

        expect(afterCollect?.reward_status).toBe("redeemed")
        expect(afterCollect?.consumed).toBe(true)
        expect(afterCollect?.next_cycle_count).toBe(0)

        await page.goto(`/app/rewards/scan/${fixture.scanToken}`)
        await expect(collectedBanner).toBeVisible()
        await expect(collectedBanner).not.toContainText(
          "Reward marked collected."
        )
      } finally {
        await cleanupRewardCollectionFixture(sql, fixture)
        await sql.end()
      }
    })
  })
})
