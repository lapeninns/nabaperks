import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export type PendingPhonePurpose = "join" | "wallet"

export type PendingPhonePayload = {
  version: 1
  purpose: PendingPhonePurpose
  phone: string
  phoneHmac: string
  country: string
  customerId: string | null
  issuedAt: number
  expiresAt: number
}

export type CustomerSessionPayload = {
  version: 1
  customerId: string
  issuedAt: number
  expiresAt: number
}

export type CookieReadResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" }

export function createPendingPhoneCookieValue(
  payload: PendingPhonePayload,
  secret: string
): string {
  return signPayload(payload, secret)
}

export function readPendingPhoneCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<PendingPhonePayload> {
  return readSignedPayload(value, secret, nowSeconds, parsePendingPhonePayload)
}

export function createCustomerSessionCookieValue(
  payload: CustomerSessionPayload,
  secret: string
): string {
  return signPayload(payload, secret)
}

export function readCustomerSessionCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): CookieReadResult<CustomerSessionPayload> {
  return readSignedPayload(
    value,
    secret,
    nowSeconds,
    parseCustomerSessionPayload
  )
}

function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  return `${body}.${signature(body, secret)}`
}

function readSignedPayload<T extends { expiresAt: number }>(
  value: string,
  secret: string,
  nowSeconds: number,
  parse: (value: unknown) => T | null
): CookieReadResult<T> {
  const parts = value.split(".")
  if (parts.length !== 2) return { ok: false, reason: "malformed" }

  const [body, receivedSignature] = parts
  if (!body || !receivedSignature) return { ok: false, reason: "malformed" }
  if (!signaturesMatch(signature(body, secret), receivedSignature)) {
    return { ok: false, reason: "invalid_signature" }
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "malformed" }
  }

  const payload = parse(decoded)
  if (!payload) return { ok: false, reason: "malformed" }
  if (payload.expiresAt <= nowSeconds) return { ok: false, reason: "expired" }

  return { ok: true, payload }
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url")
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "base64url")
  const receivedBuffer = Buffer.from(received, "base64url")

  return (
    expectedBuffer.byteLength === receivedBuffer.byteLength &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}

function parsePendingPhonePayload(value: unknown): PendingPhonePayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const purpose = value.purpose
  const phone = value.phone
  const phoneHmac = value.phoneHmac
  const country = value.country
  const customerId = value.customerId
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 1) return null
  if (purpose !== "join" && purpose !== "wallet") return null
  if (typeof phone !== "string") return null
  if (typeof phoneHmac !== "string") return null
  if (typeof country !== "string") return null
  if (customerId !== null && typeof customerId !== "string") return null
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return {
    version,
    purpose,
    phone,
    phoneHmac,
    country,
    customerId,
    issuedAt,
    expiresAt,
  }
}

function parseCustomerSessionPayload(
  value: unknown
): CustomerSessionPayload | null {
  if (!isRecord(value)) return null

  const version = value.version
  const customerId = value.customerId
  const issuedAt = value.issuedAt
  const expiresAt = value.expiresAt

  if (version !== 1) return null
  if (typeof customerId !== "string") return null
  if (typeof issuedAt !== "number") return null
  if (typeof expiresAt !== "number") return null

  return { version, customerId, issuedAt, expiresAt }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
