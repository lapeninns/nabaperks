/**
 * Resolve the public origin encoded into /dev/*-preview QR codes.
 * Export passes `origin` so print PDFs target production (or another app
 * host) while Playwright still loads the local preview server.
 */
export function resolvePreviewShareOrigin(input: {
  readonly override: string | null
  readonly host: string | null
  readonly protocol: string
  readonly fallback?: string
}): string {
  const raw = input.override?.trim()
  if (raw) {
    try {
      const url = new URL(raw.includes("://") ? raw : `https://${raw}`)
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin
      }
    } catch {
      // Fall through to request host.
    }
  }

  if (input.host) {
    return `${input.protocol}://${input.host}`
  }

  return input.fallback ?? "http://127.0.0.1:3000"
}
