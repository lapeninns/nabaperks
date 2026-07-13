import { expect, test } from "@playwright/test"

import { gotoHydratedPage } from "./helpers/harness"

test("deterministic harness hydrates without browser errors @MS-production-qa-closure", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await gotoHydratedPage(page, "/dev/app-harness/qr")
  await expect(page.locator("html")).toHaveAttribute(
    "data-playwright-hydrated",
    "true"
  )
  await expect(page.locator("html")).toHaveAttribute(
    "data-playwright-harness",
    "true"
  )
  await expect(page.locator("body")).not.toHaveAttribute("inert", "")
  await expect(
    page.getByRole("heading", { name: "Launch your counter QR" })
  ).toBeVisible()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )

  expect(pageErrors).toEqual([])
  expect(consoleErrors).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/hydrated.*didn't match|hydration mismatch/i),
    ])
  )
})
