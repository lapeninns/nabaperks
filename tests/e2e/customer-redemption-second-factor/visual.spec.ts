import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "../helpers/axe"

test("@MS-customer-redemption-second-factor hides collection value until email is verified", async ({
  page,
}) => {
  await page.goto("/dev/home-harness/redemption-second-factor")

  await expect(page.getByLabel("Email address")).toBeVisible()
  await expect(page.getByText(/independent security check/i)).toBeVisible()
  await expect(page.getByAltText(/collection QR/i)).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Save and email my code" })
  ).toBeVisible()
  await expectNoAxeViolations(page, "reward collection second-factor gate")
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)

  const navigation = page.getByRole("navigation", { name: "Home navigation" })
  for (const field of [
    page.getByLabel("Full name"),
    page.getByLabel("Date of birth"),
    page.getByLabel("Email address"),
    page.getByRole("button", { name: "Save and email my code" }),
  ]) {
    await field.focus()
    await expect
      .poll(async () => {
        const fieldBox = await field.boundingBox()
        const navigationBox = await navigation.boundingBox()
        if (!fieldBox || !navigationBox) return false
        return fieldBox.y + fieldBox.height <= navigationBox.y
      })
      .toBe(true)
  }

  await page.getByRole("button", { name: "Save and email my code" }).click()
  await expect(page.getByLabel("Email address")).toBeFocused()
})
