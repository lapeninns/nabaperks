import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * rewards issued source rails R-9 — DB-free wallet render.
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
      page.getByRole("heading", { name: "Ready to collect" })
    ).toBeVisible()
    // A reward held by setup has its own group and never offers a code.
    await expect(
      page.getByRole("heading", { name: "Needs setting up" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Get it ready" })
    ).toHaveAttribute("href", "/reward/rwd_setup")

    // Issued-reward source badges (distinct from the reward names).
    await expect(page.getByText("Birthday treat").first()).toBeVisible()
    await expect(page.getByText("Sent by The Anchor").first()).toBeVisible()

    // Expiry note on an issued reward: the collection deadline in London time.
    await expect(
      page.getByText("Expires Sat 15 Aug at 13:00").first()
    ).toBeVisible()

    // Earned reward still renders its collect CTA.
    await expect(page.getByText("Open reward").first()).toBeVisible()

    // History still buckets expired rewards.
    await expect(
      page.getByRole("heading", { name: "No longer available" })
    ).toBeVisible()
  })
})
