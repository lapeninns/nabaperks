import { expect, test } from "@playwright/test"
import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

test.describe("@customer-flow @a11y welcome offer composition", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const width of [390, 320, 1024]) {
    test(`reflows real offer surfaces at ${width}px with complete long terms`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      for (const surface of [
        "landing",
        "phone",
        "code",
        "terms",
        "card",
        "pass",
        "counter",
      ]) {
        await page.goto(
          `/dev/welcome-offer?surface=${surface}&long=1&state=not_started`
        )
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        ).toBe(true)
        if (surface === "landing") {
          const claim = page.getByRole("link", { name: "Claim this offer" })
          await expect(claim).toBeInViewport()
          await expect(
            page.getByRole("heading", { name: /25% off/ }).first()
          ).toBeVisible()
          expect((await claim.boundingBox())?.height).toBeGreaterThanOrEqual(44)
          await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2)
        }
        if (surface === "pass") {
          await expect(page.getByRole("img", { name: /QR code/ })).toHaveCount(
            0
          )
          await page.getByText("Extra terms", { exact: true }).click()
          await expect(
            page.getByText(/Food ordered from the seasonal menu only/).last()
          ).toBeVisible()
        }
        if (surface === "terms") {
          await expect(page.locator("#loyalty-terms")).not.toBeChecked()
          await expect(page.locator("#marketing-opt-in")).not.toBeChecked()
          await page.locator("#loyalty-terms").check()
          await expect(page.locator("#marketing-opt-in")).not.toBeChecked()
        }
        if (surface === "counter") {
          await expect(
            page.getByText(/Food ordered from the seasonal menu only/).last()
          ).toBeVisible()
        }
        await expectNoAxeViolations(page, `welcome ${surface} ${width}`)
        await testInfo.attach(`${surface}-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        })
      }
    })
  }

  test("counter confirmations are independent and required before applying", async ({
    page,
  }) => {
    await page.goto("/dev/welcome-offer?surface=counter")
    const apply = page.getByRole("button", { name: "Apply 10% off" })
    await expect(apply).toBeInViewport()
    const form = apply.locator("xpath=ancestor::form")
    await expect(apply).toBeEnabled()
    expect(
      await form.evaluate((el) => (el as HTMLFormElement).checkValidity())
    ).toBe(false)
    await page.locator('[name="idChecked"]').check()
    expect(
      await form.evaluate((el) => (el as HTMLFormElement).checkValidity())
    ).toBe(false)
    await page.locator('[name="noStacking"]').check()
    expect(
      await form.evaluate((el) => (el as HTMLFormElement).checkValidity())
    ).toBe(true)
    await page.locator('[name="idChecked"]').uncheck()
    expect(
      await form.evaluate((el) => (el as HTMLFormElement).checkValidity())
    ).toBe(false)
    // Read the controlled recovery states without posting any redemption.
    for (const state of ["expired", "redeemed", "blocked"]) {
      await page.goto(`/dev/welcome-offer?surface=counter&state=${state}`)
      await expect(apply).toHaveCount(0)
      await expect(
        page.getByRole("link", { name: "Scan another code" })
      ).toBeVisible()
    }
  })

  test("unavailable passes retain terms and QR failures offer a fresh code", async ({
    page,
  }) => {
    for (const state of ["not_started", "expired", "revoked", "unavailable"]) {
      await page.goto(`/dev/welcome-offer?surface=pass&state=${state}`)
      await expect(page.getByRole("img", { name: /QR code/ })).toHaveCount(0)
      await page.getByText("Extra terms", { exact: true }).click()
      await expect(page.getByText(/One pass per person/)).toBeVisible()
    }
    await page.route("**/pass/*/qr.png?*", (route) =>
      route.fulfill({ status: 404, body: "Pass QR not available" })
    )
    await page.goto("/dev/welcome-offer?surface=pass")
    await expect(
      page.getByText("We could not show your pass code")
    ).toBeVisible()
    const retry = page.getByRole("button", { name: "Show a fresh code" })
    await retry.focus()
    await retry.press("Enter")
    await expect(
      page.getByRole("link", { name: "sign in with your number" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Show a fresh code" })
    ).toBeFocused()
  })
})
