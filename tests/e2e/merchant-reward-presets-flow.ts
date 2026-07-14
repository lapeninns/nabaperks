import { expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

export function describeMerchantRewardPresets() {
  test.describe("merchant reward presets @reward-presets", () => {
    test("Given the card harness When a cadence preset is chosen Then the existing card draft is prefilled", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=card`)

      await page.getByRole("button", { name: /Food-led card/ }).click()

      await expect(
        page.getByRole("group", { name: "Visits to reveal" })
      ).toContainText("5")
      await expect(
        page.getByText("Works for meals and planned visits.")
      ).toBeVisible()
    })

    test("RA-1: selected presets remain draft-only until the explicit bulk Add", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards&pool=empty`)

      const regularsPint = presetToggle(page, "Regulars' pint")
      const freeStarter = presetToggle(page, "Free starter")
      const dessert = presetToggle(page, "Dessert on the house")

      await expect(regularsPint).toBeVisible()
      await regularsPint.click()
      await freeStarter.click()
      await dessert.click()

      await expect(regularsPint).toHaveAttribute("aria-pressed", "true")
      await expect(freeStarter).toHaveAttribute("aria-pressed", "true")
      await expect(dessert).toHaveAttribute("aria-pressed", "true")
      await expect(page.getByText(/3 selected/).first()).toBeVisible()
      await expect(page.getByText(/3 active after add/).first()).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Add 3 rewards" })
      ).toBeEnabled()
      await expect(page.getByText("No rewards in the pool yet")).toBeVisible()
      await expect(page.getByLabel("Reward name")).toHaveCount(0)
    })

    test("RA-1: Space and Enter toggle preset selection without invoking persistence", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await gotoHydratedPage(
        page,
        `${HARNESS_ROUTES.launch}?tab=rewards&pool=empty`
      )

      const freeStarter = presetToggle(page, "Free starter")
      await expect(freeStarter).toBeVisible()
      await freeStarter.press("Space")
      await expect(freeStarter).toHaveAttribute("aria-pressed", "true")

      const repeatedSpaceWasCancelled = await freeStarter.evaluate((button) =>
        button.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            repeat: true,
            bubbles: true,
            cancelable: true,
          })
        )
      )
      expect(repeatedSpaceWasCancelled).toBe(false)
      await expect(freeStarter).toHaveAttribute("aria-pressed", "true")

      await freeStarter.press("Enter")
      await expect(freeStarter).toHaveAttribute("aria-pressed", "false")
      await expect(page.getByText("No rewards in the pool yet")).toBeVisible()
    })

    test("RA-2: customising removes a selected preset and Cancel restores trigger focus", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards&pool=empty`)

      const freeStarter = presetToggle(page, "Free starter")
      const customise = page.getByRole("button", {
        name: "Customise Free starter",
      })

      await expect(freeStarter).toBeVisible()
      await freeStarter.click()
      await expect(freeStarter).toHaveAttribute("aria-pressed", "true")
      await customise.click()

      await expect(freeStarter).toHaveAttribute("aria-pressed", "false")
      await expect(page.getByLabel("Reward name")).toHaveValue("Free starter")
      await expect(page.getByLabel("Reward terms")).toHaveValue(
        /Valid once issued\./
      )
      await page.getByText("Weighting").click()
      await expect(page.getByLabel("Weight")).toHaveValue("1")

      await page.getByRole("button", { name: "Cancel" }).click()
      await expect(customise).toBeFocused()
    })

    test("RA-2/RA-6: an existing preset opens its authoritative row instead of a duplicate draft", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards&pool=existing`)

      const existingPreset = presetToggle(page, "Free starter")
      await expect(existingPreset).toHaveAttribute("aria-pressed", "false")
      await expect(
        page.getByText(/Free starter is already in your pool/i)
      ).toBeVisible()

      await page.locator("#preset-customise-free-starter").click()

      await expect(page.getByText("Edit reward")).toBeVisible()
      const rewardName = page.getByLabel("Reward name")
      await expect(rewardName).toHaveValue("Free starter")
      await expect(rewardName).toBeFocused()
      await expect(page.getByLabel("Reward terms")).toHaveValue(
        /Valid once issued\./
      )
    })

    test("RA-5/RA-12: an auth failure announces no change and retains every selected preset for retry", async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards&pool=empty`)

      const regularsPint = presetToggle(page, "Regulars' pint")
      const freeStarter = presetToggle(page, "Free starter")
      await expect(regularsPint).toBeVisible()
      await regularsPint.click()
      await freeStarter.click()

      await page.getByRole("button", { name: "Add 2 rewards" }).click()

      await expect(
        page
          .getByRole("alert")
          .filter({
            hasText: "Nothing was changed. Your choices are still selected",
          })
      ).toBeVisible()
      await expect(regularsPint).toHaveAttribute("aria-pressed", "true")
      await expect(freeStarter).toHaveAttribute("aria-pressed", "true")
      await expect(
        page.getByRole("button", { name: "Add 2 rewards" })
      ).toBeEnabled()
      await expect(page.getByText("No rewards in the pool yet")).toBeVisible()

      await page.getByRole("button", { name: "Clear" }).click()
      await expect(
        page
          .getByRole("alert")
          .filter({
            hasText: "Nothing was changed. Your choices are still selected",
          })
      ).toHaveCount(0)
      await expect(regularsPint).toHaveAttribute("aria-pressed", "false")
      await expect(freeStarter).toHaveAttribute("aria-pressed", "false")
      await expect(regularsPint).toBeFocused()
    })

    test("RA-11: the selection tray stays reachable without horizontal overflow", async ({
      page,
    }, testInfo) => {
      await dismissPwaInstall(page)
      const mobile = testInfo.project.name === "mobile-safari"
      await page.setViewportSize(
        mobile ? { width: 375, height: 812 } : { width: 1280, height: 800 }
      )
      await page.goto(`${HARNESS_ROUTES.launch}?tab=rewards&pool=empty`)

      const freeStarter = presetToggle(page, "Free starter")
      await expect(freeStarter).toBeVisible()
      await freeStarter.click()

      const addButton = page.getByRole("button", { name: "Add 1 reward" })
      if (mobile) {
        await expect(addButton).toBeInViewport()
      } else {
        await addButton.scrollIntoViewIfNeeded()
        await expect(addButton).toBeInViewport()
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    })

  })
}

function presetToggle(page: Page, rewardName: string) {
  return page
    .locator("button[aria-pressed]")
    .filter({ hasText: rewardName })
    .first()
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  )
}
