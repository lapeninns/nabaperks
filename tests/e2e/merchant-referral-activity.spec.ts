import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

test.use({ viewport: { width: 390, height: 844 } })

function captureConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  return errors
}

test.beforeEach(async ({ page }) => {
  await dismissPwaInstall(page)
})

test("referral bonus appears in the full Activity feed under All, Stamps, and search", async ({
  page,
}) => {
  const consoleErrors = captureConsoleErrors(page)
  await gotoHydratedPage(page, HARNESS_ROUTES.activity)

  const referralHeadline = page.getByText(
    "Phone ending 812 earned a referral bonus stamp",
    { exact: true }
  )
  await expect(referralHeadline).toBeVisible()
  await expect(page.getByText("Referral bonus", { exact: true })).toBeVisible()
  await expect(page.getByText("348", { exact: true })).toBeVisible()

  const search = page.getByRole("searchbox", { name: "Search activity" })
  await search.fill("referral")
  await expect(referralHeadline).toBeVisible()
  await expect(page.getByText("1 shown from 7.")).toBeVisible()

  await page.getByRole("button", { name: "Stamps" }).click()
  await expect(referralHeadline).toBeVisible()
  await expect(page.getByRole("button", { name: "Stamps" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )

  const card = referralHeadline.locator("xpath=ancestor::article")
  const box = await card.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
  expect(consoleErrors).toEqual([])
})

test("referral bonus appears in the compact dashboard feed", async ({
  page,
}) => {
  const consoleErrors = captureConsoleErrors(page)
  await gotoHydratedPage(page, `${HARNESS_ROUTES.dashboard}?activity=referral`)

  const referralHeadline = page.getByText(
    "Phone ending 812 earned a referral bonus stamp",
    { exact: true }
  )
  const referralRow = referralHeadline.locator("xpath=ancestor::li")
  await expect(referralHeadline).toBeVisible()
  await expect(
    referralRow.getByText("Referral bonus", { exact: true })
  ).toBeVisible()
  await expect(
    referralRow.getByRole("link", { name: "View member" })
  ).toBeVisible()
  expect(consoleErrors).toEqual([])
})
