import { expect, test } from "@playwright/test"
import { PDFDocument } from "pdf-lib"

const SQUARE_PAGE_POINTS = (100 * 72) / 25.4
const SQUARE_PAGE_PIXELS = (100 * 96) / 25.4

test.describe("100 mm NFC square printing", () => {
  test("isolates the plate from the app shell at the physical page origin", async ({
    page,
  }) => {
    await page.goto("/dev/nfc-square-preview?design=tap")
    await page.evaluate(() => {
      const printRoot = document.querySelector(".qr-poster-print-root")
      if (!(printRoot instanceof HTMLElement)) {
        throw new Error("NFC square print root was not rendered")
      }

      const shell = document.createElement("div")
      shell.style.paddingLeft = "320px"
      shell.style.paddingTop = "180px"
      printRoot.before(shell)
      shell.append(printRoot)
    })

    await page.emulateMedia({ media: "print" })

    const printRoot = page.locator(".qr-poster-print-root")
    const plate = printRoot.locator('[data-nfc-face="square-front"]')
    const geometry = await printRoot.evaluate((element) => {
      const rootBounds = element.getBoundingClientRect()
      const plateElement = element.querySelector(
        '[data-nfc-face="square-front"]'
      )
      if (!(plateElement instanceof HTMLElement)) {
        throw new Error("NFC square plate was not rendered")
      }
      const plateBounds = plateElement.getBoundingClientRect()

      return {
        root: {
          left: rootBounds.left,
          top: rootBounds.top,
          width: rootBounds.width,
          height: rootBounds.height,
        },
        plate: {
          left: plateBounds.left,
          top: plateBounds.top,
          width: plateBounds.width,
          height: plateBounds.height,
          scrollWidth: plateElement.scrollWidth,
          scrollHeight: plateElement.scrollHeight,
        },
      }
    })

    await expect(page.locator(".qr-poster-chrome")).toBeHidden()
    await expect(plate).toBeVisible()
    expect(geometry.root.left).toBeCloseTo(0, 1)
    expect(geometry.root.top).toBeCloseTo(0, 1)
    expect(geometry.root.width).toBeCloseTo(SQUARE_PAGE_PIXELS, 0)
    expect(geometry.root.height).toBeCloseTo(SQUARE_PAGE_PIXELS, 0)
    expect(geometry.plate.left).toBeCloseTo(0, 1)
    expect(geometry.plate.top).toBeCloseTo(0, 1)
    expect(geometry.plate.width).toBeCloseTo(SQUARE_PAGE_PIXELS, 0)
    expect(geometry.plate.height).toBeCloseTo(SQUARE_PAGE_PIXELS, 0)
    expect(geometry.plate.scrollWidth).toBeLessThanOrEqual(
      Math.ceil(geometry.plate.width)
    )
    expect(geometry.plate.scrollHeight).toBeLessThanOrEqual(
      Math.ceil(geometry.plate.height)
    )
  })

  test("generates one native 100×100 mm browser PDF page", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "PDF generation is Chromium-only")

    await page.goto("/dev/nfc-square-preview?design=tap")
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    })
    const document = await PDFDocument.load(pdf)

    expect(document.getPageCount()).toBe(1)
    const [pdfPage] = document.getPages()
    // Chromium serialises custom CSS page sizes to hundredths of an inch,
    // making 100 mm a 99.82 mm PDF page. Keep the tolerance below 0.3 mm so
    // this still catches accidental A4/default-paper output.
    expect(Math.abs(pdfPage.getWidth() - SQUARE_PAGE_POINTS)).toBeLessThan(0.75)
    expect(Math.abs(pdfPage.getHeight() - SQUARE_PAGE_POINTS)).toBeLessThan(
      0.75
    )
    expect(pdf.byteLength).toBeGreaterThan(10_000)
  })
})
