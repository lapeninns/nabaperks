import { expect, test } from "@playwright/test"

test("deterministic harness hydrates without browser errors @MS-production-qa-closure", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto("/dev/app-harness/qr")
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
