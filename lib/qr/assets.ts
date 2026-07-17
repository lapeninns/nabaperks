import "server-only"

import QRCode from "qrcode"
import { posterQrDefaults } from "./poster-token-readers"

type QrRenderOptions = {
  readonly errorCorrectionLevel: "H"
  readonly margin: number
  readonly dark: string
  readonly light: string
}

async function renderPng(
  shareUrl: string,
  width: number,
  options: QrRenderOptions
) {
  const dataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: options.errorCorrectionLevel,
    margin: options.margin,
    width,
    color: {
      dark: options.dark,
      light: options.light,
    },
  })
  const base64 = dataUrl.split(",")[1]
  return Buffer.from(base64, "base64")
}

export function renderQrCodePng(shareUrl: string, width = 720) {
  return renderPng(shareUrl, width, {
    errorCorrectionLevel: "H",
    margin: 4,
    dark: "#000000",
    light: "#ffffff",
  })
}

export function renderPosterQrCodePng(shareUrl: string, width = 720) {
  const qr = posterQrDefaults()
  return renderPng(shareUrl, width, {
    errorCorrectionLevel: qr.errorCorrectionLevel,
    margin: qr.quietZoneModules,
    dark: qr.ink,
    light: qr.background,
  })
}
