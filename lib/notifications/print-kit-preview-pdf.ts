import { PDFDocument } from "pdf-lib"

import { getPrintKitBrowser } from "./print-kit-browser"
import {
  applyPrintPdfMetadata,
  type PrintPdfMetadata,
} from "./pdf-metadata"

const PRINT_CHROME_HIDE = `
  .qr-poster-chrome { display: none !important; }
  [data-slot="sidebar"],
  [data-slot="sidebar-gap"],
  [data-slot="sidebar-container"] { display: none !important; }
`

export type PreviewPdfRequest = {
  readonly previewOrigin: string
  readonly pathname: string
  readonly searchParams: Record<string, string>
  /** Selector that must exist before printing. */
  readonly readySelector?: string
  readonly metadata?: PrintPdfMetadata
}

/**
 * Probe that a Next preview origin can serve /dev print routes.
 * Throws with an actionable message when the server is down.
 */
export async function assertPrintKitPreviewOrigin(
  previewOrigin: string
): Promise<void> {
  const origin = previewOrigin.replace(/\/$/, "")
  const probeUrl = `${origin}/dev/poster-preview?template=seal`
  let response: Response
  try {
    response = await fetch(probeUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error) {
    throw new Error(
      `Print-kit preview origin is unreachable (${origin}). Start the app with \`pnpm dev\` and re-run export. ${
        error instanceof Error ? error.message : ""
      }`.trim()
    )
  }
  if (response.status >= 400) {
    throw new Error(
      `Print-kit preview origin returned HTTP ${response.status} for ${probeUrl}. Start \`pnpm dev\` (non-production) and retry.`
    )
  }
}

function buildPreviewUrl(request: PreviewPdfRequest): string {
  const origin = request.previewOrigin.replace(/\/$/, "")
  const url = new URL(request.pathname, `${origin}/`)
  for (const [key, value] of Object.entries(request.searchParams)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/**
 * Render a /dev/*-preview print root to PDF via Playwright so the file matches
 * the on-screen React sheet (preferCSSPageSize + printBackground).
 */
export async function renderPrintKitPreviewPdf(
  request: PreviewPdfRequest
): Promise<string> {
  const browser = await getPrintKitBrowser()
  const page = await browser.newPage()
  const target = buildPreviewUrl(request)
  try {
    const response = await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })
    if (!response || response.status() >= 400) {
      throw new Error(
        `Preview PDF navigation failed (${response?.status() ?? "no response"}): ${target}`
      )
    }
    await page.addStyleTag({ content: PRINT_CHROME_HIDE })
    const readySelector = request.readySelector ?? ".qr-poster-print-root"
    await page.waitForSelector(readySelector, { timeout: 30_000 })
    await page
      .evaluate(async () => {
        if (!document.fonts?.ready) return
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 4_000)),
        ])
      })
      .catch(() => undefined)
    // Let CSS module print rules settle (scale → native die size).
    await new Promise((resolve) => setTimeout(resolve, 150))
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
    if (!request.metadata) {
      return Buffer.from(pdf).toString("base64")
    }
    const pdfDocument = await PDFDocument.load(pdf)
    applyPrintPdfMetadata(pdfDocument, request.metadata)
    return Buffer.from(await pdfDocument.save()).toString("base64")
  } finally {
    await page.close()
  }
}
