import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * MS-rewards-merchant-sent R-5/R-6 — the send-reward form renders (contact entry
 * and the membership-prefilled variant), DB-free.
 */
const SEND = "/dev/app-harness/send-reward"

test.describe("@merchant-flow merchant send reward", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders the send-reward form with contact entry", async ({ page }) => {
    await page.goto(SEND)
    await expect(
      page.getByRole("heading", { level: 1, name: "Send a reward" })
    ).toBeVisible()
    await expect(page.getByText("Member email or phone")).toBeVisible()
    await expect(page.getByText("Reward name")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send reward" })
    ).toBeVisible()
  })

  test("hides the contact field when a member is prefilled", async ({
    page,
  }) => {
    await page.goto(`${SEND}?member=mem_harness`)
    await expect(page.getByText(/Sending to/)).toBeVisible()
    await expect(page.getByText("Member email or phone")).toHaveCount(0)
  })

  test("a reward preset chip prefills the name and terms without sending", async ({
    page,
  }) => {
    await page.goto(SEND)

    await page.getByRole("button", { name: "Regulars' pint" }).click()

    await expect(page.getByLabel("Reward name")).toHaveValue("Regulars' pint")
    await expect(page.getByLabel("Reward terms")).toHaveValue(
      /Valid once issued\./
    )
    // Prefill only: tapping a preset must not send the reward.
    await expect(page.getByText("Reward sent.")).toHaveCount(0)
  })
})
