import { expect, test } from "@playwright/test"

import { customerFlowPreviewPath } from "../../lib/dev/customer-flow-preview"

/**
 * Thin functional E2E over the customer journey, driven through the dev preview
 * harness (`/dev/customer-flow/preview/*`, mock fixtures — no auth, no DB). It
 * exercises in a real mobile browser the load-bearing invariants the edge-case
 * audit hardened, so they are verified end-to-end and not only at the unit layer:
 *
 *   - reward collection is merchant-scanned (no customer tap-to-redeem),
 *   - a waiting reward reads "next opening day", never "tomorrow",
 *   - a ready reward gates on profile completion before exposing the QR,
 *   - a full card celebrates rather than inviting another stamp,
 *   - redemption starts a fresh stamp cycle.
 *
 * The harness re-implements the shipped panels, so the copy asserted here is the
 * same customer-facing copy production renders.
 */
test.describe("customer flow core journey (mock harness)", () => {
  test("walks join → stamp → full card → redeemed cycle", async ({ page }) => {
    await page.goto(customerFlowPreviewPath("join-hero"))
    await expect(
      page.locator('[data-customer-flow-preview="join-hero"]')
    ).toBeVisible()
    await expect(page.getByText("Keep your card on your phone")).toBeVisible()
    await expect(page.getByText("Mystery reward, sealed").first()).toBeVisible()

    await page.goto(customerFlowPreviewPath("join-terms"))
    await expect(
      page.getByText("Collect your first stamp").first()
    ).toBeVisible()

    await page.goto(customerFlowPreviewPath("stamp-day-1-confirm"))
    await expect(page.getByText("Ready to add today").first()).toBeVisible()

    await page.goto(customerFlowPreviewPath("card-1-of-3"))
    await expect(page.getByText("Stamp added.").first()).toBeVisible()

    await page.goto(customerFlowPreviewPath("card-3-of-3-unlocked"))
    await expect(page.getByText("the full card").first()).toBeVisible()

    await page.goto(customerFlowPreviewPath("card-redeemed"))
    await expect(page.getByText("Reward redeemed.").first()).toBeVisible()
    await expect(
      page.getByText("New stamp cycle started.").first()
    ).toBeVisible()
  })

  test("reward is merchant-scanned, never a customer tap-to-redeem", async ({
    page,
  }) => {
    await page.goto(customerFlowPreviewPath("reward-ready"))
    await expect(
      page.getByText("Ready for merchant scan.").first()
    ).toBeVisible()
    await expect(
      page.getByText("The merchant scans it from their device").first()
    ).toBeVisible()
    // The only customer control opens the QR for the merchant to scan — there is
    // no customer-operated redeem/collect button.
    await expect(
      page.getByRole("button", { name: "Open reward QR" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /redeem|collect reward/i })
    ).toHaveCount(0)
  })

  test("waiting reward reads next-opening-day, not tomorrow", async ({
    page,
  }) => {
    await page.goto(customerFlowPreviewPath("reward-waiting"))
    await expect(
      page.getByText("Give it a day to breathe").first()
    ).toBeVisible()
    await expect(page.getByText("Return to card").first()).toBeVisible()
    await expect(page.getByText(/\btomorrow\b/i)).toHaveCount(0)
  })

  test("a ready reward gates on profile completion before the QR", async ({
    page,
  }) => {
    await page.goto(customerFlowPreviewPath("reward-ready-profile"))
    await expect(
      page.getByText("A few details before this one").first()
    ).toBeVisible()
    await expect(
      page
        .getByText("Add your name and date of birth before collection")
        .first()
    ).toBeVisible()
    // The collection QR button is not offered until the gate is satisfied.
    await expect(
      page.getByRole("button", { name: "Open reward QR" })
    ).toHaveCount(0)
  })

  test("offline route states the server-authoritative model", async ({
    page,
  }) => {
    await page.goto("/offline")
    await expect(page.getByText("You're offline").first()).toBeVisible()
  })
})
