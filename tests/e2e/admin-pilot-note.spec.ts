import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/app-harness/pilot-note"

test.describe("admin pilot note scaffold @admin-pilot-note", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the notes placeholder follows the selected note type", async ({
    page,
  }) => {
    await page.goto(HARNESS)

    const notes = page.locator('textarea[name="notes"]')
    await expect(notes).toHaveAttribute(
      "placeholder",
      /What happened, the source/
    )

    await page
      .locator('select[name="noteType"]')
      .selectOption("cancellation_reason")
    await expect(notes).toHaveAttribute("placeholder", /Why they cancelled/)

    // Scaffold is a placeholder only — the notes value stays empty.
    await expect(notes).toHaveValue("")
  })
})
