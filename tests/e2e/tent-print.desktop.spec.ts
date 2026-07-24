import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { PDFDocument } from "pdf-lib"
import { PNG } from "pngjs"

import { resolveTentContent } from "@/lib/qr/tent-content"
import { TENT_DESIGN_IDS } from "@/lib/qr/tent-templates"

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-GB")
}

test.describe("table tent printing", () => {
  for (const design of TENT_DESIGN_IDS) {
    test(`${design} tent renders both faces and the fold in print media`, async ({
      page,
      browserName,
    }) => {
      await page.goto(`/dev/tent-preview?design=${design}&stamps=3`)
      const content = resolveTentContent(design, 3)
      const sheet = page.locator(".qr-poster-print-root article")

      // Both faces and an unlabelled visual fold guide are present.
      const text = normalise(await sheet.innerText())
      expect(text).not.toContain("fold to peak")
      await expect(sheet.locator('[class*="foldLine"]')).toHaveCount(1)
      for (const face of [content.faceA, content.faceB]) {
        expect(text).toContain(normalise(face.headline.join(" ")))
        expect(text).toContain(normalise(face.cta))
      }

      // A4 sheet at 96 dpi.
      const box = await sheet.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
        qrCount: element.querySelectorAll("img").length,
      }))
      const pxPerMm = 96 / 25.4
      expect(box.width).toBeCloseTo(210 * pxPerMm, 0)
      expect(box.height).toBeCloseTo(297 * pxPerMm, 0)
      // One QR per face — both encode the same venue URL.
      expect(box.qrCount).toBe(2)

      await page.evaluate(() => {
        const printRoot = document.querySelector(".qr-poster-print-root")
        if (!(printRoot instanceof HTMLElement)) {
          throw new Error("Table tent print root was not rendered")
        }
        const shell = document.createElement("div")
        shell.style.paddingLeft = "320px"
        shell.style.paddingTop = "180px"
        printRoot.before(shell)
        shell.append(printRoot)
      })
      await page.emulateMedia({ media: "print" })
      const printRoot = page.locator(".qr-poster-print-root")
      const printBounds = await printRoot.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return { left: bounds.left, top: bounds.top }
      })
      await expect(printRoot).toHaveCSS("visibility", "visible")
      expect(printBounds.left).toBeCloseTo(0, 1)
      expect(printBounds.top).toBeCloseTo(0, 1)
      const qrImages = printRoot.locator("article img")
      await expect(qrImages).toHaveCount(2)

      if (browserName === "chromium") {
        // Decode both QR PNGs in Node (CI Linux Chromium lacks a working
        // BarcodeDetector backend); both faces must target the same URL.
        const sources = await qrImages.evaluateAll((images) =>
          images.map((image) => image.getAttribute("src") ?? "")
        )
        const decoded = sources.map((source) => {
          const base64 = source.split(",")[1] ?? ""
          const png = PNG.sync.read(Buffer.from(base64, "base64"))
          return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
            ?.data
        })
        expect(decoded).toHaveLength(2)
        expect(decoded.every((value) => typeof value === "string")).toBe(true)
        expect(new Set(decoded).size).toBe(1)
      }
      await expect(page.locator(".qr-poster-chrome")).toBeHidden()
    })

    test(`${design} tent generates a nonblank PDF`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", "PDF generation is Chromium-only")
      await page.goto(`/dev/tent-preview?design=${design}&stamps=6`)
      const pdf = await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
      })
      const document = await PDFDocument.load(pdf)

      expect(document.getPageCount()).toBe(1)
      const [pdfPage] = document.getPages()
      expect(pdfPage.getWidth()).toBeCloseTo((210 * 72) / 25.4, 0)
      expect(pdfPage.getHeight()).toBeCloseTo((297 * 72) / 25.4, 0)
      expect(pdf.byteLength).toBeGreaterThan(10_000)
    })
  }
})
