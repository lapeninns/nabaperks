import { createHmac, timingSafeEqual } from "node:crypto"

const VERSION = 1
const LIFETIME_MS = 365 * 24 * 60 * 60 * 1_000
const DOMAIN = "nabaperks:customer-device:v1"
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function issueCustomerDeviceToken(
  deviceId: string,
  secret: string,
  nowMs: number = Date.now()
): string {
  if (!UUID_PATTERN.test(deviceId) || secret.length < 16) {
    throw new TypeError("Invalid customer device token input")
  }
  const body = Buffer.from(
    JSON.stringify({ version: VERSION, deviceId, issuedAt: nowMs, expiresAt: nowMs + LIFETIME_MS })
  ).toString("base64url")
  return `${body}.${signature(body, secret)}`
}

export function verifyCustomerDeviceToken(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): string | null {
  if (!token || token.length > 512 || secret.length < 16) return null
  const [body, presented, extra] = token.split(".")
  if (!body || !presented || extra) return null

  const expected = Buffer.from(signature(body, secret), "base64url")
  const actual = Buffer.from(presented, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    )
    if (!isRecord(payload)) return null
    if (
      payload.version !== VERSION ||
      typeof payload.deviceId !== "string" ||
      !UUID_PATTERN.test(payload.deviceId) ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt !== payload.issuedAt + LIFETIME_MS ||
      nowMs < payload.issuedAt ||
      nowMs >= payload.expiresAt
    ) {
      return null
    }
    return payload.deviceId
  } catch {
    return null
  }
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(DOMAIN)
    .update("\0")
    .update(body)
    .digest("base64url")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
