import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

export function defineQrPauseTests() {
  test("requesting and cancelling keeps scans live; verified pause and one-click resume @a11y", async ({
    page,
  }) => {
    await page.clock.install()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("/dev/app-harness/qr-pause")
    await expect(page).toHaveTitle(/App harness/)
    await expect(
      page.getByRole("heading", { name: "Venue QR", exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Pause customer scans" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading")).toHaveText(
      "Pause customer scans at Old Crown Girton?"
    )
    await page
      .getByRole("button", { name: "Send verification code", exact: true })
      .click()
    const code = page.getByLabel("Email verification code", { exact: true })
    await expect(code).toBeFocused()
    await expect(
      page.getByText("Live · accepting scans", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled()
    await expect(
      page.getByText("Code requests: 1. Confirmation transitions: 0.")
    ).toBeVisible()
    const axe = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze()
    expect(axe.violations).toEqual([])
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Pause customer scans" })
    ).toBeFocused()
    await page.getByRole("button", { name: "Pause customer scans" }).click()
    await expect(
      page.getByLabel("Email verification code", { exact: true })
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Send verification code", exact: true })
      .click()
    await code.fill("222222")
    await page
      .getByRole("button", { name: "Verify and pause", exact: true })
      .click()
    await expect(
      page.getByText("That code is incorrect. Check the email and try again.")
    ).toBeVisible()
    await expect(code).toBeFocused()
    await code.fill("000000")
    await page
      .getByRole("button", { name: "Verify and pause", exact: true })
      .click()
    await expect(
      page.getByText("That code has expired. Request a new code.")
    ).toBeVisible()
    await page.clock.fastForward(61_000)
    await page.getByRole("button", { name: "Resend code", exact: true }).click()
    await code.fill("123456")
    await page
      .getByRole("button", { name: "Verify and pause", exact: true })
      .click()
    await expect(
      page.getByText("Paused · no new scans", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText("Code requests: 3. Confirmation transitions: 1.")
    ).toBeVisible()
    await page.getByRole("button", { name: "Resume customer scans" }).click()
    await expect(
      page.getByText("Live · accepting scans", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText("Code requests: 3. Confirmation transitions: 2.")
    ).toBeVisible()
    expect(errors).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}
