import { createHash } from "node:crypto"

export const CUSTOMER_DEVICE_HEADER = "x-nabaperks-device-id"

export function customerDeviceHashFromHeaders(headers: Headers): string | null {
  const device = headers.get(CUSTOMER_DEVICE_HEADER)?.trim()
  if (!device) return null

  return createHash("sha256").update(`customer-device:${device}`).digest("hex")
}

export function rateLimitIdentityFromHeaders(headers: Headers): string {
  const ip = trustedClientIp(headers)

  return createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 32)
}

export function customerRateLimitIdentityFromHeaders(headers: Headers): string {
  const ip = trustedClientIp(headers)
  const device = headers.get(CUSTOMER_DEVICE_HEADER)?.trim()

  return createHash("sha256")
    .update(`${ip}:${device || "no-verified-device"}`)
    .digest("hex")
    .slice(0, 32)
}

export function trustedClientIp(headers: Headers): string {
  const verifiedIp = forwardedSegments(headers.get("x-vercel-forwarded-for"))[0]
  if (verifiedIp) return verifiedIp

  return "unknown"
}

function forwardedSegments(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
}
