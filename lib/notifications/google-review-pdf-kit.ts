import { readFile } from "node:fs/promises"
import path from "node:path"

import QRCode from "qrcode"

const KIT_PATH = path.join(
  process.cwd(),
  "output",
  "design",
  "Google Review Kit - Native Google.html"
)

const GOOGLE_LOGO_SVG = `<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z"/></svg>`

const STAR_SVG = `<svg class="stage-star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.4 2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.77 6.19 20.28l1.11-6.47-4.7-4.58 6.5-.95Z"/></svg>`

const NFC_WAVES_SVG = `<svg class="nfc-waves" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 8.5a5 5 0 0 1 0 7"/><path d="M9.5 6a8.5 8.5 0 0 1 0 12"/><circle cx="3.2" cy="12" r="1.35" fill="currentColor" stroke="none"/></svg>`

export type GoogleReviewKitFace = "card-front" | "card-back" | "plate"

export type GoogleReviewKitCopy = {
  readonly merchantName: string
  readonly locality: string | null
  readonly reviewUrl: string
}

let cachedKitCss: string | null = null

async function loadKitCss(): Promise<string> {
  if (cachedKitCss) return cachedKitCss
  const html = await readFile(KIT_PATH, "utf8")
  const match = html.match(/<style>([\s\S]*?)<\/style>/u)
  if (!match?.[1]) {
    throw new Error(`Unable to read Google Review Kit styles from ${KIT_PATH}`)
  }
  cachedKitCss = match[1]
  return cachedKitCss
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function placeLabel(locality: string | null): string {
  const trimmed = locality?.trim()
  return trimmed || "your local"
}

function starRow(): string {
  return `<div class="stage-stars" aria-hidden="true">${STAR_SVG.repeat(5)}</div>`
}

async function qrShellSvg(reviewUrl: string): Promise<string> {
  const svg = await QRCode.toString(reviewUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#202124", light: "#ffffff" },
  })
  return svg.replace("<svg", '<svg role="img" aria-label="QR code"')
}

function buildCardFront(copy: GoogleReviewKitCopy): string {
  const venue = escapeHtml(copy.merchantName)
  const place = escapeHtml(placeLabel(copy.locality))
  return `
<article class="tap-card card front">
  <div class="paper-zone">
    <div class="eyebrow">A Quick Favor For Your Local</div>
    <h2 class="headline">Loved Your <span class="accent">Visit&nbsp;in&nbsp;${place}?</span></h2>
    <p class="lede">Local pubs survive on word-of-mouth. Tap your phone below to leave a quick Google review and help others find ${place}&apos;s best pub — it takes less than 10 seconds.</p>
    <div class="venue-chip venue-text">${venue}</div>
    <div class="g-badge" aria-hidden="true">${GOOGLE_LOGO_SVG}</div>
  </div>
  <div class="tap-stage">
    <div class="stage-action">
      ${starRow()}
      <div class="tap-btn front-tap-btn">${NFC_WAVES_SVG} Tap to Review</div>
    </div>
  </div>
</article>`
}

async function buildCardBack(copy: GoogleReviewKitCopy): Promise<string> {
  const venue = escapeHtml(copy.merchantName)
  const place = escapeHtml(placeLabel(copy.locality))
  const qr = await qrShellSvg(copy.reviewUrl)
  return `
<article class="tap-card card back">
  <div class="blue-strip">
    <h2 class="headline">10 Seconds to Support<br>Your ${place} Local</h2>
    <span class="strip-g" aria-hidden="true">${GOOGLE_LOGO_SVG}</span>
  </div>
  <div class="paper-zone">
    <div class="back-body">
      <div class="back-steps">
        <div class="back-step"><span class="back-num">1</span><div><strong>TAP</strong><span>Hold your phone to the card</span></div></div>
        <div class="back-step"><span class="back-num">2</span><div><strong>RATE</strong><span>Tap the stars</span></div></div>
        <div class="back-step"><span class="back-num">3</span><div><strong>POST</strong><span>Add a photo if you loved it</span></div></div>
      </div>
      <div class="qr-panel">
        <span class="qr-label">No Tap?</span>
        <div class="qr-shell">${qr}</div>
        <span class="qr-caption">Scan to review</span>
      </div>
    </div>
    <div class="back-meta">
      <span class="venue-text">${venue}</span>
      <span class="hint">Thank you for visiting</span>
    </div>
  </div>
</article>`
}

async function buildPlate(copy: GoogleReviewKitCopy): Promise<string> {
  const place = escapeHtml(placeLabel(copy.locality))
  const qr = await qrShellSvg(copy.reviewUrl)
  return `
<article class="tap-card plate">
  <div class="paper-zone">
    <div class="eyebrow">Support ${place}</div>
    <h2 class="headline">Drop a Quick <span class="accent">Google&nbsp;Review.</span></h2>
    <p class="lede">Got 10 seconds? Tap below to rate your experience and help more people discover a local venue in ${place}.</p>
    <div class="g-badge" aria-hidden="true">${GOOGLE_LOGO_SVG}</div>
  </div>
  <div class="tap-stage">
    <div class="stage-action">
      ${starRow()}
      <div class="tap-btn plate-tap-btn">${NFC_WAVES_SVG} Tap to Review</div>
    </div>
    <div class="fallback-row">
      <span class="or-scan">Or point your camera at the QR code.</span>
      <div class="qr-shell">${qr}</div>
    </div>
  </div>
</article>`
}

/**
 * Print-ready HTML for one Google Review Kit face, matching the design kit
 * CSS and structure so Chromium PDF output matches the on-screen preview.
 */
export async function buildGoogleReviewKitFaceHtml(
  face: GoogleReviewKitFace,
  copy: GoogleReviewKitCopy
): Promise<{
  readonly html: string
  readonly widthMm: number
  readonly heightMm: number
}> {
  const css = await loadKitCss()
  const body =
    face === "card-front"
      ? buildCardFront(copy)
      : face === "card-back"
        ? await buildCardBack(copy)
        : await buildPlate(copy)

  const widthMm = face === "plate" ? 100 : 85.6
  const heightMm = face === "plate" ? 100 : 54

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nabaperks Google Review ${face}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=DM+Sans:opsz,wght@9..40,400..800&display=swap" rel="stylesheet">
<style>
${css}
html,body{margin:0;padding:0;background:#fff}
body{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden}
.tap-card{box-shadow:none!important;margin:0}
@media print{
  @page{size:${widthMm}mm ${heightMm}mm;margin:0}
  html,body{width:${widthMm}mm;height:${heightMm}mm}
}
</style>
</head>
<body>${body}</body>
</html>`

  return { html, widthMm, heightMm }
}
