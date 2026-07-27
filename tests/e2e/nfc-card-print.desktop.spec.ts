import { expect, test } from "@playwright/test"
import { PDFDocument } from "pdf-lib"

const CARD_WIDTH_MM = 85.5
const CARD_HEIGHT_MM = 54
const PIXELS_PER_MM = 96 / 25.4
const POINTS_PER_MM = 72 / 25.4

test.describe("CR80 NFC card printing", () => {
  test("removes merchant-shell offsets while preserving both print pages", async ({
    page,
  }) => {
    await page.goto("/dev/nfc-card-preview?design=tap")
    await page.evaluate(() => {
      const printRoot = document.querySelector(".qr-poster-print-root")
      if (!(printRoot instanceof HTMLElement)) {
        throw new Error("NFC card print root was not rendered")
      }

      const wrapper = document.createElement("div")
      wrapper.style.display = "flex"
      const sidebar = document.createElement("aside")
      sidebar.dataset.slot = "sidebar"
      sidebar.style.width = "320px"
      sidebar.style.flex = "none"
      const inset = document.createElement("main")
      inset.dataset.slot = "sidebar-inset"
      inset.style.padding = "180px 32px 0"
      inset.style.width = "100%"

      printRoot.before(wrapper)
      wrapper.append(sidebar, inset)
      inset.append(printRoot)
    })

    await page.emulateMedia({ media: "print" })

    const printRoot = page.locator(".qr-poster-print-root")
    const faces = printRoot.locator('section[aria-label^="NFC card "]')
    await expect(faces).toHaveCount(2)
    await expect(page.locator(".qr-poster-chrome")).toBeHidden()

    const readGeometry = () =>
      faces.evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect()
          return {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
          }
        })
      )

    // WebKit can acknowledge the print-media switch one layout pass before it
    // has recomputed offsets for a newly reparented print root. Wait on the
    // physical-page contract itself: this fails permanently for a real shell
    // leak but does not charge the browser's stale pre-print layout to the app.
    await expect
      .poll(async () => {
        const current = await readGeometry()
        return current.every(
          (face, index) =>
            Math.abs(face.left) < 0.05 &&
            Math.abs(face.top - index * CARD_HEIGHT_MM * PIXELS_PER_MM) < 0.5 &&
            Math.abs(face.width - CARD_WIDTH_MM * PIXELS_PER_MM) < 0.5 &&
            Math.abs(face.height - CARD_HEIGHT_MM * PIXELS_PER_MM) < 0.5
        )
      })
      .toBe(true)

    const geometry = await readGeometry()

    expect(geometry).toHaveLength(2)
    for (const [index, face] of geometry.entries()) {
      expect(face.left).toBeCloseTo(0, 1)
      expect(face.top).toBeCloseTo(index * CARD_HEIGHT_MM * PIXELS_PER_MM, 0)
      expect(face.width).toBeCloseTo(CARD_WIDTH_MM * PIXELS_PER_MM, 0)
      expect(face.height).toBeCloseTo(CARD_HEIGHT_MM * PIXELS_PER_MM, 0)
      expect(face.scrollWidth).toBeLessThanOrEqual(Math.ceil(face.width))
      expect(face.scrollHeight).toBeLessThanOrEqual(Math.ceil(face.height))
    }
  })

  test("generates two native 85.5×54 mm browser PDF pages", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "PDF generation is Chromium-only")

    await page.goto("/dev/nfc-card-preview?design=tap")
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    })
    const document = await PDFDocument.load(pdf)

    expect(document.getPageCount()).toBe(2)
    for (const pdfPage of document.getPages()) {
      expect(
        Math.abs(pdfPage.getWidth() - CARD_WIDTH_MM * POINTS_PER_MM)
      ).toBeLessThan(0.75)
      expect(
        Math.abs(pdfPage.getHeight() - CARD_HEIGHT_MM * POINTS_PER_MM)
      ).toBeLessThan(0.75)
    }
    expect(pdf.byteLength).toBeGreaterThan(10_000)
  })
})
