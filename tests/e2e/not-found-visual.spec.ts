import { expect, test } from "@playwright/test"

test("renders missing routes with the branded Wet Ink not-found surface", async ({
  page,
}) => {
  await page.goto("/missing-route")

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Back to Nabaperks" })
  ).toBeVisible()
  await expect(page.locator("body")).not.toContainText(
    "This page could not be found"
  )
})

test("renders invalid dynamic tokens with the same branded not-found surface", async ({
  page,
}) => {
  await page.goto("/r/demo-token")

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Back to Nabaperks" })
  ).toBeVisible()
})
