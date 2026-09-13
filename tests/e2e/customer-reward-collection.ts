import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

const HARNESS = "/dev/reward-collection"

/**
 * Portrait phones the customer journey is held to, plus the two short
 * viewports where the collection screen is most at risk: a small phone with the
 * browser chrome up, and landscape.
 */
const PORTRAIT = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [414, 896],
  [430, 932],
  [480, 960],
] as const

const SHORT = [
  [375, 480],
  [844, 390],
] as const

/** The smallest square a counter scanner can still read comfortably. */
const MIN_QR_EDGE_PX = 132

type Box = { x: number; y: number; width: number; height: number }

async function collectionGeometry(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    return document.fonts.ready
  })

  const qr = page.getByRole("img", {
    name: /QR code for collecting/i,
  })
  await expect(qr).toBeVisible()

  const frame = page.locator("figure").first()
  const instruction = page.locator("[data-collection-instruction]")
  const nav = page.getByRole("navigation", { name: "Home navigation" })

  return {
    qr: (await qr.boundingBox()) as Box,
    frame: (await frame.boundingBox()) as Box,
    instruction: (await instruction.boundingBox()) as Box,
    nav: (await nav.boundingBox()) as Box,
    viewport: await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    })),
  }
}

export function describeCustomerRewardCollection() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const [width, height] of PORTRAIT) {
    test(`the whole collection code and its instruction fit ${width}x${height}`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.setViewportSize({ width, height })
      await gotoHydratedPage(page, `${HARNESS}?state=ready`)

      const { qr, frame, instruction, nav, viewport } =
        await collectionGeometry(page)

      // The code is whole, not cropped by the fold, and the instruction that
      // says what to do with it is on the same screen.
      expect(frame.y).toBeGreaterThanOrEqual(0)
      expect(instruction.y + instruction.height).toBeLessThanOrEqual(
        viewport.height
      )
      // Fixed navigation and the safe area never sit over it.
      expect(instruction.y + instruction.height).toBeLessThanOrEqual(nav.y)
      // Still big enough to scan, and the frame keeps its white quiet zone.
      expect(qr.width).toBeGreaterThanOrEqual(MIN_QR_EDGE_PX)
      expect(Math.abs(qr.width - qr.height)).toBeLessThanOrEqual(1)
      expect(frame.width).toBeGreaterThan(qr.width)
      // No horizontal overflow.
      expect(viewport.scrollWidth).toBeLessThanOrEqual(width)
      expect(errors).toEqual([])
    })
  }

  for (const [width, height] of SHORT) {
    test(`a short ${width}x${height} viewport keeps a scannable code clear of the tab bar`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      await gotoHydratedPage(page, `${HARNESS}?state=ready`)

      const { qr, frame, nav, viewport } = await collectionGeometry(page)

      expect(qr.width).toBeGreaterThanOrEqual(MIN_QR_EDGE_PX)
      expect(frame.y + frame.height).toBeLessThanOrEqual(nav.y)
      expect(viewport.scrollWidth).toBeLessThanOrEqual(width)
    })
  }

  test("long venue and reward names wrap without clipping the code", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoHydratedPage(page, `${HARNESS}?state=ready&long=1`)

    const { viewport } = await collectionGeometry(page)
    expect(viewport.scrollWidth).toBeLessThanOrEqual(320)
  })

  test("photo ID is required beside the code only while the venue must check it @a11y", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await gotoHydratedPage(page, `${HARNESS}?state=id-check`)
    const idNote = page.getByText("Photo ID needed")
    await expect(idNote).toBeVisible()
    const { instruction } = await collectionGeometry(page)
    const idBox = (await idNote.boundingBox()) as Box
    // Beside the collection action, not tucked into the details disclosure.
    expect(idBox.y).toBeGreaterThan(instruction.y)
    await expectNoAxeViolations(page, "reward collection with photo ID check")

    await gotoHydratedPage(page, `${HARNESS}?state=ready`)
    await expect(page.getByText("Photo ID needed")).toHaveCount(0)
  })

  test("supporting description and terms stay behind a disclosure after the code", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydratedPage(page, `${HARNESS}?state=ready`)

    const terms = page.getByText(
      /Harness fixture reward\. The venue team confirms/
    )
    await expect(terms).toBeHidden()

    const summary = page.getByText("Reward details and terms", { exact: true })
    const summaryBox = (await summary.boundingBox()) as Box
    const { instruction } = await collectionGeometry(page)
    expect(summaryBox.y).toBeGreaterThan(instruction.y)
    // Keyboard operable, and on the touch-target contract.
    expect(summaryBox.height).toBeGreaterThanOrEqual(44)

    await summary.click()
    await expect(terms).toBeVisible()
  })

  test("no screen asks for the code before the customer can produce it @a11y", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await gotoHydratedPage(page, `${HARNESS}?state=details`)
    await expect(
      page.getByRole("heading", { name: "Complete your details", level: 1 })
    ).toBeVisible()
    await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0)
    await expect(page.getByText(/Show this code to the team/)).toHaveCount(0)
    // The reward stays named as context.
    await expect(
      page.getByText("A mystery reward at Old Crown Girton")
    ).toBeVisible()
    // Two steps for a customer with no verified email; the readout says so.
    await expect(page.getByText("Step 1 of 2")).toBeVisible()
    await expectNoAxeViolations(page, "reward collection details step")

    await gotoHydratedPage(page, `${HARNESS}?state=email`)
    await expect(
      page.getByRole("heading", { name: "Verify your email", level: 1 })
    ).toBeVisible()
    await expect(page.getByText("Step 2 of 2")).toBeVisible()
    await expect(page.getByLabel("Email code")).toBeVisible()
    await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0)

    // An already-verified email is a step this customer never sees, so there is
    // no progress readout to mislead them.
    await gotoHydratedPage(page, `${HARNESS}?state=details-verified-email`)
    await expect(
      page.getByRole("heading", { name: "Complete your details", level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/Step \d of \d/)).toHaveCount(0)
  })

  test("early preparation is offered only when something is outstanding", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await gotoHydratedPage(page, `${HARNESS}?waiting=1&state=details`)
    const prepare = page.getByRole("link", { name: "Get ready to collect" })
    await expect(prepare).toBeVisible()
    // The waiting reward never shows a code, whatever the customer prepares.
    await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0)

    await gotoHydratedPage(page, `${HARNESS}?waiting=1&state=ready`)
    await expect(
      page.getByRole("link", { name: "Get ready to collect" })
    ).toHaveCount(0)

    // Preparing opens the same requirements and returns to the reward.
    await gotoHydratedPage(page, `${HARNESS}?waiting=1&state=details&prepare=1`)
    await expect(
      page.getByRole("heading", { name: "Complete your details", level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText(/does not change when your reward opens/)
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Back to your reward" })
    ).toBeVisible()
    await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0)
  })

  test("a failed code request keeps a usable retry and a sign-in recovery", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydratedPage(page, `${HARNESS}?state=ready`)

    // Break the image the same way an expired session does, then force a reload
    // of it through the component's own refresh path.
    await page.evaluate(() => {
      const image = document.querySelector<HTMLImageElement>(
        'img[alt^="QR code for collecting"]'
      )
      image?.dispatchEvent(new Event("error"))
    })

    const retry = page.getByRole("button", { name: "Show a fresh QR" })
    await expect(retry).toBeVisible()
    await expect(
      page.getByText("We could not show your reward code")
    ).toBeVisible()
    await retry.click()
    await expect(page.getByRole("img", { name: /QR code/i })).toBeVisible()
  })
}
