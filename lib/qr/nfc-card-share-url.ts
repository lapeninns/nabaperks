export const QR_SHARE_CHANNELS = ["nfc", "qr"] as const

export type QrShareChannel = (typeof QR_SHARE_CHANNELS)[number]

const CHANNEL_SET = new Set<string>(QR_SHARE_CHANNELS)

export function isQrShareChannel(value: string): value is QrShareChannel {
  return CHANNEL_SET.has(value)
}

/**
 * Tag a permanent venue join URL so qr_scanned analytics can tell NFC taps
 * from printed QR scans. Safe to call repeatedly — replaces an existing src.
 */
export function appendQrShareChannel(
  shareUrl: string,
  channel: QrShareChannel
): string {
  if (!CHANNEL_SET.has(channel)) {
    throw new Error(`Unsupported QR share channel ${channel}`)
  }
  const url = new URL(shareUrl)
  url.searchParams.set("src", channel)
  return url.toString()
}

export function parseQrShareChannel(
  value: string | readonly string[] | undefined
): QrShareChannel | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !isQrShareChannel(raw)) return null
  return raw
}
