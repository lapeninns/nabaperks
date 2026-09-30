import { expect, test, type Locator, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "../helpers/axe"

/**
 * Before a reward can be collected, one requirement per screen (designer
 * brief R3): name and date of birth first, then the email address and its
 * code. The collection code stays hidden until every step is done.
 */
test("hides collection value until the profile email is verified", async ({
  page,
}) => {
  await page.goto("/dev/home-harness/redemption-second-factor")

  await expect(page.getByLabel("Full name")).toBeVisible()
  await expect(page.getByLabel("Date of birth")).toBeVisible()
  await expect(
    page.getByText(
      "Venues need your name and date of birth before handing over a reward."
    )
  ).toBeVisible()
  // The email is the next step, not a field beside the details.
  await expect(page.getByLabel("Email address")).toHaveCount(0)
  await expect(page.getByAltText(/QR code for collecting/i)).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Save and continue" })
  ).toBeVisible()
  await expectNoAxeViolations(page, "reward collection details step")
  await expectNoHorizontalOverflow(page)
  await expectAboveNavigation(page, [
    page.getByLabel("Full name"),
    page.getByLabel("Date of birth"),
    page.getByRole("button", { name: "Save and continue" }),
  ])

  // Details saved, no address yet: the email step asks only for it.
  await page.goto(
    "/dev/home-harness/redemption-second-factor?gate=email-address"
  )
  await expect(page.getByLabel("Email address")).toBeVisible()
  await expect(
    page.getByText(
      "Add your email address. We'll send you a code to confirm it."
    )
  ).toBeVisible()
  await expect(page.getByLabel("Full name")).toHaveCount(0)
  await expect(page.getByLabel("Date of birth")).toHaveCount(0)
  await expect(page.getByAltText(/QR code for collecting/i)).toHaveCount(0)
  await expectNoAxeViolations(page, "reward collection second-factor gate")
  await expectNoHorizontalOverflow(page)
  await expectAboveNavigation(page, [
    page.getByLabel("Email address"),
    page.getByRole("button", { name: "Save and continue" }),
  ])

  await page.getByRole("button", { name: "Save and continue" }).click()
  await expect(page.getByLabel("Email address")).toBeFocused()
})

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)
}

/** Each control, once focused, sits clear of the fixed home navigation. */
async function expectAboveNavigation(
  page: Page,
  controls: Locator[]
): Promise<void> {
  const navigation = page.getByRole("navigation", { name: "Home navigation" })
  for (const field of controls) {
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
}
