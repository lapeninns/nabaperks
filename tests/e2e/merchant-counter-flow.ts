import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/**
 * Counter screen (handoff §6.1, §6.6, §7.2) on the DB-free harness lane.
 *
 * Present mode open / close / Escape / focus return, the team code reveal,
 * reset confirm and cancel (success, failure, in flight), the paused QR not
 * being tappable, the missing-QR note, the QR error fallback, and the
 * pinned scanner staying in the viewport at the compact phone size.
 */

const qrButton = (page: Page) =>
  page.getByRole("button", { name: /^QR code for .*Tap to present/ })
const codeToggle = (page: Page) =>
  page.getByRole("button", { name: /^Today's code/ })
const codeLine = (page: Page) => page.locator("[data-venue-code]")
const resetSheet = (page: Page) => page.locator("[data-reset-code-sheet]")

export function describeMerchantCounter() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("present mode opens from the card, closes on Done and Escape, and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    const card = qrButton(page)
    await card.click()
    const dialog = page.getByRole("dialog", { name: /Scan to join/ })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("aria-modal", "true")
    await expect(dialog.getByText("Your first stamp is waiting.")).toBeVisible()
    await expect(dialog.getByText("One stamp per business day")).toBeVisible()
    await expect(
      dialog.getByRole("img", { name: /^QR code for/ })
    ).toBeVisible()

    await dialog.getByRole("button", { name: "Done" }).click()
    await expect(dialog).toBeHidden()
    await expect(card).toBeFocused()

    await card.press("Enter")
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(card).toBeFocused()
  })

  test("the team code reveals and hides behind one disclosure", async ({
    page,
  }) => {
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    const toggle = codeToggle(page)
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "hidden")
    await expect(page.getByText("Changes at 5am, in 16 hours")).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "shown")
    await expect(codeLine(page)).toHaveText("482913")

    await toggle.click()
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "hidden")
  })

  test("resetting the code: cancel keeps it, confirm reveals the new one with a stamp", async ({
    page,
  }) => {
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    const open = page.getByRole("button", { name: "Reset the code" })
    await open.click()
    const sheet = resetSheet(page)
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole("heading", { name: "Reset today's code?" })
    ).toBeVisible()
    await sheet.getByRole("button", { name: "Keep the current code" }).click()
    await expect(sheet).toBeHidden()
    await expect(open).toBeFocused()
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "hidden")

    await open.click()
    await resetSheet(page)
      .getByRole("button", { name: "Reset the code now" })
      .click()
    await expect(resetSheet(page)).toBeHidden()
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "shown")
    await expect(codeLine(page)).toHaveText("730264")
    await expect(page.locator("[data-team-code-reset-stamp]")).toContainText(
      /Reset \d{2}:\d{2}/
    )
    await expect(page.getByText("Code reset", { exact: true })).toBeVisible()
  })

  test("a refused reset keeps the sheet open with the server reason", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?reset=fail`)

    await page.getByRole("button", { name: "Reset the code" }).click()
    const sheet = resetSheet(page)
    await sheet.getByRole("button", { name: "Reset the code now" }).click()
    await expect(sheet.getByRole("alert")).toContainText(
      "The code was reset recently"
    )
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole("button", { name: "Reset the code now" })
    ).toBeEnabled()
    await expect(codeLine(page)).toHaveAttribute("data-venue-code", "hidden")
  })

  test("a reset in flight disables the confirm and pins the sheet open", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?reset=slow`)

    await page.getByRole("button", { name: "Reset the code" }).click()
    const sheet = resetSheet(page)
    const confirm = sheet.getByRole("button", { name: /Reset/ })
    await confirm.click()
    await expect(
      sheet.getByRole("button", { name: /Resetting/ })
    ).toBeDisabled()
    await expect(
      sheet.getByRole("button", { name: "Keep the current code" })
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(sheet).toBeVisible()
  })

  test("paused, missing and failed QR states never present", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?qr=paused`)
    await expect(page.locator('[data-counter-qr="paused"]')).toBeVisible()
    await expect(page.getByText("Paused", { exact: true })).toBeVisible()
    await expect(qrButton(page)).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Resume under Poster & print" })
    ).toHaveAttribute("href", "/app/qr")

    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?qr=missing`)
    await expect(
      page.getByRole("heading", { name: "Your venue QR is not ready yet" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Open the QR step" })
    ).toHaveAttribute("href", "/app/launch?tab=qr")

    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?qr=error`)
    await expect(
      page.getByRole("heading", { name: "Could not load your venue QR" })
    ).toBeVisible()
    // The team code still renders beside a failed QR read.
    await expect(codeToggle(page)).toBeVisible()
  })

  test("the pinned scanner stays in the viewport at 320×568 and the QR fits", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoHydratedPage(page, HARNESS_ROUTES.dashboard)

    const scan = page.getByRole("link", { name: "Scan a customer code" })
    await expect(scan).toBeInViewport({ ratio: 1 })
    const box = await scan.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    await page.locator("[data-console-body]").evaluate((body) => {
      body.scrollTop = body.scrollHeight
    })
    await expect(scan).toBeInViewport({ ratio: 1 })

    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("offline fixture shows the mono strip while the QR and code stay readable", async ({
    page,
  }) => {
    await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?offline=1`)
    await expect(page.locator("[data-console-offline]")).toContainText(
      /Offline/
    )
    await expect(qrButton(page)).toBeVisible()
    await expect(codeToggle(page)).toBeVisible()
  })
}
