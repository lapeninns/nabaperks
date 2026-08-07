import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * merchant soft geofence knob — the per-location trigger-stamp control
 * renders on the real venue form (DB-free harness tier, same pattern as the
 * birthday-config proof). Persistence and stamping behavior are proven in
 * tests/db/soft-geofence-knob.test.mjs.
 */
const LAUNCH_VENUE = "/dev/app-harness/launch?tab=venue"

test.describe("@soft-geofence merchant soft-geofence trigger", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the trigger-stamp control renders inside Advanced GPS checks with the 3 default", async ({
    page,
  }) => {
    await page.goto(LAUNCH_VENUE)

    // The disclosure is a <details>/<summary>, which WebKit does not expose
    // with a button role — target the summary text directly.
    await page.getByText("Advanced GPS checks", { exact: true }).click()

    const trigger = page.getByLabel("Verify from visit number")
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveValue("3")

    await trigger.fill("7")
    await expect(trigger).toHaveValue("7")
    // 20260805100100 made this a lifetime visit number that REQUIRES a verified
    // location, not a per-cycle advisory check, so the hint says so.
    await expect(
      page.getByText(
        "The visit from which a member must be at the venue to collect."
      )
    ).toBeVisible()
  })
})
