import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

/**
 * DB-free harness lanes owed by earlier QA fixes (38c42a1..2c45031). The live
 * behaviour is proven elsewhere: the stamp-screen email ask in
 * customer-stamp-email-prompt-live-db.spec.ts (BUG-020) and the other-venue
 * scan refusal in tests/db/reward-scan-other-venue-bug-045.test.mjs. These
 * lanes pin the screens themselves so they can be reviewed and captured
 * without a database.
 */
test.describe("QA follow-up harness lanes", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("stamp screen: the add-email card appears only after the stamp lands (BUG-020)", async ({
    page,
  }) => {
    await page.goto("/dev/home-harness/stamp?mode=email-prompt&delay=40")
    const root = page.locator("[data-stamp-phase]")
    const prompt = page.getByTestId("email-prompt")

    await expect(
      root.getByRole("button", { name: "Add today's stamp" })
    ).toBeVisible()
    await expect(prompt).toHaveCount(0)

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(prompt).toBeVisible()
    await expect(
      prompt.getByRole("heading", { name: "Add your email" })
    ).toBeVisible()
    // The prompt sits inside the stamp collector, below the card.
    await expect(root.getByTestId("email-prompt")).toHaveCount(1)
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
