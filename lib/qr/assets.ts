import "server-only"

import { PDFDocument } from "pdf-lib"
import QRCode from "qrcode"
import sharp from "sharp"

export type QrAssetKind = "poster_pdf" | "till_card_png" | "sticker_png"

export type QrAssetContext = {
  shareUrl: string
  qrPublicId: string
  merchantName: string
  locationName: string
  cardName: string
  rewardName: string
  isActive: boolean
}

const assetSlugs: Record<string, QrAssetKind> = {
  poster: "poster_pdf",
  "till-card": "till_card_png",
  sticker: "sticker_png",
}

/** Nabaperks Honey & Ink palette for print assets */
const brand = {
  paperCream: "#FCFAF7",
  paperWhite: "#ffffff",
  surfaceLow: "#fef2e6",
  surfaceMid: "#f8ece0",
  surfaceHigh: "#f2e6db",
  honey: "#d99e3d",
  honeyLight: "#ffddb0",
  honeyDark: "#805600",
  espresso: "#201b14",
  inkMuted: "#504536",
  outline: "#d4c4b1",
  outlineSoft: "#ece1d5",
  mint: "#EBF7F2",
  mintDeep: "#5DB57F",
  mintInk: "#12629a",
  disabled: "#ba1a1a",
} as const

export function assetKindFromSlug(slug: string) {
  return assetSlugs[slug] ?? null
}

export function assetFilename(kind: QrAssetKind, qrPublicId: string) {
  const extension = kind === "poster_pdf" ? "pdf" : "png"
  return `nabaperks-${kind.replaceAll("_", "-")}-${qrPublicId}.${extension}`
}

export async function renderQrCodePng(shareUrl: string, width = 720) {
  const dataUrl = await qrDataUrl(shareUrl, width)
  const base64 = dataUrl.split(",")[1]
  return Buffer.from(base64, "base64")
}

export async function renderQrAssetPng(
  kind: Exclude<QrAssetKind, "poster_pdf">,
  context: QrAssetContext
) {
  const canvas =
    kind === "till_card_png"
      ? { width: 900, height: 540, qrSize: 248 }
      : { width: 600, height: 600, qrSize: 288 }
  const qr = await qrDataUrl(context.shareUrl, canvas.qrSize)
  const svg =
    kind === "till_card_png"
      ? tillCardSvg(context, qr, canvas.width, canvas.height, canvas.qrSize)
      : stickerSvg(context, qr, canvas.width, canvas.height, canvas.qrSize)

  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function renderQrPosterPdf(context: QrAssetContext) {
  const png = await renderQrPosterPng(context)
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const image = await pdf.embedPng(png)

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  })

  return pdf.save()
}

export async function renderQrPosterPng(context: QrAssetContext) {
  const width = 1240
  const height = 1754
  const qrSize = 540
  const qr = await qrDataUrl(context.shareUrl, qrSize)
  const svg = posterSvg(context, qr, width, height, qrSize)

  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function qrDataUrl(shareUrl: string, width: number) {
  return QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: "H",
    margin: 4,
    width,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  })
}

function posterSvg(
  context: QrAssetContext,
  qrDataUrl: string,
  width: number,
  height: number,
  qrSize: number
) {
  const contentWidth = 888
  const contentX = (width - contentWidth) / 2

  const merchant = resolveWrappedText(context.merchantName, contentWidth, [
    { fontSize: 72, maxLines: 2, className: "title", weight: 800 },
    { fontSize: 58, maxLines: 2, className: "title-md", weight: 800 },
    { fontSize: 48, maxLines: 3, className: "title-sm", weight: 800 },
  ])

  const reward = resolveWrappedText(
    `Collect visit stamps · unlock ${context.rewardName}`,
    contentWidth - 64,
    [
      { fontSize: 38, maxLines: 3, className: "reward", weight: 800 },
      { fontSize: 32, maxLines: 3, className: "reward-sm", weight: 800 },
      { fontSize: 28, maxLines: 4, className: "reward-xs", weight: 800 },
    ]
  )

  const cardLines = resolveWrappedText(context.cardName, contentWidth, [
    { fontSize: 28, maxLines: 2, className: "body", weight: 700 },
    { fontSize: 24, maxLines: 2, className: "body-sm", weight: 700 },
  ])

  const locationLines = resolveWrappedText(context.locationName, contentWidth, [
    { fontSize: 26, maxLines: 2, className: "body", weight: 700 },
    { fontSize: 22, maxLines: 2, className: "body-sm", weight: 700 },
  ])

  const statusLine = context.isActive
    ? "Open for new scans"
    : "Not accepting scans right now"
  const statusFill = context.isActive ? brand.mintDeep : brand.disabled

  const merchantBlockHeight = merchant.lines.length * merchant.lineHeight
  const rewardBlockHeight = Math.max(120, reward.lines.length * reward.lineHeight + 48)
  const metaBlockHeight =
    cardLines.lines.length * cardLines.lineHeight +
    locationLines.lines.length * locationLines.lineHeight +
    24

  const headerHeight = merchantBlockHeight + 152
  const qrBlockHeight = qrSize + 96
  const footerHeight = context.isActive ? 88 : 120

  const cardInnerHeight =
    headerHeight + qrBlockHeight + rewardBlockHeight + metaBlockHeight + footerHeight + 96
  const cardY = Math.max(72, Math.round((height - cardInnerHeight - 48) / 2))
  const cardHeight = cardInnerHeight + 48

  const merchantY = cardY + 72 + merchant.lineHeight * 0.85
  const taglineY = merchantY + merchantBlockHeight + 24
  const hintY = taglineY + 42
  const qrY = hintY + 64
  const rewardBoxY = qrY + qrSize + 72
  const rewardTextStartY = rewardBoxY + 44 + reward.lineHeight * 0.85
  const cardTextY =
    rewardBoxY +
    rewardBlockHeight +
    32 +
    cardLines.lines.length * cardLines.lineHeight -
    cardLines.lineHeight * 0.15
  const locationTextY =
    cardTextY +
    cardLines.lines.length * cardLines.lineHeight +
    locationLines.lines.length * locationLines.lineHeight -
    locationLines.lineHeight * 0.15 +
    8

  const footerY = cardY + cardHeight - (context.isActive ? 52 : 88)
  const qrX = (width - qrSize) / 2
  const framePad = 48

  return svgShell(width, height, `
    <defs>
      <filter id="poster-shadow" x="-4%" y="-2%" width="108%" height="104%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="${brand.espresso}" flood-opacity="0.08"/>
      </filter>
    </defs>

    <rect width="${width}" height="${height}" fill="${brand.paperCream}"/>
    ${paperTexture(width, height)}

    <g filter="url(#poster-shadow)">
      <rect x="${contentX - 32}" y="${cardY - 24}" width="${contentWidth + 64}" height="${cardHeight}" rx="72" fill="${brand.paperWhite}" stroke="${brand.outline}" stroke-width="3"/>
    </g>
    <rect x="${contentX - 8}" y="${cardY}" width="${contentWidth + 16}" height="${cardHeight - 48}" rx="56" fill="${brand.surfaceLow}" stroke="${brand.outlineSoft}" stroke-width="2"/>

    <rect x="${contentX}" y="${cardY + 24}" width="${contentWidth}" height="8" rx="4" fill="${brand.honey}" opacity="0.9"/>
    ${textBlock(merchant, width / 2, merchantY, "middle")}
    <text x="${width / 2}" y="${taglineY}" text-anchor="middle" class="subtitle">Scan. Stamp. Reveal.</text>
    <text x="${width / 2}" y="${hintY}" text-anchor="middle" class="hint">No app required · point your camera here</text>

    <g aria-label="Scanner-safe black-on-white QR code">
      <rect class="qr-frame" x="${qrX - framePad}" y="${qrY - framePad}" width="${qrSize + framePad * 2}" height="${qrSize + framePad * 2}" rx="44"/>
      <rect class="qr-safe-zone" x="${qrX - 18}" y="${qrY - 18}" width="${qrSize + 36}" height="${qrSize + 36}" rx="28"/>
      <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
    </g>

    <rect x="${contentX}" y="${rewardBoxY}" width="${contentWidth}" height="${rewardBlockHeight}" rx="36" fill="${brand.mint}" stroke="${brand.outline}" stroke-width="2"/>
    ${textBlock(reward, width / 2, rewardTextStartY, "middle")}

    ${textBlock(cardLines, width / 2, cardTextY, "middle")}
    ${textBlock(locationLines, width / 2, locationTextY, "middle")}

    ${
      context.isActive
        ? ""
        : `<rect x="${width / 2 - 250}" y="${footerY - 8}" width="500" height="52" rx="26" fill="${statusFill}" fill-opacity="0.12" stroke="${statusFill}" stroke-width="2" stroke-opacity="0.35"/>
    <circle cx="${width / 2 - 220}" cy="${footerY + 18}" r="8" fill="${statusFill}"/>
    <text x="${width / 2}" y="${footerY + 24}" text-anchor="middle" class="status">${escapeXml(statusLine)}</text>`
    }

    <text x="${width / 2}" y="${cardY + cardHeight - 28}" text-anchor="middle" class="footer">Print at 100% · A4 · Powered by Nabaperks</text>
  `)
}

function tillCardSvg(
  context: QrAssetContext,
  qrDataUrl: string,
  width: number,
  height: number,
  qrSize: number
) {
  const copyX = 332
  const copyWidth = 536
  const qrX = 56
  const qrY = 108

  const merchant = resolveWrappedText(context.merchantName, copyWidth, [
    { fontSize: 40, maxLines: 2, className: "title-left", weight: 800 },
    { fontSize: 34, maxLines: 2, className: "title-left-sm", weight: 800 },
    { fontSize: 28, maxLines: 3, className: "title-left-xs", weight: 800 },
  ])

  const reward = resolveWrappedText(context.rewardName, copyWidth - 32, [
    { fontSize: 24, maxLines: 3, className: "body-left", weight: 800 },
    { fontSize: 21, maxLines: 3, className: "body-left-sm", weight: 800 },
    { fontSize: 18, maxLines: 4, className: "body-left-xs", weight: 800 },
  ])

  const location = resolveWrappedText(context.locationName, copyWidth, [
    { fontSize: 20, maxLines: 2, className: "caption-left", weight: 700 },
    { fontSize: 18, maxLines: 2, className: "caption-left-sm", weight: 700 },
  ])

  const statusLine = context.isActive ? "Open for scans" : "Paused"
  const statusColor = context.isActive ? brand.mintDeep : brand.disabled

  const merchantBlockHeight = merchant.lines.length * merchant.lineHeight
  const rewardBoxHeight = Math.max(84, reward.lines.length * reward.lineHeight + 44)
  const locationBlockHeight = location.lines.length * location.lineHeight

  const titleY = 176
  const taglineY = titleY + merchantBlockHeight + 20
  const rewardBoxY = taglineY + 24
  const rewardTextY = rewardBoxY + 36 + reward.lineHeight * 0.85
  const locationY = rewardBoxY + rewardBoxHeight + 24 + locationBlockHeight * 0.85
  const statusY = locationY + 28
  const footerY = 514

  return svgShell(width, height, `
    <rect width="${width}" height="${height}" rx="40" fill="${brand.paperCream}"/>
    <rect x="20" y="20" width="860" height="500" rx="36" fill="${brand.paperWhite}" stroke="${brand.espresso}" stroke-width="3"/>
    <rect x="36" y="36" width="828" height="468" rx="28" fill="${brand.surfaceLow}" stroke="${brand.outlineSoft}" stroke-width="2"/>

    <rect x="52" y="52" width="796" height="10" rx="5" fill="${brand.honey}" opacity="0.85"/>

    <rect x="44" y="96" width="${qrSize + 48}" height="${qrSize + 48}" rx="28" fill="${brand.paperWhite}" stroke="${brand.outline}" stroke-width="2"/>
    <g aria-label="Scanner-safe black-on-white QR code">
      <rect class="qr-frame" x="${qrX - 6}" y="${qrY - 6}" width="${qrSize + 12}" height="${qrSize + 12}" rx="20"/>
      <rect class="qr-safe-zone" x="${qrX + 4}" y="${qrY + 4}" width="${qrSize - 8}" height="${qrSize - 8}" rx="14"/>
      <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
    </g>

    ${textBlock(merchant, copyX, titleY, "start")}
    <text x="${copyX}" y="${taglineY}" class="subtitle-left">Scan. Stamp. Reveal.</text>

    <rect x="${copyX}" y="${rewardBoxY}" width="${copyWidth}" height="${rewardBoxHeight}" rx="20" fill="${brand.mint}" stroke="${brand.outline}" stroke-width="1.5"/>
    ${textBlock(reward, copyX + 16, rewardTextY, "start")}

    ${textBlock(location, copyX, locationY - locationBlockHeight + location.lineHeight * 0.85, "start")}

    <circle cx="${copyX + 8}" cy="${statusY}" r="7" fill="${statusColor}"/>
    <text x="${copyX + 24}" y="${statusY + 6}" class="caption-left-sm">${escapeXml(statusLine)}</text>

    <text x="${width / 2}" y="${footerY}" text-anchor="middle" class="footer-left">Keep beside the till for staff reference</text>
  `)
}

function stickerSvg(
  context: QrAssetContext,
  qrDataUrl: string,
  width: number,
  height: number,
  qrSize: number
) {
  const innerWidth = 504
  const venue = resolveWrappedText(context.merchantName, innerWidth, [
    { fontSize: 34, maxLines: 2, className: "sticker-venue", weight: 800 },
    { fontSize: 28, maxLines: 2, className: "sticker-venue-sm", weight: 800 },
    { fontSize: 24, maxLines: 3, className: "sticker-venue-xs", weight: 800 },
  ])

  const reward = resolveWrappedText(context.rewardName, innerWidth - 48, [
    { fontSize: 20, maxLines: 2, className: "sticker-reward", weight: 700 },
    { fontSize: 18, maxLines: 2, className: "sticker-reward-sm", weight: 700 },
  ])

  const venueBlockHeight = venue.lines.length * venue.lineHeight
  const rewardBlockHeight = reward.lines.length * reward.lineHeight
  let stickerQrSize = qrSize
  const minQrSize = 216

  while (stickerQrSize > minQrSize) {
    const qrY = 64 + venueBlockHeight + 24
    const taglineY = qrY + stickerQrSize + 48
    const rewardY = taglineY + 48 + reward.lineHeight * 0.85
    const bottom = rewardY + rewardBlockHeight + 16
    if (bottom <= height - 24) break
    stickerQrSize -= 8
  }

  const venueY = 64 + venue.lineHeight * 0.85
  const qrY = 64 + venueBlockHeight + 24
  const taglineY = qrY + stickerQrSize + 48
  const rewardY = taglineY + 48 + reward.lineHeight * 0.85
  const x = (width - stickerQrSize) / 2

  return svgShell(width, height, `
    <rect width="${width}" height="${height}" rx="64" fill="${brand.paperWhite}"/>
    <rect x="16" y="16" width="568" height="568" rx="56" fill="${brand.paperCream}" stroke="${brand.espresso}" stroke-width="4"/>
    <rect x="32" y="32" width="536" height="536" rx="44" fill="${brand.surfaceLow}" stroke="${brand.outline}" stroke-width="2"/>

    ${textBlock(venue, width / 2, venueY, "middle")}

    <g aria-label="Scanner-safe black-on-white QR code">
      <rect class="qr-frame" x="${x - 28}" y="${qrY - 28}" width="${stickerQrSize + 56}" height="${stickerQrSize + 56}" rx="32"/>
      <rect class="qr-safe-zone" x="${x - 10}" y="${qrY - 10}" width="${stickerQrSize + 20}" height="${stickerQrSize + 20}" rx="22"/>
      <image href="${qrDataUrl}" x="${x}" y="${qrY}" width="${stickerQrSize}" height="${stickerQrSize}"/>
    </g>

    <rect x="72" y="${taglineY - 28}" width="456" height="56" rx="28" fill="${brand.espresso}"/>
    <text x="${width / 2}" y="${taglineY + 8}" text-anchor="middle" class="sticker-tagline">Scan. Stamp. Reveal.</text>
    ${textBlock(reward, width / 2, rewardY, "middle")}
  `)
}

type TextPreset = {
  fontSize: number
  maxLines: number
  className: string
  weight: 400 | 600 | 700 | 800
}

type WrappedText = {
  lines: string[]
  className: string
  fontSize: number
  lineHeight: number
}

function resolveWrappedText(
  value: string,
  maxWidth: number,
  presets: TextPreset[]
): WrappedText {
  for (const preset of presets) {
    const maxChars = charsPerLine(maxWidth, preset.fontSize, preset.weight)
    const lines = fitLines(value.trim(), maxChars, preset.maxLines)
    const overflow = hasOverflow(value.trim(), lines, maxChars, preset.maxLines)
    if (!overflow) {
      return {
        lines,
        className: preset.className,
        fontSize: preset.fontSize,
        lineHeight: Math.round(preset.fontSize * 1.18),
      }
    }
  }

  const fallback = presets.at(-1)!
  const maxChars = charsPerLine(maxWidth, fallback.fontSize, fallback.weight)
  return {
    lines: fitLines(value.trim(), maxChars, fallback.maxLines),
    className: fallback.className,
    fontSize: fallback.fontSize,
    lineHeight: Math.round(fallback.fontSize * 1.18),
  }
}

function hasOverflow(
  value: string,
  lines: string[],
  maxChars: number,
  maxLines: number
) {
  const normalized = value.trim()
  const rendered = lines.join(" ")
  if (normalized.length > rendered.replace(/…$/u, "").length + 1) return true
  if (lines.some((line) => line.endsWith("…"))) return true
  if (lines.length >= maxLines) {
    const words = normalized.split(/\s+/)
    const usedWords = lines
      .join(" ")
      .replace(/…$/u, "")
      .split(/\s+/)
      .filter(Boolean)
    if (usedWords.length < words.length) return true
  }
  return lines.some((line) => line.length > maxChars)
}

function charsPerLine(maxWidth: number, fontSize: number, weight: number) {
  const factor =
    weight >= 800 ? 0.54 : weight >= 700 ? 0.5 : weight >= 600 ? 0.48 : 0.45
  return Math.max(6, Math.floor(maxWidth / (fontSize * factor)))
}

function textBlock(
  block: WrappedText,
  x: number,
  startY: number,
  anchor: "middle" | "start"
) {
  const textAnchor = anchor === "start" ? "start" : "middle"
  return block.lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${startY + index * block.lineHeight}" text-anchor="${textAnchor}" class="${block.className}">${escapeXml(line)}</text>`
    )
    .join("")
}

function paperTexture(width: number, height: number) {
  const dots: string[] = []
  for (let row = 0; row < 18; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const cx = 80 + col * 84 + (row % 2 === 0 ? 0 : 42)
      const cy = 80 + row * 96
      if (cx < width - 40 && cy < height - 40) {
        dots.push(
          `<circle cx="${cx}" cy="${cy}" r="1.2" fill="${brand.outline}" opacity="0.18"/>`
        )
      }
    }
  }
  return `<g aria-hidden="true">${dots.join("")}</g>`
}

function fitLines(value: string, maxChars: number, maxLines: number) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let current = ""
  let wordIndex = 0

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex] ?? ""
    const candidate = current ? `${current} ${word}` : word

    if (candidate.length <= maxChars) {
      current = candidate
      wordIndex += 1
      continue
    }

    if (current) {
      lines.push(current)
      current = ""
      continue
    }

    lines.push(splitLongWord(word, maxChars))
    wordIndex += 1
  }

  if (current && lines.length < maxLines) {
    lines.push(current)
  } else if (current && lines.length === maxLines) {
    lines[maxLines - 1] = joinWithOverflow(lines[maxLines - 1] ?? "", current, maxChars)
  }

  if (wordIndex < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1
    lines[lastIndex] = joinWithOverflow(
      lines[lastIndex] ?? "",
      words.slice(wordIndex).join(" "),
      maxChars
    )
  }

  return lines.slice(0, maxLines)
}

function splitLongWord(word: string, maxChars: number) {
  if (word.length <= maxChars) return word
  if (maxChars <= 1) return word.slice(0, 1)
  return `${word.slice(0, maxChars - 1)}…`
}

function joinWithOverflow(line: string, extra: string, maxChars: number) {
  const combined = line ? `${line} ${extra}` : extra
  if (combined.length <= maxChars) return combined
  if (maxChars <= 1) return "…"
  return `${combined.slice(0, maxChars - 1).trimEnd()}…`
}

function svgShell(width: number, height: number, body: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <style>
        .title { font: 800 72px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .title-md { font: 800 58px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .title-sm { font: 800 48px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .title-left { font: 800 40px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .title-left-sm { font: 800 34px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .title-left-xs { font: 800 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .subtitle { font: 800 38px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .subtitle-left { font: 800 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .hint { font: 700 24px "Nunito Sans", Arial, sans-serif; fill: ${brand.honeyDark}; }
        .reward { font: 800 38px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .reward-sm { font: 800 32px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .reward-xs { font: 800 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .body { font: 700 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .body-sm { font: 700 24px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .body-left { font: 800 24px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .body-left-sm { font: 800 21px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .body-left-xs { font: 800 18px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .caption-left { font: 700 20px "Nunito Sans", Arial, sans-serif; fill: ${brand.honeyDark}; }
        .caption-left-sm { font: 700 18px "Nunito Sans", Arial, sans-serif; fill: ${brand.honeyDark}; }
        .status { font: 800 22px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .footer { font: 700 18px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .footer-left { font: 700 16px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .sticker-venue { font: 800 34px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .sticker-venue-sm { font: 800 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .sticker-venue-xs { font: 800 24px "Nunito Sans", Arial, sans-serif; fill: ${brand.espresso}; }
        .sticker-tagline { font: 800 28px "Nunito Sans", Arial, sans-serif; fill: ${brand.paperWhite}; }
        .sticker-reward { font: 700 20px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .sticker-reward-sm { font: 700 18px "Nunito Sans", Arial, sans-serif; fill: ${brand.inkMuted}; }
        .qr-frame { fill: #ffffff; stroke: ${brand.espresso}; stroke-width: 3; }
        .qr-safe-zone { fill: #ffffff; }
      </style>
      ${body}
    </svg>
  `
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
