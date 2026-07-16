import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/home-harness/stamp?mode=success&delay=40"

test.describe("customer stamp choreography — reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("preserves the full semantic result without spatial choreography", async ({
    page,
  }) => {
    await page.goto(HARNESS)
    const root = page.locator("[data-stamp-phase]")

    await root.getByRole("button", { name: "Add today's stamp" }).click()
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
    await expect(
      root.getByRole("list", { name: /4 of 5 stamps earned/ })
    ).toBeVisible()
    await expect(root.getByText("Stamp 4 of 5 added.")).toBeVisible()
    await expect(root.locator('[role="status"]')).toHaveText(
      "Stamp added. That's 4 of 5."
    )

    const spatialAnimationCount = await root.evaluate((element) => {
      return element
        .getAnimations({ subtree: true })
        .filter((animation) => {
          if (!(animation.effect instanceof KeyframeEffect)) return false
          return animation.effect.getKeyframes().some((frame) => {
            const transform = frame.transform
            return typeof transform === "string" && transform !== "none"
          })
        }).length
    })
    expect(spatialAnimationCount).toBe(0)
  })

  test("keeps press-and-hold static while preserving one commit", async ({
    page,
  }) => {
    await page.goto("/dev/home-harness/stamp?mode=success&delay=200")
    const root = page.locator("[data-stamp-phase]")
    const button = page.locator("[data-stamp-press-button]")
    const ring = button.locator("circle")
    await button.scrollIntoViewIfNeeded()
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    const initialOffset = await ring.evaluate(
      (element) => element.style.strokeDashoffset
    )
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(250)

    await expect(button.locator("svg")).toHaveCSS("opacity", "0")
    expect(
      await ring.evaluate((element) => element.style.strokeDashoffset)
    ).toBe(initialOffset)

    await page.waitForTimeout(400)
    await page.mouse.up()
    await expect(page.locator("[data-submit-count]")).toHaveText("1")
    await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
  })
})
