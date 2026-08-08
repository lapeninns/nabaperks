import { expect, test, type Locator } from "@playwright/test"

import { HARNESS_ROUTES } from "./helpers/harness"

/**
 * 03#12: the counter ticket used to stack on top of the KPI grid at every
 * width, so a desktop console spent ~220px of its first screen on a card that
 * only needs 288px of it.
 *
 * The audit asked for the split at `md`. That is not available and the number
 * says why: the console sidebar is 272px, so a 768px viewport leaves the
 * content column 448px and an 18rem sidecar would give each of the four KPI
 * tiles 34px. The split therefore starts at `xl` (944px of column, 148px
 * tiles). Both halves are asserted here, because a breakpoint that fires too
 * early is the defect this replaced.
 */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("expected the element to have a layout box")
  return box
}

test.describe("merchant dashboard counter ticket @merchant-dashboard", () => {
  test("Given an xl console When the dashboard renders Then the ticket is a sidecar beside the metrics", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(HARNESS_ROUTES.dashboard)

    const qr = page.getByAltText("QR code for Old Crown Girton").first()
    const venueHeading = page.getByRole("heading", {
      level: 2,
      name: "Old Crown Girton",
    })
    const metricsHeading = page.getByRole("heading", {
      name: "How the week is going",
    })

    const qrBox = await boxOf(qr)
    const metricsBox = await boxOf(metricsHeading)
    const venueBox = await boxOf(venueHeading)

    // Side by side, and level with each other rather than merely adjacent.
    expect(qrBox.x + qrBox.width).toBeLessThan(metricsBox.x)
    expect(Math.abs(qrBox.y - metricsBox.y)).toBeLessThan(120)

    // Inside a 288px sidecar the card is ONE column: the ticket sits above the
    // venue name, not beside it. This is the `@container` half — a `sm:` split
    // here would leave the copy track 84px wide.
    expect(qrBox.y + qrBox.height).toBeLessThanOrEqual(venueBox.y)

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(1280)
  })

  test("Given a 1024 console When the dashboard renders Then the ticket still spans the column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto(HARNESS_ROUTES.dashboard)

    const qr = page.getByAltText("QR code for Old Crown Girton").first()
    const venueHeading = page.getByRole("heading", {
      level: 2,
      name: "Old Crown Girton",
    })
    const metricsHeading = page.getByRole("heading", {
      name: "How the week is going",
    })

    const qrBox = await boxOf(qr)
    const metricsBox = await boxOf(metricsHeading)
    const venueBox = await boxOf(venueHeading)

    // Stacked: the whole ticket clears the metrics heading vertically.
    expect(qrBox.y + qrBox.height).toBeLessThan(metricsBox.y)
    // And with the full column the card is TWO columns again, so the container
    // query is doing the work rather than a hardcoded stack.
    expect(qrBox.x + qrBox.width).toBeLessThan(venueBox.x)
  })
})
