import { PDFDocument } from "pdf-lib"

import {
  buildGoogleReviewKitFaceHtml,
  type GoogleReviewKitCopy,
} from "./google-review-pdf-kit"
import { closePrintKitBrowser, getPrintKitBrowser } from "./print-kit-browser"

export { closePrintKitBrowser as closeGoogleReviewPdfBrowser }

async function renderFacePdf(
  face: "card-front" | "card-back" | "plate",
  copy: GoogleReviewKitCopy
): Promise<Uint8Array> {
  const { html, widthMm, heightMm } = await buildGoogleReviewKitFaceHtml(
    face,
    copy
  )
  const browser = await getPrintKitBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    })
    await page
      .evaluate(async () => {
        if (!document.fonts?.ready) return
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 4_000)),
        ])
      })
      .catch(() => undefined)
    const pdf = await page.pdf({
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    })
    return pdf
  } finally {
    await page.close()
  }
}

export async function renderGoogleReviewCardPdf(
  merchantName: string,
  locality: string | null,
  reviewUrl: string
): Promise<string> {
  const copy: GoogleReviewKitCopy = { merchantName, locality, reviewUrl }
  // Serial faces share one Chromium; keeps font/network load predictable.
  const frontBytes = await renderFacePdf("card-front", copy)
  const backBytes = await renderFacePdf("card-back", copy)
  const merged = await PDFDocument.create()
  merged.setTitle(`Nabaperks Google review card for ${merchantName}`)
  merged.setAuthor("Nabaperks")
  merged.setSubject("CR80 Google review card — front and back at 85.6 × 54 mm")
  for (const bytes of [frontBytes, backBytes]) {
    const source = await PDFDocument.load(bytes)
    const [page] = await merged.copyPages(source, [0])
    merged.addPage(page)
  }
  return Buffer.from(await merged.save()).toString("base64")
}

export async function renderGoogleReviewPlatePdf(
  merchantName: string,
  locality: string | null,
  reviewUrl: string
): Promise<string> {
  const copy: GoogleReviewKitCopy = { merchantName, locality, reviewUrl }
  const bytes = await renderFacePdf("plate", copy)
  const document = await PDFDocument.load(bytes)
  document.setTitle(`Nabaperks Google review plate for ${merchantName}`)
  document.setAuthor("Nabaperks")
  document.setSubject("100 × 100 mm Google review wall plate")
  return Buffer.from(await document.save()).toString("base64")
}
