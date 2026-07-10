import { createHash, createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_VERSION = 1
const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1_000
const TOKEN_SIGNATURE_DOMAIN = "nabaperks:analytics:funnel-token:v1"
const EVENT_ID_DOMAIN = "nabaperks:analytics:funnel-event-id:v1"
const MIN_SECRET_LENGTH = 16
const MAX_SECRET_LENGTH = 1_024
const MAX_TOKEN_LENGTH = 512
const MAX_EVENT_NAME_LENGTH = 96
const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const base64UrlPattern = /^[A-Za-z0-9_-]+$/

type FunnelTokenPayload = {
  version: typeof TOKEN_VERSION
  funnelId: string
  issuedAt: number
  expiresAt: number
}

export type VerifiedFunnelToken = Readonly<{
  funnelId: string
  issuedAt: number
  expiresAt: number
}>

export function issueFunnelToken(
  funnelId: string,
  secret: string,
  nowMs: number = Date.now()
): string {
  assertCanonicalUuid(funnelId)
  assertSecret(secret)
  assertTimestamp(nowMs)

  const payload: FunnelTokenPayload = {
    version: TOKEN_VERSION,
    funnelId: funnelId.toLowerCase(),
    issuedAt: nowMs,
    expiresAt: nowMs + TOKEN_LIFETIME_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  )
  const signature = signPayload(encodedPayload, secret)
  const token = `${encodedPayload}.${signature.toString("base64url")}`

  if (token.length > MAX_TOKEN_LENGTH) {
    throw new TypeError("Funnel token exceeds its size limit")
  }

  return token
}

export function verifyFunnelToken(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): VerifiedFunnelToken | null {
  if (
    !isExactBoundedString(token, MAX_TOKEN_LENGTH) ||
    !isValidSecret(secret) ||
    !isTimestamp(nowMs)
  ) {
    return null
  }

  const segments = token.split(".")
  if (
    segments.length !== 2 ||
    !isCanonicalBase64Url(segments[0]) ||
    !isCanonicalBase64Url(segments[1])
  ) {
    return null
  }

  const [encodedPayload, encodedSignature] = segments
  const actualSignature = Buffer.from(encodedSignature, "base64url")
  const expectedSignature = signPayload(encodedPayload, secret)

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null
  }

  const payload = decodePayload(encodedPayload)
  if (!payload) return null

  if (
    nowMs < payload.issuedAt ||
    nowMs >= payload.expiresAt ||
    payload.expiresAt !== payload.issuedAt + TOKEN_LIFETIME_MS
  ) {
    return null
  }

  return {
    funnelId: payload.funnelId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  }
}

export function deterministicFunnelEventId(
  token: string,
  eventName: string
): string {
  if (
    !isExactBoundedString(token, MAX_TOKEN_LENGTH) ||
    !isExactBoundedString(eventName, MAX_EVENT_NAME_LENGTH)
  ) {
    throw new TypeError("Invalid funnel event identity input")
  }

  const bytes = Buffer.from(
    createHash("sha256")
      .update(EVENT_ID_DOMAIN)
      .update("\0")
      .update(token)
      .update("\0")
      .update(eventName)
      .digest()
      .subarray(0, 16)
  )

  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function signPayload(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(TOKEN_SIGNATURE_DOMAIN)
    .update("\0")
    .update(encodedPayload)
    .digest()
}

function decodePayload(encodedPayload: string): FunnelTokenPayload | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    )

    if (!isPlainRecord(parsed)) return null
    if (
      Reflect.ownKeys(parsed).length !== 4 ||
      parsed.version !== TOKEN_VERSION ||
      typeof parsed.funnelId !== "string" ||
      !canonicalUuidPattern.test(parsed.funnelId) ||
      !isTimestamp(parsed.issuedAt) ||
      !isTimestamp(parsed.expiresAt)
    ) {
      return null
    }

    return {
      version: TOKEN_VERSION,
      funnelId: parsed.funnelId.toLowerCase(),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

function isCanonicalBase64Url(value: string): boolean {
  if (!base64UrlPattern.test(value)) return false

  try {
    return Buffer.from(value, "base64url").toString("base64url") === value
  } catch {
    return false
  }
}

function assertCanonicalUuid(value: string): void {
  if (!isExactBoundedString(value, 36) || !canonicalUuidPattern.test(value)) {
    throw new TypeError("Invalid funnel id")
  }
}

function assertSecret(value: string): void {
  if (!isValidSecret(value)) {
    throw new TypeError("Invalid funnel signing secret")
  }
}

function isValidSecret(value: string): boolean {
  return (
    isExactBoundedString(value, MAX_SECRET_LENGTH) &&
    value.length >= MIN_SECRET_LENGTH
  )
}

function assertTimestamp(value: number): void {
  if (
    !isTimestamp(value) ||
    value > Number.MAX_SAFE_INTEGER - TOKEN_LIFETIME_MS
  ) {
    throw new TypeError("Invalid funnel token timestamp")
  }
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  )
}

function isExactBoundedString(
  value: unknown,
  maxLength: number
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value === value.trim()
  )
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
