import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const LAUNCH_HARNESS = "/dev/app-harness/launch"

test.describe("@merchant-flow reward policy controls", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const width of [375, 768, 1280]) {
    test(`keeps merchant policy controls usable without horizontal scroll at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })

      await page.goto(`${LAUNCH_HARNESS}?tab=venue`)
      await expect(page.getByLabel("Venue day rolls over at")).toHaveValue(
        "05:00"
      )

      await page.goto(`${LAUNCH_HARNESS}?tab=card`)
      await expect(page.getByLabel("Minimum spend (optional)")).toBeVisible()
      await expect(
        page.getByRole("checkbox", { name: "One transaction per stamp" })
      ).toBeChecked()

      await page.goto(`${LAUNCH_HARNESS}?tab=rewards&pool=ready`)
      await expect(
        page.getByRole("heading", { name: "Collection windows" })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Venue closures" })
      ).toBeVisible()
      await expect(page.getByText("Emergency kitchen repair")).toBeVisible()
      await expect(page.getByLabel("Tuesday window enabled")).toBeChecked()
      await expect(page.locator("html")).toHaveJSProperty(
        "scrollWidth",
        await page.locator("html").evaluate((element) => element.clientWidth)
      )
    })

    test(`keeps customer phone preferences usable without horizontal scroll at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/dev/home-harness/profile")

      // Reminders by phone sit inside "Messages from venues" on the profile.
      await expect(
        page.getByRole("heading", { name: "Reminders by phone" })
      ).toBeVisible()
      await expect(page.getByText("Reminders: On")).toBeVisible()
      await expect(page.getByLabel("Send them by")).toHaveValue("whatsapp")
      await expect(
        page.getByText("WhatsApp isn't reaching your number just now.")
      ).toBeVisible()
      await expect(page.locator("html")).toHaveJSProperty(
        "scrollWidth",
        await page.locator("html").evaluate((element) => element.clientWidth)
      )
    })
  }

  test("applies the quiet lunch preset and allows a second window", async ({
    page,
  }) => {
    await page.goto(`${LAUNCH_HARNESS}?tab=rewards&pool=ready`)

    await page
      .getByRole("button", { name: "Quiet lunch · Mon–Thu 12:00–15:00" })
      .click()
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday"]) {
      await expect(page.getByLabel(`${day} window enabled`)).toBeChecked()
    }
    await expect(page.getByLabel("Friday window enabled")).not.toBeChecked()

    await page
      .getByRole("button", { name: "Add another Monday window" })
      .click()
    await expect(page.getByLabel("Monday window enabled")).toHaveCount(2)
  })
})
