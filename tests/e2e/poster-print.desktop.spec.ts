import { expect, test } from "@playwright/test"
import jsQR from "jsqr"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { PDFDocument } from "pdf-lib"
import { PNG } from "pngjs"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import { QR_POSTER_TEMPLATE_IDS } from "@/lib/qr/poster-templates"
import {
  normalisePosterText,
  posterVisibleCopy,
} from "../support/poster-output-copy.mjs"

const EDGE_VENUE =
  "The Extraordinarily Long Crown and Anchor Community Public House"
const EVIDENCE_DIRECTORY = process.env.POSTER_BROWSER_EVIDENCE_DIR
const UNMODELLED_PRINT_COPY = [
  "admit / start your card",
  "start / 01",
  "issuer / naba/perks",
  "visual seam only",
  "stamps on your card",
  "powered by nabaperks",
  "fold to peak",
]

async function saveEvidence(
  poster: import("@playwright/test").Locator,
  filename: string
) {
  if (!EVIDENCE_DIRECTORY) return
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true })
  await poster.screenshot({
    path: path.join(EVIDENCE_DIRECTORY, filename),
    animations: "disabled",
  })
}

test.describe("poster printing", () => {
  for (const template of QR_POSTER_TEMPLATE_IDS) {
    test(`${template} poster remains visible in print media`, async ({
      page,
      browserName,
    }) => {
      await page.goto(`/dev/poster-preview?template=${template}`)
      const content = resolvePosterContent(template, 3)
      const posterSheet = page.locator(".qr-poster-print-root article")
      const physical = await posterSheet.evaluate((element) => ({
        width: element.clientWidth,
        height: element.clientHeight,
        // Measure the QR image itself, not its parent: every template sizes
        // the light-box image to qr.outerMm, but chalk wraps it in a padded
        // chalk-box frame, so the parent is larger than the QR.
        qrOuterPixels: Array.from(element.querySelectorAll("img")).map(
          (image) => image.clientWidth
        ),
      }))
      const renderedText = normalisePosterText(await posterSheet.innerText())
      for (const expected of posterVisibleCopy(content)) {
        expect(renderedText, `${template} renders ${expected}`).toContain(
          normalisePosterText(expected)
        )
      }
      for (const unexpected of UNMODELLED_PRINT_COPY) {
        expect(renderedText).not.toContain(unexpected)
      }
      const pixelsPerMm = 96 / 25.4
      expect(physical.width).toBeCloseTo(
        content.geometry.sheetWidthMm * pixelsPerMm,
        0
      )
      expect(physical.height).toBeCloseTo(
        content.geometry.sheetHeightMm * pixelsPerMm,
        0
      )
      const expectedQrMm = [content.qr.outerMm]
      physical.qrOuterPixels.forEach((size, index) => {
        expect(size).toBeCloseTo(expectedQrMm[index] * pixelsPerMm, 0)
      })
      if (browserName === "chromium") {
        await page.evaluate(() => {
          window.print = () => {
            document.documentElement.dataset.printRequested = "true"
          }
        })
        await page.getByRole("button", { name: "Print or save PDF" }).click()
        await expect(page.locator("html")).toHaveAttribute(
          "data-print-requested",
          "true"
        )
      }
      await page.evaluate(() => {
        const printRoot = document.querySelector(".qr-poster-print-root")
        if (!(printRoot instanceof HTMLElement)) {
          throw new Error("Poster print root was not rendered")
        }
        const shell = document.createElement("div")
        shell.style.paddingLeft = "320px"
        shell.style.paddingTop = "180px"
        printRoot.before(shell)
        shell.append(printRoot)
      })
      await page.emulateMedia({ media: "print" })

      const printRoot = page.locator(".qr-poster-print-root")
      const printPosterSheet = printRoot.locator("article")
      const printBounds = await printRoot.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return { left: bounds.left, top: bounds.top }
      })

      await expect(printRoot).toHaveCSS("visibility", "visible")
      await expect(printPosterSheet).toHaveCSS("visibility", "visible")
      expect(printBounds.left).toBeCloseTo(0, 1)
      expect(printBounds.top).toBeCloseTo(0, 1)
      const qrImages = printPosterSheet.locator("img")
      const expectedQrCount = 1
      await expect(qrImages).toHaveCount(expectedQrCount)
      for (const qrImage of await qrImages.all()) {
        await expect(qrImage).toHaveJSProperty("naturalWidth", 900)
      }
      if (browserName === "chromium") {
        // Decode the server-rendered QR data URLs in Node with jsQR: the PNG
        // bytes are identical in every browser, and CI's Linux Chromium ships
        // BarcodeDetector without a working backend. Chromium-only so the
        // proof runs once per template rather than once per browser.
        const qrSources = await qrImages.evaluateAll((images) =>
          images.map((image) => image.getAttribute("src") ?? "")
        )
        const decodedTargets = qrSources.map((source) => {
          const base64 = source.split(",")[1] ?? ""
          const png = PNG.sync.read(Buffer.from(base64, "base64"))
          return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
            ?.data
        })
        expect(decodedTargets).toHaveLength(expectedQrCount)
        expect(
          decodedTargets.every((target) => typeof target === "string")
        ).toBe(true)
        expect(new Set(decodedTargets).size).toBe(1)
      }
      await saveEvidence(printPosterSheet, `${template}-print.png`)
      await expect(page.locator(".qr-poster-chrome")).toBeHidden()
      await expect(page.locator(".qr-poster-action-bar")).toBeHidden()
    })

    test(`${template} poster generates a nonblank PDF`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", "PDF generation is Chromium-only")

      await page.goto(`/dev/poster-preview?template=${template}`)
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

    test(`${template} contains the 60-character venue and six-stamp maximum`, async ({
      page,
    }) => {
      const venue = EDGE_VENUE.slice(0, 60)
      await page.goto(
        `/dev/poster-preview?template=${template}&venue=${encodeURIComponent(venue)}&stamps=6`
      )
      await page.evaluate(async () => document.fonts.ready)
      const poster = page.locator(".qr-poster-print-root article")
      await expect(poster).toContainText(venue)
      await expect(poster).toContainText(/six visits|6/i)
      const venueLabels = poster.locator("[data-poster-venue]")
      await expect(venueLabels).toHaveCount(1)
      const venueEvidence = await venueLabels.evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect()
          const parentBounds = element.parentElement?.getBoundingClientRect()
          return {
            text: element.textContent?.trim() ?? "",
            textOverflow: getComputedStyle(element).textOverflow,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            insideParent:
              !parentBounds ||
              (bounds.left >= parentBounds.left - 1 &&
                bounds.right <= parentBounds.right + 1 &&
                bounds.top >= parentBounds.top - 1 &&
                bounds.bottom <= parentBounds.bottom + 1),
          }
        })
      )
      for (const evidence of venueEvidence) {
        expect(evidence.text).toBe(venue)
        expect(evidence.textOverflow).not.toBe("ellipsis")
        expect(evidence.scrollWidth).toBeLessThanOrEqual(
          evidence.clientWidth + 1
        )
        // +4 absorbs Linux Firefox reporting glyph descent in scrollHeight
        // (a constant +3 there); a wrapped line would add a full line-height.
        expect(evidence.scrollHeight).toBeLessThanOrEqual(
          evidence.clientHeight + 4
        )
        expect(evidence.insideParent).toBe(true)
      }
      const bounds = await poster.evaluate((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
      }))
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1)
      expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1)
      await saveEvidence(poster, `${template}-maximum.png`)
    })
  }
})
