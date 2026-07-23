import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * Bulk two-stamp loyalty invitations — the merchant import form renders and is
 * keyboard / screen-reader / responsive accessible, DB-free via the harness.
 * The full import → send → OTP → terms → two-stamp journey needs a live DB and
 * is covered by tests/db/loyalty-invites.test.mjs.
 */
const INVITE = "/dev/app-harness/invite"

test.describe("@merchant-flow merchant invite customers", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders the invite form with an accessible recipients field", async ({
    page,
  }) => {
    await gotoHydratedPage(page, INVITE)
    await expect(
      page.getByRole("heading", { level: 1, name: "Invite customers" })
    ).toBeVisible()
    await expect(page.getByLabel("Email addresses")).toBeVisible()
    await expect(page.getByRole("button", { name: "Check list" })).toBeVisible()
  })

  test("the recipients field is keyboard reachable and editable", async ({
    page,
  }) => {
    await gotoHydratedPage(page, INVITE)
    const textarea = page.getByLabel("Email addresses")
    await textarea.focus()
    await expect(textarea).toBeFocused()
    await textarea.fill("alex@example.com\njordan@example.com")
    await expect(textarea).toHaveValue(/alex@example.com/)
  })

  test("renders on a mobile viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoHydratedPage(page, INVITE)
    await expect(
      page.getByRole("heading", { level: 1, name: "Invite customers" })
    ).toBeVisible()
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
    expect(noOverflow).toBe(true)
  })
})
