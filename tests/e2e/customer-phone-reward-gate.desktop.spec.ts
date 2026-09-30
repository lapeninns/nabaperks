import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

for (const width of [390, 768, 1280]) {
  test(`email join and deferred phone collection at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await dismissPwaInstall(page)
    // A card joined by email reaches the terms step with email-only
    // marketing and no phone asked for until a reward needs one.
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=terms-email&offer=none"
    )
    await expect(
      page.getByRole("button", { name: "Add my first stamp", exact: true })
    ).toBeEnabled()
    await expect(
      page.getByText(/Send me offers from .* by email$/)
    ).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath("email-join-terms.png"),
      fullPage: true,
    })

    await gotoHydratedPage(page, "/dev/home-harness/profile?wallet=email-only")
    const contacts = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Your details" }),
    })
    await expect(
      contacts.getByLabel("UK mobile number", { exact: true })
    ).toBeVisible()
    await expect(
      contacts.getByRole("button", { name: "Send my code" })
    ).toBeEnabled()
    await expectNoAxeViolations(page, "phone required profile")
    await page.screenshot({
      path: testInfo.outputPath("profile.png"),
      fullPage: true,
    })

    await gotoHydratedPage(page, "/dev/reward-collection?state=phone")
    await expect(
      page.getByRole("heading", {
        name: "Confirm your mobile number",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByLabel("UK mobile number", { exact: true })
    ).toBeVisible()
    await expect(page.locator('img[src*="qr.png"]')).toHaveCount(0)
    await expect(
      page.getByText("Show this code", { exact: false })
    ).toHaveCount(0)
    await expectNoAxeViolations(page, "phone required collection")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath("reward-phone.png"),
      fullPage: true,
    })
  })
}
