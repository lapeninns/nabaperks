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

export function assetKindFromSlug(slug: string) {
  return assetSlugs[slug] ?? null
}

export function assetFilename(kind: QrAssetKind, qrPublicId: string) {
  const extension = kind === "poster_pdf" ? "pdf" : "png"
  return `stampiee-${kind.replaceAll("_", "-")}-${qrPublicId}.${extension}`
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
      ? { width: 900, height: 540, qrSize: 280 }
      : { width: 600, height: 600, qrSize: 300 }
  const qr = await qrDataUrl(context.shareUrl, canvas.qrSize)
  const svg =
    kind === "till_card_png"
      ? tillCardSvg(context, qr, canvas.width, canvas.height, canvas.qrSize)
      : stickerSvg(context, qr, canvas.width, canvas.height, canvas.qrSize)

  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function renderQrPosterPdf(context: QrAssetContext) {
  const png = await renderPosterPng(context)
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

async function renderPosterPng(context: QrAssetContext) {
  const width = 1240
  const height = 1754
  const qrSize = 560
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
  const x = (width - qrSize) / 2
  const qrY = 548
  const framePad = 56
  return svgShell(width, height, `
    <rect width="${width}" height="${height}" fill="#FCFAF7"/>
    <rect x="76" y="74" width="1088" height="1608" rx="84" fill="#ffffff" stroke="#d4c4b1" stroke-width="4"/>
    <rect x="112" y="110" width="1016" height="1536" rx="64" fill="#fff8f3" stroke="#f2e6db" stroke-width="3"/>
    <circle cx="226" cy="218" r="54" fill="#ffddb0"/>
    <circle cx="1018" cy="218" r="54" fill="#EBF7F2"/>
    <rect x="244" y="250" width="752" height="10" rx="5" fill="#d99e3d"/>
    <text x="620" y="220" text-anchor="middle" class="eyebrow">NO APP LOYALTY</text>
    <text x="620" y="332" text-anchor="middle" class="title">${escapeXml(context.merchantName)}</text>
    <text x="620" y="424" text-anchor="middle" class="subtitle">Scan. Stamp. Reveal.</text>
    <g aria-label="Scanner-safe black-on-white QR code">
      <rect class="qr-frame" x="${x - framePad}" y="${qrY - framePad}" width="${qrSize + framePad * 2}" height="${qrSize + framePad * 2}" rx="64"/>
      <rect class="qr-safe-zone" x="${x - 24}" y="${qrY - 24}" width="${qrSize + 48}" height="${qrSize + 48}" rx="42"/>
      <image href="${qrDataUrl}" x="${x}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
    </g>
    <rect x="176" y="1238" width="888" height="184" rx="48" fill="#EBF7F2" stroke="#d4c4b1" stroke-width="3"/>
    <text x="620" y="1296" text-anchor="middle" class="reward">Unlock ${escapeXml(context.rewardName)}</text>
    <text x="620" y="1362" text-anchor="middle" class="body">${escapeXml(context.cardName)} · ${escapeXml(context.locationName)}</text>
    <text x="620" y="1512" text-anchor="middle" class="url">${escapeXml(context.shareUrl)}</text>
    <text x="620" y="1570" text-anchor="middle" class="caption">${context.isActive ? "Active customer entry QR" : "Disabled QR — keep for records only"}</text>
  `)
}

function tillCardSvg(
  context: QrAssetContext,
  qrDataUrl: string,
  width: number,
  height: number,
  qrSize: number
) {
  return svgShell(width, height, `
    <rect width="${width}" height="${height}" rx="48" fill="#FCFAF7"/>
    <rect x="28" y="28" width="844" height="484" rx="44" fill="#ffffff" stroke="#d4c4b1" stroke-width="3"/>
    <rect x="52" y="52" width="796" height="90" rx="30" fill="#ffddb0"/>
    <rect x="58" y="74" width="294" height="338" rx="40" fill="#fff8f3" stroke="#f2e6db" stroke-width="3"/>
    <rect class="qr-frame" x="74" y="92" width="${qrSize + 56}" height="${qrSize + 56}" rx="36"/>
    <rect class="qr-safe-zone" x="92" y="110" width="${qrSize + 20}" height="${qrSize + 20}" rx="24"/>
    <image href="${qrDataUrl}" x="102" y="120" width="${qrSize}" height="${qrSize}"/>
    <text x="384" y="112" class="eyebrow-left">NO APP LOYALTY</text>
    <text x="384" y="218" class="title-left">${escapeXml(context.merchantName)}</text>
    <text x="384" y="282" class="subtitle-left">Scan. Stamp. Reveal.</text>
    <text x="384" y="352" class="body-left">${escapeXml(context.rewardName)} after your visits</text>
    <text x="384" y="420" class="url-left">${escapeXml(context.shareUrl)}</text>
    <text x="384" y="466" class="caption-left">${escapeXml(context.locationName)} · ${context.isActive ? "active" : "disabled"}</text>
  `)
}

function stickerSvg(
  context: QrAssetContext,
  qrDataUrl: string,
  width: number,
  height: number,
  qrSize: number
) {
  const x = (width - qrSize) / 2
  const qrY = 142
  return svgShell(width, height, `
    <rect width="${width}" height="${height}" rx="72" fill="#ffffff"/>
    <rect x="22" y="22" width="556" height="556" rx="66" fill="#FCFAF7" stroke="#201b14" stroke-width="3"/>
    <rect x="48" y="48" width="504" height="504" rx="52" fill="#fff8f3" stroke="#d4c4b1" stroke-width="3"/>
    <circle cx="92" cy="92" r="24" fill="#ffddb0"/>
    <circle cx="508" cy="92" r="24" fill="#EBF7F2"/>
    <text x="300" y="96" text-anchor="middle" class="eyebrow">STAMP LOYALTY</text>
    <rect class="qr-frame" x="${x - 34}" y="${qrY - 34}" width="${qrSize + 68}" height="${qrSize + 68}" rx="44"/>
    <rect class="qr-safe-zone" x="${x - 16}" y="${qrY - 16}" width="${qrSize + 32}" height="${qrSize + 32}" rx="30"/>
    <image href="${qrDataUrl}" x="${x}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
    <text x="300" y="496" text-anchor="middle" class="subtitle">Scan. Stamp. Reveal.</text>
    <text x="300" y="538" text-anchor="middle" class="url">${escapeXml(context.qrPublicId)}</text>
  `)
}

function svgShell(width: number, height: number, body: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <style>
        .eyebrow { font: 800 28px Arial, sans-serif; letter-spacing: 4px; fill: #805600; }
        .eyebrow-left { font: 800 21px Arial, sans-serif; letter-spacing: 3px; fill: #805600; }
        .title { font: 800 82px Arial, sans-serif; fill: #201b14; }
        .title-left { font: 800 50px Arial, sans-serif; fill: #201b14; }
        .subtitle { font: 800 42px Arial, sans-serif; fill: #504536; }
        .subtitle-left { font: 800 32px Arial, sans-serif; fill: #504536; }
        .reward { font: 800 48px Arial, sans-serif; fill: #201b14; }
        .body { font: 700 34px Arial, sans-serif; fill: #504536; }
        .body-left { font: 800 28px Arial, sans-serif; fill: #201b14; }
        .url { font: 700 24px monospace; fill: #504536; }
        .url-left { font: 700 19px monospace; fill: #504536; }
        .caption { font: 700 24px Arial, sans-serif; fill: #805600; }
        .caption-left { font: 700 20px Arial, sans-serif; fill: #805600; }
        .qr-frame { fill: #ffffff; stroke: #201b14; stroke-width: 3; }
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
