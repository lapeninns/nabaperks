import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * DB-free harness lanes owed by earlier QA fixes (38c42a1..2c45031) and the
 * guest journey redesign. The live behaviour is proven elsewhere: the stamp
 * screen in customer-stamp-email-prompt-live-db.spec.ts and the other-venue
 * scan refusal in tests/db/reward-scan-other-venue-bug-045.test.mjs. These
 * lanes pin the screens themselves so they can be reviewed and captured
 * without a database.
 */
test.describe("QA follow-up harness lanes", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("stamp screen: once the stamp lands the result stands alone, with no contact prompt", async ({
    page,
  }) => {
    await page.goto("/dev/home-harness/stamp?mode=success&delay=40")
    const root = page.locator("[data-stamp-phase]")

    await expect(
      page.getByRole("heading", { level: 1, name: "Today's stamp" })
    ).toBeVisible()
    await root.getByRole("button", { name: "Stamp my card" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(
      page.getByRole("heading", { level: 1, name: "Stamp added." })
    ).toBeVisible()
    await expect(
      page.getByText("1 more to your reward.", { exact: true })
    ).toBeVisible()
    await expect(root.locator("[data-stamp-receipt]")).toHaveText("4 OF 5")
    await expect(
      page.getByText("Next stamp from Fri 17 Jul, 06:00.")
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "View my card" })).toBeVisible()
    await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    await expect(page.getByText(/Added without a location check/)).toHaveCount(
      0
    )
  })

  test("stamp screen: an unknown next-stamp time falls back to the next visit", async ({
    page,
  }) => {
    await page.goto("/dev/home-harness/stamp?mode=success-next-visit&delay=40")
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Stamp my card" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(
      page.getByText("You can get your next stamp on your next visit.")
    ).toBeVisible()
  })

  test("stamp screen: already stamped names the next stamp time", async ({
    page,
  }) => {
    await page.goto("/dev/home-harness/stamp?mode=closed")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "You've already got today's stamp",
      })
    ).toBeVisible()
    await expect(
      page.getByText("Next stamp from Fri 17 Jul, 06:00.")
    ).toBeVisible()
    await expect(page.getByText(/trading day|daily reset/)).toHaveCount(0)

    await page.goto("/dev/home-harness/stamp?mode=closed-next-visit")
    await expect(page.getByText("Come back on your next visit.")).toBeVisible()
  })

  test("reward scan: another venue's code shows only the not-matched banner (BUG-045)", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.rewardScan}?state=unauthorized`)

    await expect(
      page.getByRole("heading", { level: 1, name: "Check and collect reward" })
    ).toBeVisible()
    await expect(page.getByText("Reward not matched")).toBeVisible()
    await expect(
      page.getByText("This reward belongs to another venue.")
    ).toBeVisible()
    // Nothing collectable or identifying is shown for another venue's reward.
    await expect(page.getByText("Ready to collect")).toHaveCount(0)
    await expect(page.getByText("Phone ending 421")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /collect/i })).toHaveCount(0)
  })
})
