import { createHash } from "node:crypto"

export function rateLimitIdentityFromHeaders(headers: Headers): string {
  const ip = trustedClientIp(headers)
  const userAgent = headers.get("user-agent")?.trim().slice(0, 160) || "unknown"

  return createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32)
}

export function trustedClientIp(headers: Headers): string {
  const verifiedIp = forwardedSegments(headers.get("x-vercel-forwarded-for"))[0]
  if (verifiedIp) return verifiedIp

  const observedHops = forwardedSegments(headers.get("x-forwarded-for"))
  const nearestHop = observedHops[observedHops.length - 1]
  if (nearestHop) return nearestHop

  return "unknown"
}

function forwardedSegments(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
}
