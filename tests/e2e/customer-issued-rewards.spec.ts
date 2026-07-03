import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * MS-rewards-issued-source-rails R-9 — DB-free wallet render.
 *
 * Proves the /dev/home-harness rewards lane mounts the real CustomerAppShell +
 * shared reward cards and that ISSUED rewards surface their source badge and
 * expiry note alongside earned rewards, with no Supabase/auth.
 */
const HOME_HARNESS_REWARDS = "/dev/home-harness/rewards"

test.describe("@customer-flow customer issued rewards wallet", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders earned + issued rewards with source badges and expiry notes", async ({
    page,
  }) => {
    await page.goto(HOME_HARNESS_REWARDS)

    await expect(
      page.getByRole("heading", { level: 1, name: "Rewards" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Show these now" })
    ).toBeVisible()

    // Issued-reward source badges (distinct from the reward names).
    await expect(page.getByText("Birthday treat").first()).toBeVisible()
    await expect(page.getByText("Sent by The Anchor").first()).toBeVisible()

    // Expiry note on an issued reward.
    await expect(page.getByText("Expires 15 Aug 2026").first()).toBeVisible()

    // Earned reward still renders its collect CTA.
    await expect(page.getByText("Open reward QR").first()).toBeVisible()

    // History still buckets expired rewards.
    await expect(
      page.getByRole("heading", { name: "Expired" })
    ).toBeVisible()
  })
})
