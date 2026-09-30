import { expect, test } from "@playwright/test"

import { expectNoAxeViolations, hideDevelopmentOverlay } from "../helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "../helpers/harness"

for (const width of [375, 768, 1280]) {
  test(`Given no email When collecting at ${width}px Then a verified email is required before showing a reward code`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await dismissPwaInstall(page)
    // One requirement per screen (R3): the details step asks for name and
    // date of birth only; the email address is the step after it.
    await gotoHydratedPage(page, "/dev/reward-collection?state=details")
    await expect(page.getByLabel("Full name")).toBeVisible()
    await expect(page.getByLabel("Date of birth")).toBeVisible()
    await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("img", { name: /QR code for collecting/i })
    ).toHaveCount(0)

    await gotoHydratedPage(page, "/dev/reward-collection?state=email-address")
    await expect(page.getByLabel("Full name")).toHaveCount(0)
    await expect(page.getByLabel("Date of birth")).toHaveCount(0)
    const email = page.getByLabel("Email address", { exact: true })
    await expect(email).toHaveAttribute("required", "")
    await page.getByRole("button", { name: "Save and continue" }).click()
    await expect(email).toBeFocused()
    expect(
      await email.evaluate(
        (input: HTMLInputElement) => input.validity.valueMissing
      )
    ).toBe(true)
    await expect(
      page.getByRole("img", { name: /QR code for collecting/i })
    ).toHaveCount(0)
    await expectNoAxeViolations(page, "required reward email")
    await page.screenshot({
      path: testInfo.outputPath(`required-email-${width}.png`),
      fullPage: true,
    })

    await gotoHydratedPage(page, "/dev/reward-collection?state=email")
    await hideDevelopmentOverlay(page)
    await expect(page.getByLabel("Email code")).toBeVisible()
    await expect(
      page.getByRole("img", { name: /QR code for collecting/i })
    ).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath(`verify-email-${width}.png`),
      fullPage: true,
    })

    await gotoHydratedPage(page, "/dev/reward-collection?state=id-check")
    await expect(
      page.getByRole("img", { name: /QR code for collecting/i })
    ).toBeVisible()
    await expect(page.getByLabel("Email code")).toHaveCount(0)
  })
}
