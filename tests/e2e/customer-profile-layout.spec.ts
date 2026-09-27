import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

test.describe("@customer-flow profile email verification layout", () => {
  for (const width of [320, 390, 1024]) {
    test(`keeps the email code and recovery actions inside the card at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 })
      await dismissPwaInstall(page)
      await gotoHydratedPage(page, "/dev/home-harness/profile")
      await page.evaluate(() => document.fonts.ready)

      const code = page.getByRole("textbox", {
        name: "Email code",
        exact: true,
      })
      await code.fill("123456")
      await expect(code).toHaveValue("123456")

      for (const name of [
        "Confirm email",
        "Email me a new code",
        "Continue without email",
      ]) {
        const button = page.getByRole("button", { name, exact: true })
        await button.click({ trial: true })
        const bounds = await button.evaluate((element) => {
          const control = element.getBoundingClientRect()
          const main = element.closest("main")!.getBoundingClientRect()
          return {
            left: control.left,
            right: control.right,
            mainLeft: main.left,
            mainRight: main.right,
          }
        })
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.mainLeft)
        expect(bounds.right).toBeLessThanOrEqual(bounds.mainRight)
      }

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(width)
    })
  }

  test("sign-out lives in the account area rather than the shell header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await dismissPwaInstall(page)
    await gotoHydratedPage(page, "/dev/home-harness/profile")

    // The wallet header carries the wordmark only; the account action sits in
    // Profile, which the fixed tab bar reaches from every screen.
    const header = page.locator("header").first()
    await expect(header.getByRole("button", { name: "Log out" })).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Profile", exact: true })
    ).toBeVisible()

    const account = page.locator("[data-account-section]")
    const logOut = account.getByRole("button", { name: "Log out", exact: true })
    await expect(logOut).toBeVisible()
    await logOut.click({ trial: true })

    // Both remain form submissions to server actions, not client shortcuts.
    await expect(account.locator("form")).toHaveCount(2)
    const box = (await logOut.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)

    // Sessions last until log-out, so a lost phone needs a way out.
    const logOutAll = account.getByRole("button", {
      name: "Log out on all devices",
      exact: true,
    })
    await expect(logOutAll).toBeVisible()
    const allBox = (await logOutAll.boundingBox())!
    expect(allBox.height).toBeGreaterThanOrEqual(44)
  })
})
