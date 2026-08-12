import { expect, test, type Locator } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

test.describe("join and sidebar accessibility @a11y", () => {
  test.use({ serviceWorkers: "block" })

  test("Given the inert join harness When an invalid phone is submitted Then the real alert focuses and every secondary control meets the target floor", async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
    ]

    for (const viewport of viewports) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport)
        await page.goto("/dev/join-accessibility-harness")
        await page.getByLabel("UK phone number").fill("not-a-phone")
        await page.getByRole("button", { name: "Text me the code" }).click()

        const contactError = page.locator("#contact-error")
        await expect(contactError).toHaveAttribute("role", "alert")
        await expect(contactError).toHaveAttribute("aria-live", "assertive")
        await expect(contactError).toBeFocused()

        await expectTargetFloor(
          page.getByRole("link", {
            name: "See how stamps and rewards work",
          }),
          "identity back-to-offer"
        )
        await expectTargetFloor(
          page.getByRole("link", { name: "Wrong number? Use a different one" }),
          "OTP wrong-number"
        )
        await expectTargetFloor(
          page.getByRole("button", { name: "venue terms" }),
          "venue terms"
        )
        await expectTargetFloor(
          page.getByRole("button", { name: "Nabaperks customer terms" }),
          "Nabaperks customer terms"
        )
        await expectTargetFloor(
          page.getByRole("button", { name: "privacy notice" }),
          "privacy notice"
        )
      })
    }
  })

  test("Given the shared sidebar When its applicable trigger is activated by keyboard Then expanded state reflects the rendered navigation", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
    ]

    for (const viewport of viewports) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport)
        await page.goto("/dev/app-harness/dashboard")
        const isMobile = viewport.width < 768
        const toggle = page.getByRole("button", {
          name: isMobile ? "Open menu" : "Toggle navigation",
        })
        await expect(toggle).toHaveAttribute(
          "aria-expanded",
          isMobile ? "false" : "true"
        )
        const controls = await toggle.getAttribute("aria-controls")

        if (!isMobile && viewport.width === 768) {
          const expandedLayout = await page
            .locator("h1")
            .evaluate((heading) => {
              const range = document.createRange()
              range.selectNodeContents(heading)
              const headingWidths = Array.from(range.getClientRects()).map(
                (rect) => rect.width
              )
              const description = heading.nextElementSibling

              if (!(description instanceof HTMLParagraphElement)) {
                return { actionBoxes: [], descriptionWidths: [], headingWidths }
              }

              range.selectNodeContents(description)
              const descriptionWidths = Array.from(range.getClientRects()).map(
                (rect) => rect.width
              )
              const actions = heading.closest("section")?.lastElementChild
              const actionBoxes = actions
                ? Array.from(actions.querySelectorAll("a, button")).map(
                    (action) => {
                      const box = action.getBoundingClientRect()
                      return { height: box.height, width: box.width }
                    }
                  )
                : []
              const headingBox = heading.getBoundingClientRect()

              return {
                actionBoxes,
                descriptionWidths,
                headingWidths,
                textTrackWidth: headingBox.width,
              }
            })
          expect(expandedLayout.textTrackWidth).toBeGreaterThanOrEqual(300)
          expect(expandedLayout.headingWidths).not.toHaveLength(0)
          expect(expandedLayout.headingWidths.length).toBeLessThanOrEqual(2)
          expect(
            Math.min(...expandedLayout.headingWidths)
          ).toBeGreaterThanOrEqual(100)
          expect(expandedLayout.descriptionWidths).not.toHaveLength(0)
          expect(expandedLayout.descriptionWidths.length).toBeLessThanOrEqual(3)
          expect(
            Math.max(...expandedLayout.descriptionWidths)
          ).toBeGreaterThanOrEqual(300)
          expect(expandedLayout.actionBoxes).toHaveLength(3)
          for (const actionBox of expandedLayout.actionBoxes) {
            expect(actionBox.height).toBeGreaterThanOrEqual(44)
            expect(actionBox.width).toBeGreaterThanOrEqual(44)
          }
          await expect(
            page
              .getByRole("navigation", { name: "Merchant navigation" })
              .getByRole("link", { name: "Dashboard" })
          ).toBeVisible()
        }

        await toggle.focus()
        await page.keyboard.press("Space")
        const updatedToggle = page.locator(
          `[data-slot="sidebar-trigger"][aria-label="${
            isMobile ? "Open menu" : "Toggle navigation"
          }"]`
        )
        await expect(updatedToggle).toHaveAttribute(
          "aria-expanded",
          isMobile ? "true" : "false"
        )

        if (isMobile) {
          expect(controls).not.toBeNull()
          const controlledRegion = page.locator(`#${controls ?? "missing"}`)
          await expect(controlledRegion).toHaveCount(1)
          await expect(controlledRegion).toBeVisible()
          await page.waitForFunction((regionId) => {
            const region = document.getElementById(regionId)
            const dashboard = region?.querySelector("a")
            if (!region || !dashboard) return false
            const regionRect = region.getBoundingClientRect()
            const dashboardRect = dashboard.getBoundingClientRect()
            return (
              regionRect.x >= 0 &&
              regionRect.width >= 192 &&
              dashboardRect.x >= 0 &&
              dashboardRect.width >= 44 &&
              dashboardRect.height >= 44
            )
          }, controls ?? "missing")
          await expect(
            controlledRegion.getByRole("link", { name: "Dashboard" })
          ).toBeVisible()
          await expectNoAxeViolations(
            page,
            "shared mobile sidebar after keyboard toggle"
          )
        } else {
          expect(controls).toBeNull()
        }
      })
    }
  })
})

async function expectTargetFloor(locator: Locator, label: string) {
  await expect(locator).toBeVisible()
  const rect = await locator.boundingBox()
  expect(rect, `${label} must have a bounding box`).not.toBeNull()
  expect(rect?.width, `${label} width`).toBeGreaterThanOrEqual(44)
  expect(rect?.height, `${label} height`).toBeGreaterThanOrEqual(44)
}
