import "server-only"

import QRCode from "qrcode"

export async function renderQrCodePng(shareUrl: string, width = 720) {
  const dataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: "H",
    margin: 4,
    width,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  })
  const base64 = dataUrl.split(",")[1]
  return Buffer.from(base64, "base64")
}
