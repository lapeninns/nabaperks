import { expect, test } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import path from "node:path"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import {
  isQrPosterTableTent,
  QR_POSTER_TEMPLATE_IDS,
} from "@/lib/qr/poster-templates"
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
        qrOuterPixels: Array.from(element.querySelectorAll("img")).map(
          (image) => image.parentElement?.clientWidth ?? 0
        ),
        faceRows: Array.from(element.children)
          .filter((child) => child.querySelector("section"))
          .map((child) => {
            const face = child.querySelector("section")
            const main = face
              ? Array.from(face.children).find(
                  (element) => getComputedStyle(element).gridRowStart === "2"
                )
              : undefined
            return {
              height: child.clientHeight,
              rows: face
                ? getComputedStyle(face)
                    .gridTemplateRows.split(/\s+/)
                    .map(Number.parseFloat)
                : [],
              mainClientHeight: main?.clientHeight ?? 0,
              mainScrollHeight: main?.scrollHeight ?? 0,
              mainClientWidth: main?.clientWidth ?? 0,
              mainScrollWidth: main?.scrollWidth ?? 0,
            }
          }),
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
      const expectedQrMm =
        content.sheet === "a4"
          ? [content.qr.outerMm]
          : [content.faces.top.qr.outerMm, content.faces.bottom.qr.outerMm]
      physical.qrOuterPixels.forEach((size, index) => {
        expect(size).toBeCloseTo(expectedQrMm[index] * pixelsPerMm, 0)
      })
      if (content.sheet === "b5") {
        expect(physical.faceRows).toHaveLength(2)
        for (const face of physical.faceRows) {
          expect(face.height).toBeCloseTo(
            content.geometry.faceHeightMm * pixelsPerMm,
            0
          )
          expect(face.rows).toEqual([
            expect.closeTo(content.geometry.identityRowMm * pixelsPerMm, 0),
            expect.closeTo(content.geometry.mainRowMm * pixelsPerMm, 0),
            expect.closeTo(
              content.geometry.lowerOcclusionRowMm * pixelsPerMm,
              0
            ),
          ])
          expect(face.mainScrollHeight).toBeLessThanOrEqual(
            face.mainClientHeight + 1
          )
          expect(face.mainScrollWidth).toBeLessThanOrEqual(
            face.mainClientWidth + 1
          )
        }
      }
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
      await page.emulateMedia({ media: "print" })

      const printRoot = page.locator(".qr-poster-print-root")
      const printPosterSheet = printRoot.locator("article")

      await expect(printRoot).toHaveCSS("visibility", "visible")
      await expect(printPosterSheet).toHaveCSS("visibility", "visible")
      const qrImages = printPosterSheet.locator("img")
      const expectedQrCount = isQrPosterTableTent(template) ? 2 : 1
      await expect(qrImages).toHaveCount(expectedQrCount)
      for (const qrImage of await qrImages.all()) {
        await expect(qrImage).toHaveJSProperty("naturalWidth", 900)
      }
      if (browserName === "chromium") {
        // Decode from the QR <img> bitmaps directly. Full-sheet screenshots can
        // undersample module edges on dense Wet Ink layouts even when the print
        // assets themselves remain scannable. BarcodeDetector is Chromium-only
        // in Playwright's browser matrix.
        const decodedTargets = await page.evaluate(async () => {
          type BarcodeDetectorConstructor = new (options: {
            readonly formats: readonly string[]
          }) => {
            detect(image: ImageBitmap): Promise<readonly { rawValue: string }[]>
          }
          const Detector = (
            globalThis as typeof globalThis & {
              readonly BarcodeDetector?: BarcodeDetectorConstructor
            }
          ).BarcodeDetector
          if (!Detector) return []
          const detector = new Detector({ formats: ["qr_code"] })
          const images = Array.from(
            document.querySelectorAll<HTMLImageElement>(
              ".qr-poster-print-root article img"
            )
          )
          const values: string[] = []
          for (const image of images) {
            const bitmap = await createImageBitmap(image)
            const detections = await detector.detect(bitmap)
            bitmap.close()
            for (const detection of detections) {
              values.push(detection.rawValue)
            }
          }
          return values
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
      await expect(venueLabels).toHaveCount(
        isQrPosterTableTent(template) ? 2 : 1
      )
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
        expect(evidence.scrollHeight).toBeLessThanOrEqual(
          evidence.clientHeight + 2
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
